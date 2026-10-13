(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];
  const charts = {};

  const periodSelect = document.getElementById('period');

  function buildPeriods() {
    const options = [
      [Core.monthKey(), 'Este mes'],
      [Core.previousMonthKey(), 'Mes anterior'],
      ['all', 'Todo el historial'],
    ];
    periodSelect.textContent = '';
    options.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      periodSelect.appendChild(opt);
    });
  }

  function card(href, label, value, valueClass) {
    return (
      '<a href="' + href + '" class="block bg-gray-900 rounded-2xl p-4 md:p-6 hover:bg-gray-800">' +
      '<p class="text-gray-400 text-sm">' + label + '</p>' +
      '<p class="text-2xl md:text-3xl font-semibold mt-1 ' + valueClass + '">' + esc(value) + '</p></a>'
    );
  }

  function drawChart(key, canvasId, boxId, type, entries) {
    const box = document.getElementById(boxId);
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
    // Sin datos, o sin Chart.js (por ejemplo, sin conexión): queda la lista de texto.
    if (!entries.length || typeof window.Chart === 'undefined') {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    charts[key] = new window.Chart(document.getElementById(canvasId), {
      type,
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [
          {
            data: entries.map((e) => Math.round(e[1] * 100) / 100),
            backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
            borderColor: '#111827',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: { legend: { display: false } },
      },
    });
  }

  function legend(listId, entries, currency, emptyText) {
    const list = document.getElementById(listId);
    if (!entries.length) {
      list.innerHTML = '<li class="text-gray-400">' + esc(emptyText) + '</li>';
      return;
    }
    const total = entries.reduce((sum, e) => sum + e[1], 0);
    list.innerHTML = entries
      .map((e, i) => {
        const pct = total > 0 ? Math.round((e[1] / total) * 100) : 0;
        return (
          '<li class="flex items-center justify-between gap-3">' +
          '<span class="flex items-center gap-2 min-w-0"><span class="inline-block w-3 h-3 rounded-full flex-shrink-0" style="background:' +
          PALETTE[i % PALETTE.length] + '"></span><span class="truncate">' + esc(e[0]) + '</span></span>' +
          '<span class="text-gray-300 whitespace-nowrap">' + esc(UI.formatMoney(e[1], currency)) + ' · ' + pct + '%</span></li>'
        );
      })
      .join('');
  }

  function render() {
    const currency = Store.getCurrency();
    const rates = Store.getRates();
    const period = periodSelect.value;

    document.getElementById('dash-currency').textContent = currency;

    const expenses = Core.filterByMonth(Store.get('expenses'), period);
    const incomes = Core.filterByMonth(Store.get('incomes'), period);
    const exp = Core.sumConverted(expenses, currency, rates);
    const inc = Core.sumConverted(incomes, currency, rates);
    const balance = inc.total - exp.total;

    document.getElementById('summary-cards').innerHTML =
      card('incomes.html', 'Ingresos', UI.formatMoney(inc.total, currency), 'text-emerald-400') +
      card('expenses.html', 'Gastos', UI.formatMoney(exp.total, currency), 'text-red-400') +
      card('dashboard.html', 'Balance', UI.formatMoney(balance, currency), balance >= 0 ? 'text-emerald-400' : 'text-red-400');

    // Avisos sobre las tasas de cambio.
    const foreign = expenses.concat(incomes).some((x) => x.moneda !== currency);
    let note = UI.ratesWarning(exp.missing + inc.missing);
    if (foreign && !Store.hasCustomRates()) {
      note +=
        '<p class="text-amber-300 text-xs mt-2" role="note">Estás usando tasas de cambio de ejemplo. ' +
        '<a class="underline" href="admin_exchange_rates.html">Cargá las tuyas</a> para que los totales sean correctos.</p>';
    }
    document.getElementById('rates-note').innerHTML = note ? '<div class="mb-4">' + note + '</div>' : '';

    // Deudas vencidas o por vencer.
    const today = Core.toLocalDateString();
    const due = Core.debtsNeedingAttention(Store.get('debts'), today, 3);
    const attention = document.getElementById('attention');
    if (due.length) {
      attention.classList.remove('hidden');
      document.getElementById('attention-list').innerHTML = due
        .map((d) => {
          const status = Core.debtStatus(d, today);
          return (
            '<li class="flex justify-between gap-3"><span class="truncate">' + esc(d.concepto) + '</span>' +
            '<span class="text-red-200 whitespace-nowrap">' + esc(UI.formatMoney(d.monto, d.moneda)) + ' · ' + esc(status.label) + '</span></li>'
          );
        })
        .join('');
    } else {
      attention.classList.add('hidden');
    }

    // Gráficos y leyendas.
    const byExp = Object.entries(Core.groupByCategory(expenses, currency, rates).totals).sort((a, b) => b[1] - a[1]);
    const byInc = Object.entries(Core.groupByCategory(incomes, currency, rates).totals).sort((a, b) => b[1] - a[1]);
    drawChart('exp', 'expensesChart', 'expensesChartBox', 'doughnut', byExp);
    drawChart('inc', 'incomesChart', 'incomesChartBox', 'pie', byInc);
    legend('expensesLegend', byExp, currency, 'Todavía no hay gastos en este período. Cargá el primero en Gastos.');
    legend('incomesLegend', byInc, currency, 'Todavía no hay ingresos en este período. Cargá el primero en Ingresos.');
  }

  buildPeriods();
  periodSelect.addEventListener('change', render);
  UI.onCurrencyChange(render);
  render();
})();
