/**
 * Moneyto - utilidades de interfaz compartidas por todas las páginas.
 */
(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const esc = Core.escapeHtml;

  const formatters = {};

  const UI = {
    esc,

    /** Formatea dinero con la convención de Argentina (1.234,56). */
    formatMoney(amount, currency) {
      const cur = currency || 'USD';
      try {
        if (!formatters[cur]) {
          formatters[cur] = new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur });
        }
        return formatters[cur].format(amount);
      } catch (e) {
        return cur + ' ' + Number(amount).toFixed(2);
      }
    },

    /** Aviso breve. Usa textContent, así que nunca interpreta HTML. */
    toast(message, isError) {
      const el = document.createElement('div');
      el.setAttribute('role', isError ? 'alert' : 'status');
      el.className =
        'toast fixed left-1/2 -translate-x-1/2 z-[99999] px-4 py-3 rounded-2xl shadow-xl text-sm text-white ' +
        (isError ? 'bg-red-600' : 'bg-emerald-600');
      el.style.bottom = 'calc(1rem + env(safe-area-inset-bottom, 0px))';
      el.textContent = message;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), isError ? 4500 : 2800);
    },

    /** Llena un <select> con valores de texto. */
    fillSelect(select, values, selected) {
      select.textContent = '';
      values.forEach((value) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        if (value === selected) opt.selected = true;
        select.appendChild(opt);
      });
    },

    /** Mensaje cuando faltan tasas para convertir algún monto. */
    ratesWarning(missing) {
      if (!missing) return '';
      const plural = missing === 1 ? 'un movimiento' : missing + ' movimientos';
      return (
        '<p class="text-amber-300 text-xs mt-2" role="note">No se pudo convertir ' +
        plural +
        ' porque falta una tasa de cambio. Cargala en <a class="underline" href="admin_exchange_rates.html">Tasas de cambio</a>.</p>'
      );
    },

    // ---------------------------------------------------------------- modales

    openModal(modal) {
      modal._opener = document.activeElement;
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      const first = modal.querySelector('input:not([type=hidden]), select, textarea');
      if (first) first.focus();
    },

    closeModal(modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      if (modal._opener && typeof modal._opener.focus === 'function') modal._opener.focus();
    },

    /** Cierra con Escape y al tocar el fondo oscuro. */
    wireModal(modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) UI.closeModal(modal);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) UI.closeModal(modal);
      });
    },

    // ---------------------------------------------------------------- portapapeles

    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (err) {
          ok = false;
        }
        area.remove();
        return ok;
      }
    },

    /** Ejecuta `fn` ahora y cada vez que cambia la moneda de visualización. */
    onCurrencyChange(fn) {
      document.addEventListener('moneyto:currency', fn);
    },
  };

  window.addEventListener('moneyto:storage-error', () => {
    UI.toast('No se pudo guardar: el almacenamiento del dispositivo está lleno o bloqueado.', true);
  });

  window.UI = UI;
})();
