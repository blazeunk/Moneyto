(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const $ = (id) => document.getElementById(id);
  const modal = $('modal');
  const form = $('form');

  const STATUS_CLASS = {
    paid: 'text-emerald-300',
    overdue: 'text-red-300',
    today: 'text-orange-300',
    soon: 'text-amber-300',
    pending: 'text-gray-300',
  };

  function allDebts() {
    return Store.get('debts').filter((d) => d && Core.isValidDate(d.fechaVencimiento) && Number.isFinite(d.monto));
  }

  /** Impagas primero (por fecha de vencimiento); las pagadas al final. */
  function sorted(debts) {
    return debts.slice().sort((a, b) => {
      if (!!a.pagado !== !!b.pagado) return a.pagado ? 1 : -1;
      return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    });
  }

  function formatDate(fecha) {
    return fecha.split('-').reverse().join('/');
  }

  function render() {
    const debts = sorted(allDebts());
    const today = Core.toLocalDateString();
    const currency = Store.getCurrency();
    const rates = Store.getRates();

    const open = debts.filter((d) => !d.pagado);
    const { total, missing } = Core.sumConverted(open, currency, rates);
    $('summary').textContent = open.length
      ? 'Pendiente de pago: ' + UI.formatMoney(total, currency) + ' en ' + open.length + (open.length === 1 ? ' deuda' : ' deudas')
      : debts.length
        ? 'No tenés deudas pendientes.'
        : '';
    $('rates-note').innerHTML = UI.ratesWarning(missing);

    const tbody = $('tbody');
    if (!debts.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-10 text-center text-gray-400 text-sm">Todavía no registraste deudas. Tocá “Nueva deuda” para cargar la primera.</td></tr>';
      return;
    }
    tbody.innerHTML = debts
      .map((d) => {
        const status = Core.debtStatus(d, today);
        const name = esc(d.concepto);
        return (
          '<tr class="border-b border-gray-800 hover:bg-gray-800/30">' +
          '<td class="px-4 md:px-6 py-3 text-sm"><div class="font-medium' + (d.pagado ? ' line-through text-gray-400' : '') + '">' + name + '</div>' +
          (d.descripcion ? '<div class="text-xs text-gray-400">' + esc(d.descripcion) + '</div>' : '') + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap">' + esc(UI.formatMoney(d.monto, d.moneda)) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap">' + esc(formatDate(d.fechaVencimiento)) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-sm whitespace-nowrap ' + STATUS_CLASS[status.key] + '">' + esc(status.label) + '</td>' +
          '<td class="px-4 md:px-6 py-3 text-right whitespace-nowrap sticky right-0 bg-gray-900">' +
          '<button type="button" data-action="toggle" data-id="' + d.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="' +
          (d.pagado ? 'Marcar como pendiente: ' : 'Marcar como pagada: ') + name + '">' + (d.pagado ? '↩️' : '✅') + '</button>' +
          '<button type="button" data-action="edit" data-id="' + d.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Editar ' + name + '">✏️</button>' +
          '<button type="button" data-action="delete" data-id="' + d.id + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Eliminar ' + name + '">🗑️</button>' +
          '</td></tr>'
        );
      })
      .join('');
  }

  function openForm(debt) {
    form.reset();
    UI.fillSelect($('f-moneda'), Core.CURRENCIES, debt ? debt.moneda : Store.getCurrency());
    $('f-id').value = debt ? String(debt.id) : '';
    $('f-concepto').value = debt ? debt.concepto : '';
    $('f-monto').value = debt ? debt.monto : '';
    $('f-fecha').value = debt ? debt.fechaVencimiento : '';
    $('f-descripcion').value = debt ? debt.descripcion || '' : '';
    $('modal-title').textContent = debt ? 'Editar deuda' : 'Registrar deuda';
    UI.openModal(modal);
  }

  async function save(e) {
    e.preventDefault();
    const concepto = $('f-concepto').value.trim();
    const monto = Core.parseAmount($('f-monto').value);
    const fecha = $('f-fecha').value;

    if (!concepto) return UI.toast('Escribí un concepto para la deuda.', true);
    if (monto === null) return UI.toast('Ingresá un monto mayor a 0.', true);
    if (!Core.isValidDate(fecha)) return UI.toast('Elegí la fecha de vencimiento.', true);

    const data = {
      concepto: concepto.slice(0, 100),
      monto,
      moneda: $('f-moneda').value,
      fechaVencimiento: fecha,
      descripcion: $('f-descripcion').value.trim().slice(0, 300),
    };

    const list = Store.get('debts');
    const id = $('f-id').value;
    if (id) {
      const index = list.findIndex((d) => String(d.id) === id);
      if (index === -1) return UI.toast('No se encontró la deuda a editar.', true);
      list[index] = Object.assign({}, list[index], data);
    } else {
      list.push(Object.assign({ id: Core.makeId(), pagado: false }, data));
    }
    if (!Store.set('debts', list)) return;

    UI.closeModal(modal);
    render();
    UI.toast(id ? 'Cambios guardados' : 'Se agregó la deuda');

    // El permiso se pide al guardar (una acción del usuario), no al abrir la app.
    await window.Notifier.requestPermission();
    window.Notifier.sync();
  }

  function toggle(id) {
    const list = Store.get('debts');
    const debt = list.find((d) => String(d.id) === id);
    if (!debt) return;
    debt.pagado = !debt.pagado;
    if (!Store.set('debts', list)) return;
    render();
    window.Notifier.sync();
    UI.toast(debt.pagado ? 'Deuda marcada como pagada' : 'Deuda marcada como pendiente');
  }

  function remove(id) {
    if (!window.confirm('¿Eliminar esta deuda? No se puede deshacer.')) return;
    const list = Store.get('debts').filter((d) => String(d.id) !== id);
    if (!Store.set('debts', list)) return;
    render();
    window.Notifier.sync();
    UI.toast('Se eliminó la deuda');
  }

  $('btn-new').addEventListener('click', () => openForm(null));
  $('btn-cancel').addEventListener('click', () => UI.closeModal(modal));
  $('modal-close').addEventListener('click', () => UI.closeModal(modal));
  form.addEventListener('submit', save);
  UI.wireModal(modal);

  $('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'toggle') toggle(id);
    else if (action === 'delete') remove(id);
    else {
      const debt = allDebts().find((d) => String(d.id) === id);
      if (debt) openForm(debt);
    }
  });

  UI.onCurrencyChange(render);
  render();
})();
