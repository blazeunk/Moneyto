(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const $ = (id) => document.getElementById(id);
  const monthSelect = $('month');
  const catSelect = $('b-categoria');

  function allBudgets() {
    return Store.get('budgets').filter((b) => b && b.categoria && Number.isFinite(b.limite));
  }

  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  function buildMonths() {
    const keep = monthSelect.value || Core.monthKey();
    const expenses = Store.get('expenses');
    const months = Array.from(
      new Set(
        expenses
          .map((e) => String(e.fecha || '').slice(0, 7))
          .filter((m) => /^\d{4}-\d{2}$/.test(m))
          .concat([Core.monthKey(), Core.previousMonthKey()])
      )
    )
      .sort()
      .reverse();
    monthSelect.textContent = '';
    months.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = monthLabel(m);
      monthSelect.appendChild(opt);
    });
    monthSelect.value = months.includes(keep) ? keep : Core.monthKey();
  }

  function fillCategories(selected) {
    const list = Store.get('expenseCategories');
    UI.fillSelect(catSelect, list, selected || list[0]);
  }

  function barColor(percent) {
    if (percent > 90) return '#ef4444';
    if (percent > 70) return '#eab308';
    return '#10b981';
  }

  function render() {
    const budgets = allBudgets();
    const expenses = Store.get('expenses').filter(
      (e) => e && typeof e.fecha === 'string' && Number.isFinite(e.monto) && e.moneda
    );
    const rates = Store.getRates();
    const month = monthSelect.value;
    const tbody = $('tbody');

    let missingTotal = 0;
    if (!budgets.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400 text-sm">Todavía no definiste presupuestos. Elegí una categoría y un límite arriba para empezar.</td></tr>';
      $('rates-note').innerHTML = '';
      return;
    }

    tbody.innerHTML = budgets
      .map((b) => {
        const s = Core.budgetStatus(b, expenses, month, rates);
        missingTotal += s.missing;
        const over = s.remaining < 0;
        const width = Math.min(Math.max(s.percent, 0), 100);
        return (
          '<tr class="border-b border-gray-800">' +
          '<td class="px-4 md:px-6 py-3 text-sm font-medium">' + esc(b.categoria) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap">' + esc(UI.formatMoney(b.limite, b.moneda)) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap text-red-300">' + esc(UI.formatMoney(s.spent, b.moneda)) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap ' + (over ? 'text-red-300 font-semibold' : 'text-emerald-300') + '">' +
          esc(UI.formatMoney(s.remaining, b.moneda)) + (over ? ' (excedido)' : '') + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm">' +
          '<div class="progress" role="progressbar" aria-label="Uso del presupuesto de ' + esc(b.categoria) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + width + '">' +
          '<span style="width:' + width + '%;background:' + barColor(s.percent) + '"></span></div>' +
          '<p class="text-xs text-gray-400 mt-1">' + s.percent + '%</p></td>' +
          '<td class="px-4 md:px-6 py-3 text-right whitespace-nowrap sticky right-0 bg-gray-900">' +
          '<button type="button" data-action="edit" data-id="' + b.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Editar presupuesto de ' + esc(b.categoria) + '">✏️</button>' +
          '<button type="button" data-action="delete" data-id="' + b.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Eliminar presupuesto de ' + esc(b.categoria) + '">🗑️</button>' +
          '</td></tr>'
        );
      })
      .join('');

    $('rates-note').innerHTML = UI.ratesWarning(missingTotal);
  }

  function save(e) {
    e.preventDefault();
    const categoria = catSelect.value;
    const limite = Core.parseAmount($('b-limite').value);
    if (!categoria) return UI.toast('Elegí o creá una categoría.', true);
    if (limite === null) return UI.toast('Ingresá un límite mayor a 0.', true);

    const list = Store.get('budgets');
    const existing = list.find((b) => String(b.categoria).toLowerCase() === categoria.toLowerCase());
    const moneda = $('b-moneda').value;
    if (existing) {
      existing.limite = limite;
      existing.moneda = moneda;
    } else {
      list.push({ id: Core.makeId(), categoria, limite, moneda });
    }
    if (!Store.set('budgets', list)) return;

    $('b-limite').value = '';
    render();
    UI.toast(existing ? 'Se actualizó el presupuesto de ' + categoria : 'Se creó el presupuesto de ' + categoria);
  }

  function edit(id) {
    const budget = allBudgets().find((b) => String(b.id) === id);
    if (!budget) return;
    fillCategories(budget.categoria);
    $('b-limite').value = budget.limite;
    $('b-moneda').value = budget.moneda;
    $('b-limite').focus();
    $('b-limite').scrollIntoView({ block: 'center' });
  }

  function remove(id) {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    const list = Store.get('budgets').filter((b) => String(b.id) !== id);
    if (!Store.set('budgets', list)) return;
    render();
    UI.toast('Se eliminó el presupuesto');
  }

  function quickAddCategory() {
    const name = window.prompt('Nueva categoría de gasto:');
    if (!name || !name.trim()) return;
    const saved = Store.addCategory('expenseCategories', name);
    if (saved) {
      fillCategories(saved);
      UI.toast('Categoría lista: ' + saved);
    }
  }

  UI.fillSelect($('b-moneda'), Core.CURRENCIES, Store.getCurrency());
  fillCategories();
  buildMonths();

  $('form').addEventListener('submit', save);
  $('btn-new-cat').addEventListener('click', quickAddCategory);
  monthSelect.addEventListener('change', render);
  $('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-action') === 'edit') edit(id);
    else remove(id);
  });

  render();
})();
