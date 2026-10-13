/**
 * Gastos e ingresos comparten esta lógica: la página indica cuál es con
 * `<body data-kind="expense|income">`.
 */
(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const KINDS = {
    expense: {
      collection: 'expenses',
      categories: 'expenseCategories',
      title: 'Mis gastos',
      newTitle: 'Registrar gasto',
      editTitle: 'Editar gasto',
      singular: 'gasto',
      plural: 'gastos',
      newCatPrompt: 'Nueva categoría de gasto:',
      amountClass: 'text-red-300',
    },
    income: {
      collection: 'incomes',
      categories: 'incomeCategories',
      title: 'Mis ingresos',
      newTitle: 'Registrar ingreso',
      editTitle: 'Editar ingreso',
      singular: 'ingreso',
      plural: 'ingresos',
      newCatPrompt: 'Nueva categoría de ingreso:',
      amountClass: 'text-emerald-300',
    },
  };

  const kind = KINDS[document.body.getAttribute('data-kind')];

  const $ = (id) => document.getElementById(id);
  const modal = $('modal');
  const form = $('form');
  const filterMonth = $('filter-month');
  const filterCat = $('filter-cat');
  const filterText = $('filter-text');

  // ---------------------------------------------------------------- datos

  function allItems() {
    return Store.get(kind.collection).filter(
      (i) => i && typeof i.fecha === 'string' && Number.isFinite(i.monto) && i.moneda
    );
  }

  function visibleItems() {
    let rows = Core.filterByMonth(allItems(), filterMonth.value);
    if (filterCat.value !== 'all') rows = rows.filter((r) => r.categoria === filterCat.value);
    const q = filterText.value.trim().toLowerCase();
    if (q) rows = rows.filter((r) => String(r.descripcion || '').toLowerCase().includes(q));
    return rows.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  // ---------------------------------------------------------------- filtros

  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  function addOption(select, value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  function buildFilters(selectMonth) {
    const items = allItems();
    const keepMonth = selectMonth || filterMonth.value || Core.monthKey();
    const keepCat = filterCat.value || 'all';

    const months = Array.from(new Set(items.map((i) => i.fecha.slice(0, 7)).concat(Core.monthKey())))
      .sort()
      .reverse();
    filterMonth.textContent = '';
    addOption(filterMonth, 'all', 'Todos los meses');
    months.forEach((m) => addOption(filterMonth, m, monthLabel(m)));
    filterMonth.value = months.includes(keepMonth) || keepMonth === 'all' ? keepMonth : Core.monthKey();

    const cats = Array.from(new Set(Store.get(kind.categories).concat(items.map((i) => i.categoria)))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    filterCat.textContent = '';
    addOption(filterCat, 'all', 'Todas las categorías');
    cats.forEach((c) => addOption(filterCat, c, c));
    filterCat.value = cats.includes(keepCat) ? keepCat : 'all';
  }

  // ---------------------------------------------------------------- tabla

  function formatDate(fecha) {
    return fecha.split('-').reverse().join('/');
  }

  function rowHtml(item, currency, rates) {
    let approx = '';
    if (item.moneda !== currency) {
      const converted = Core.convert(item.monto, item.moneda, currency, rates);
      approx =
        converted === null
          ? '<div class="text-xs text-amber-300">Sin tasa de cambio</div>'
          : '<div class="text-xs text-gray-400">≈ ' + esc(UI.formatMoney(converted, currency)) + '</div>';
    }
    return (
      '<tr class="border-b border-gray-800 hover:bg-gray-800/30">' +
      '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap">' + esc(formatDate(item.fecha)) + '</td>' +
      '<td class="px-4 md:px-6 py-3 text-sm font-semibold whitespace-nowrap ' + kind.amountClass + '">' +
      esc(UI.formatMoney(item.monto, item.moneda)) + approx + '</td>' +
      '<td class="px-4 md:px-6 py-3 text-sm">' + esc(item.categoria) + '</td>' +
      '<td class="px-4 md:px-6 py-3 text-sm text-gray-400">' + (esc(item.descripcion) || '—') + '</td>' +
      '<td class="px-4 md:px-6 py-3 text-right whitespace-nowrap sticky right-0 bg-gray-900">' +
      '<button type="button" data-action="edit" data-id="' + item.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Editar ' + kind.singular + ' del ' + esc(formatDate(item.fecha)) + '">✏️</button>' +
      '<button type="button" data-action="delete" data-id="' + item.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Eliminar ' + kind.singular + ' del ' + esc(formatDate(item.fecha)) + '">🗑️</button>' +
      '</td></tr>'
    );
  }

  function render() {
    const currency = Store.getCurrency();
    const rates = Store.getRates();
    const rows = visibleItems();
    const { total, missing } = Core.sumConverted(rows, currency, rates);

    $('totals').textContent =
      rows.length === 0
        ? ''
        : rows.length + (rows.length === 1 ? ' ' + kind.singular : ' ' + kind.plural) + ' · Total: ' + UI.formatMoney(total, currency);

    let note = UI.ratesWarning(missing);
    const foreign = rows.some((r) => r.moneda !== currency);
    if (foreign && !Store.hasCustomRates()) {
      note +=
        '<p class="text-amber-300 text-xs mt-2" role="note">Los equivalentes usan tasas de ejemplo. ' +
        '<a class="underline" href="admin_exchange_rates.html">Cargá las tuyas</a>.</p>';
    }
    $('rates-note').innerHTML = note;

    const tbody = $('tbody');
    if (rows.length === 0) {
      const hasAny = allItems().length > 0;
      tbody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">' +
        (hasAny
          ? 'No hay ' + kind.plural + ' con estos filtros. Probá con otro mes o categoría.'
          : 'Todavía no registraste ' + kind.plural + '. Tocá “Nuevo” para cargar el primero.') +
        '</td></tr>';
    } else {
      tbody.innerHTML = rows.map((r) => rowHtml(r, currency, rates)).join('');
    }
  }

  // ---------------------------------------------------------------- formulario

  function fillCategorySelect(selected) {
    let list = Store.get(kind.categories);
    // Si la categoría de un registro viejo ya no existe, se conserva al editar.
    if (selected && !list.includes(selected)) list = [selected].concat(list);
    UI.fillSelect($('f-categoria'), list, selected || list[0]);
  }

  function openForm(item) {
    form.reset();
    UI.fillSelect($('f-moneda'), Core.CURRENCIES, item ? item.moneda : Store.getCurrency());
    $('f-id').value = item ? String(item.id) : '';
    $('f-fecha').value = item ? item.fecha : Core.toLocalDateString();
    $('f-monto').value = item ? item.monto : '';
    $('f-descripcion').value = item ? item.descripcion || '' : '';
    fillCategorySelect(item ? item.categoria : null);
    $('modal-title').textContent = item ? kind.editTitle : kind.newTitle;
    UI.openModal(modal);
  }

  function save(e) {
    e.preventDefault();
    const fecha = $('f-fecha').value;
    const monto = Core.parseAmount($('f-monto').value);
    const categoria = $('f-categoria').value;

    if (!Core.isValidDate(fecha)) return UI.toast('Ingresá una fecha válida.', true);
    if (monto === null) return UI.toast('Ingresá un monto mayor a 0.', true);
    if (!categoria) return UI.toast('Elegí o creá una categoría.', true);

    const data = {
      fecha,
      monto,
      moneda: $('f-moneda').value,
      categoria,
      descripcion: $('f-descripcion').value.trim().slice(0, 300),
    };

    const list = Store.get(kind.collection);
    const id = $('f-id').value;
    if (id) {
      const index = list.findIndex((i) => String(i.id) === id);
      if (index === -1) return UI.toast('No se encontró el registro a editar.', true);
      list[index] = Object.assign({}, list[index], data);
    } else {
      list.unshift(Object.assign({ id: Core.makeId() }, data));
    }
    if (!Store.set(kind.collection, list)) return;

    UI.closeModal(modal);
    // Muestra el mes del registro guardado para que no "desaparezca" por el filtro.
    buildFilters(fecha.slice(0, 7));
    render();
    UI.toast(id ? 'Cambios guardados' : 'Se agregó el ' + kind.singular);
  }

  function remove(id) {
    if (!window.confirm('¿Eliminar este ' + kind.singular + '? No se puede deshacer.')) return;
    const list = Store.get(kind.collection).filter((i) => String(i.id) !== id);
    if (!Store.set(kind.collection, list)) return;
    buildFilters();
    render();
    UI.toast('Se eliminó el ' + kind.singular);
  }

  async function copyList() {
    const rows = visibleItems();
    if (!rows.length) return UI.toast('No hay ' + kind.plural + ' para copiar.', true);
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const lines = ['FECHA\tMONTO\tMONEDA\tCATEGORÍA\tDESCRIPCIÓN'].concat(
      rows.map((r) => [r.fecha, r.monto, r.moneda, clean(r.categoria), clean(r.descripcion)].join('\t'))
    );
    const ok = await UI.copyText(lines.join('\n'));
    UI.toast(ok ? 'Lista copiada al portapapeles' : 'No se pudo copiar la lista.', !ok);
  }

  function quickAddCategory() {
    const name = window.prompt(kind.newCatPrompt);
    if (!name || !name.trim()) return;
    const saved = Store.addCategory(kind.categories, name);
    if (saved) {
      fillCategorySelect(saved);
      UI.toast('Categoría lista: ' + saved);
    }
  }

  // ---------------------------------------------------------------- eventos

  $('page-title').textContent = kind.title;
  $('table-caption').textContent = 'Lista de ' + kind.plural;

  $('btn-new').addEventListener('click', () => openForm(null));
  $('btn-copy').addEventListener('click', copyList);
  $('btn-new-cat').addEventListener('click', quickAddCategory);
  $('btn-cancel').addEventListener('click', () => UI.closeModal(modal));
  $('modal-close').addEventListener('click', () => UI.closeModal(modal));
  form.addEventListener('submit', save);
  UI.wireModal(modal);

  filterMonth.addEventListener('change', render);
  filterCat.addEventListener('change', render);
  filterText.addEventListener('input', render);

  $('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-action') === 'edit') {
      const item = allItems().find((i) => String(i.id) === id);
      if (item) openForm(item);
    } else {
      remove(id);
    }
  });

  UI.onCurrencyChange(render);
  buildFilters();
  render();
})();
