/**
 * Moneyto - barra superior y menú lateral compartidos.
 *
 * Cada página declara `<body data-page="expenses">` y deja dos contenedores
 * vacíos (#shell-top y #shell-side). Antes este HTML estaba copiado en las
 * 10 páginas; ahora se cambia en un solo lugar.
 */
(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;

  const NAV = [
    ['dashboard', 'dashboard.html', '📊', 'Inicio'],
    ['expenses', 'expenses.html', '💸', 'Gastos'],
    ['incomes', 'incomes.html', '📈', 'Ingresos'],
    ['debts', 'debts.html', '💰', 'Deudas'],
    ['budgets', 'budgets.html', '🐷', 'Presupuestos'],
    ['shopping', 'shopping_list.html', '🛒', 'Lista de compras'],
    ['categories', 'admin_categories.html', '🏷️', 'Categorías'],
    ['rates', 'admin_exchange_rates.html', '🔄', 'Tasas de cambio'],
    ['backup', 'backup.html', '💾', 'Copias de seguridad'],
  ];

  const current = document.body.getAttribute('data-page');

  function link(item, extraClass) {
    const active = item[0] === current;
    const base = active ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-200';
    return (
      '<a href="' + item[1] + '" class="' + extraClass + ' ' + base + '"' +
      (active ? ' aria-current="page"' : '') + '>' +
      '<span aria-hidden="true">' + item[2] + '</span> ' + item[3] + '</a>'
    );
  }

  function render() {
    const top = document.getElementById('shell-top');
    const side = document.getElementById('shell-side');
    if (!top || !side) return;

    const options = Core.CURRENCIES.map(
      (c) => '<option value="' + c + '">' + c + '</option>'
    ).join('');

    top.innerHTML =
      '<nav class="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 w-full" aria-label="Principal">' +
      '<div class="px-4 md:px-6 max-w-screen-2xl mx-auto">' +
      '<div class="h-16 flex items-center justify-between gap-2">' +
      '<a href="dashboard.html" class="flex items-center gap-x-2 md:gap-x-3 flex-shrink-0">' +
      '<span class="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-xl" aria-hidden="true">🐒</span>' +
      '<span class="text-xl md:text-2xl font-semibold">Moneyto</span></a>' +
      '<div class="flex items-center gap-2">' +
      '<label class="sr-only" for="currency-select">Moneda en la que se muestran los totales</label>' +
      '<select id="currency-select" class="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-3xl px-3 h-10 text-sm font-semibold">' +
      options + '</select>' +
      '<button id="menu-toggle" type="button" class="md:hidden h-10 w-10 text-xl rounded-2xl hover:bg-gray-800" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu">☰</button>' +
      '</div></div></div>' +
      '<div id="mobile-menu" class="hidden md:hidden bg-gray-900 border-t border-gray-800 px-4 py-3 space-y-1">' +
      NAV.map((n) => link(n, 'block py-3 px-3 rounded-2xl text-sm')).join('') +
      '</div></nav>';

    side.innerHTML =
      '<nav class="px-4 py-6 space-y-1" aria-label="Secciones">' +
      NAV.map((n) => link(n, 'flex items-center gap-x-3 px-4 py-3 rounded-3xl text-sm')).join('') +
      '</nav>';

    const select = document.getElementById('currency-select');
    select.value = Store.getCurrency();
    select.addEventListener('change', () => Store.setCurrency(select.value));

    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('hidden') === false;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
  }

  render();
  window.addEventListener('DOMContentLoaded', function () {
    if (window.Notifier) window.Notifier.sync();
  });
})();
