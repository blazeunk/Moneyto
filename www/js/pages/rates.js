(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const $ = (id) => document.getElementById(id);

  function formatRate(value) {
    return Number(value).toLocaleString('es-AR', { maximumFractionDigits: 8 });
  }

  /** Solo las tasas que cargó el usuario (vacío si todavía usa las de ejemplo). */
  function customRates() {
    return Store.hasCustomRates() ? Store.getRates() : {};
  }

  function render() {
    const custom = Store.hasCustomRates();
    const rates = Store.getRates();
    const keys = Object.keys(rates).sort();

    $('sample-note').classList.toggle('hidden', custom);
    $('btn-reset').classList.toggle('hidden', !custom);

    $('tbody').innerHTML = keys.length
      ? keys
          .map((key) => {
            const [from, to] = key.split('_');
            return (
              '<tr class="border-b border-gray-800">' +
              '<td class="px-4 md:px-6 py-3 text-sm">' + esc(from) + '</td>' +
              '<td class="px-4 md:px-6 py-3 text-sm">' + esc(to) + '</td>' +
              '<td class="px-4 md:px-6 py-3 text-sm font-medium">' + esc(formatRate(rates[key])) + (custom ? '' : ' <span class="text-xs text-gray-400">(ejemplo)</span>') + '</td>' +
              '<td class="px-4 md:px-6 py-3 text-right">' +
              (custom
                ? '<button type="button" data-key="' + esc(key) + '" class="p-2 rounded-xl hover:bg-gray-800" aria-label="Eliminar la tasa de ' + esc(from) + ' a ' + esc(to) + '">🗑️</button>'
                : '') +
              '</td></tr>'
            );
          })
          .join('')
      : '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 text-sm">No hay tasas guardadas.</td></tr>';
  }

  function updatePreview() {
    const rate = parseFloat($('rate').value);
    $('preview').textContent =
      Number.isFinite(rate) && rate > 0
        ? '1 ' + $('from').value + ' = ' + formatRate(rate) + ' ' + $('to').value
        : 'Ejemplo: si 1 USD vale 1400 ARS, elegí De USD, A ARS y escribí 1400.';
  }

  function save(e) {
    e.preventDefault();
    const from = $('from').value;
    const to = $('to').value;
    const rate = parseFloat($('rate').value);

    if (from === to) return UI.toast('Elegí dos monedas distintas.', true);
    if (!Number.isFinite(rate) || rate <= 0) return UI.toast('Ingresá una tasa mayor a 0.', true);

    const rates = customRates();
    rates[from + '_' + to] = rate;
    if ($('inverse').checked) rates[to + '_' + from] = Number((1 / rate).toPrecision(8));

    if (!Store.setRates(rates)) return;
    $('rate').value = '';
    updatePreview();
    render();
    UI.toast('Tasa guardada');
  }

  function remove(key) {
    const rates = customRates();
    delete rates[key];
    if (Object.keys(rates).length) Store.setRates(rates);
    else localStorage.removeItem(Store.KEYS.exchangeRates);
    render();
    UI.toast('Tasa eliminada');
  }

  function reset() {
    if (!window.confirm('Se borrarán tus tasas y se volverá a usar las de ejemplo. ¿Continuar?')) return;
    localStorage.removeItem(Store.KEYS.exchangeRates);
    render();
    UI.toast('Se restauraron las tasas de ejemplo');
  }

  const display = Store.getCurrency();
  UI.fillSelect($('from'), Core.CURRENCIES, 'USD');
  UI.fillSelect($('to'), Core.CURRENCIES, display !== 'USD' ? display : 'ARS');

  $('form').addEventListener('submit', save);
  $('rate').addEventListener('input', updatePreview);
  $('from').addEventListener('change', updatePreview);
  $('to').addEventListener('change', updatePreview);
  $('btn-reset').addEventListener('click', reset);
  $('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (btn) remove(btn.getAttribute('data-key'));
  });

  updatePreview();
  render();
})();
