(function () {
  'use strict';

  const Store = window.Store;
  const UI = window.UI;
  const esc = UI.esc;

  function usage(collection, name) {
    return Store.get(collection).filter((i) => i && i.categoria === name).length;
  }

  function renderSection(section) {
    const listName = section.getAttribute('data-section');
    const collection = section.getAttribute('data-collection');
    const ul = section.querySelector('ul');
    const cats = Store.get(listName);

    if (!cats.length) {
      ul.innerHTML = '<li class="text-gray-400 text-sm">No hay categorías. Agregá la primera arriba.</li>';
      return;
    }
    ul.innerHTML = cats
      .map((cat, index) => {
        const n = usage(collection, cat);
        return (
          '<li class="flex justify-between items-center gap-3 bg-gray-800 px-4 py-3 rounded-2xl">' +
          '<span class="min-w-0 text-sm"><span class="break-words">' + esc(cat) + '</span> ' +
          '<span class="text-gray-400 text-xs whitespace-nowrap">' + n + (n === 1 ? ' movimiento' : ' movimientos') + '</span></span>' +
          '<button type="button" data-index="' + index + '" class="p-2 rounded-xl hover:bg-gray-700 flex-shrink-0" aria-label="Eliminar la categoría ' + esc(cat) + '">🗑️</button></li>'
        );
      })
      .join('');
  }

  document.querySelectorAll('[data-section]').forEach((section) => {
    const listName = section.getAttribute('data-section');
    const collection = section.getAttribute('data-collection');
    const form = section.querySelector('form');
    const input = form.querySelector('input');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return UI.toast('Escribí el nombre de la categoría.', true);
      const before = Store.get(listName).length;
      const saved = Store.addCategory(listName, name);
      if (Store.get(listName).length === before) {
        return UI.toast('Ya existe la categoría “' + saved + '”.', true);
      }
      input.value = '';
      renderSection(section);
      UI.toast('Categoría agregada');
    });

    section.querySelector('ul').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-index]');
      if (!btn) return;
      const list = Store.get(listName);
      const name = list[Number(btn.getAttribute('data-index'))];
      if (name === undefined) return;
      const n = usage(collection, name);
      const message = n
        ? '“' + name + '” tiene ' + n + (n === 1 ? ' movimiento' : ' movimientos') + '. Se conservan, pero la categoría deja de aparecer en la lista. ¿Eliminarla?'
        : '¿Eliminar la categoría “' + name + '”?';
      if (!window.confirm(message)) return;
      list.splice(Number(btn.getAttribute('data-index')), 1);
      if (Store.set(listName, list)) {
        renderSection(section);
        UI.toast('Categoría eliminada');
      }
    });

    renderSection(section);
  });
})();
