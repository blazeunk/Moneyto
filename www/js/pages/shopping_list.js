(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  const $ = (id) => document.getElementById(id);
  const SUGGESTED = ['Supermercado', 'Farmacia', 'Ropa', 'Electrónica', 'Hogar', 'Otros'];

  function items() {
    return Store.get('shoppingList').filter((i) => i && i.name && Number.isFinite(i.price));
  }

  function render() {
    const list = items();
    const currency = Store.getCurrency();
    const total = list.reduce((sum, i) => sum + i.price, 0);

    $('subtotal').textContent = list.length ? UI.formatMoney(total, currency) : '';
    $('currency-note').textContent = 'Se guardará como un gasto en ' + currency + '. Podés cambiar la moneda arriba.';

    $('items').innerHTML = list.length
      ? list
          .map(
            (i) =>
              '<li class="flex justify-between items-center gap-3 bg-gray-800 px-4 py-3 rounded-2xl">' +
              '<span class="min-w-0"><span class="font-medium break-words">' + esc(i.name) + '</span> ' +
              '<span class="text-emerald-300 whitespace-nowrap">' + esc(UI.formatMoney(i.price, currency)) + '</span></span>' +
              '<button type="button" data-id="' + i.id + '" class="p-2 rounded-xl hover:bg-gray-700 flex-shrink-0" aria-label="Quitar ' + esc(i.name) + '">🗑️</button></li>'
          )
          .join('')
      : '<li class="text-center text-gray-400 py-8 text-sm">Todavía no hay productos. Agregá el primero arriba.</li>';
  }

  function fillCategories() {
    const own = Store.get('expenseCategories');
    const all = own.concat(SUGGESTED.filter((s) => !own.some((o) => o.toLowerCase() === s.toLowerCase())));
    UI.fillSelect($('category-select'), all, own.includes('Supermercado') || !own.length ? 'Supermercado' : own[0]);
  }

  function addItem(e) {
    e.preventDefault();
    const name = $('item-name').value.trim();
    const price = Core.parseAmount($('item-price').value);
    if (!name) return UI.toast('Escribí el nombre del producto.', true);
    if (price === null) return UI.toast('Ingresá un precio mayor a 0.', true);

    const list = items();
    list.push({ id: Core.makeId(), name: name.slice(0, 100), price });
    if (!Store.set('shoppingList', list)) return;
    $('item-name').value = '';
    $('item-price').value = '';
    $('item-name').focus();
    $('result').classList.add('hidden');
    render();
  }

  function removeItem(id) {
    // Guarda siempre, incluso cuando la lista queda vacía.
    const list = items().filter((i) => String(i.id) !== id);
    if (Store.set('shoppingList', list)) render();
  }

  function clearAll() {
    if (!items().length) return;
    if (!window.confirm('¿Vaciar toda la lista de compras?')) return;
    if (Store.set('shoppingList', [])) {
      render();
      UI.toast('Lista vaciada');
    }
  }

  function finish() {
    const list = items();
    if (!list.length) return UI.toast('Agregá al menos un producto.', true);

    const currency = Store.getCurrency();
    const total = Math.round(list.reduce((sum, i) => sum + i.price, 0) * 100) / 100;
    let description = 'Compra: ' + list.map((i) => i.name + ' (' + UI.formatMoney(i.price, currency) + ')').join(', ');
    if (description.length > 300) description = description.slice(0, 297) + '…';

    const typed = $('custom-category').value.trim();
    const category = Store.addCategory('expenseCategories', typed || $('category-select').value);
    if (!category) return UI.toast('Elegí o escribí una categoría.', true);

    const expenses = Store.get('expenses');
    expenses.unshift({
      id: Core.makeId(),
      fecha: Core.toLocalDateString(),
      monto: total,
      moneda: currency,
      categoria: category,
      descripcion: description,
    });
    if (!Store.set('expenses', expenses)) return;
    Store.set('shoppingList', []);

    $('custom-category').value = '';
    fillCategories();
    render();
    const result = $('result');
    result.classList.remove('hidden');
    result.innerHTML =
      'Compra guardada: ' + esc(UI.formatMoney(total, currency)) + ' en “' + esc(category) + '”. ' +
      '<a class="underline text-emerald-200" href="expenses.html">Ver en Gastos</a>';
  }

  $('add-form').addEventListener('submit', addItem);
  $('btn-clear').addEventListener('click', clearAll);
  $('btn-finish').addEventListener('click', finish);
  $('items').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) removeItem(btn.getAttribute('data-id'));
  });

  UI.onCurrencyChange(render);
  fillCategories();
  render();
})();
