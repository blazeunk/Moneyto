(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;

  const $ = (id) => document.getElementById(id);

  function backupText() {
    return JSON.stringify(Core.buildBackup(Store.exportAll()), null, 2);
  }

  function fileName() {
    return 'moneyto_backup_' + Core.toLocalDateString() + '.json';
  }

  function nativePlugins() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    const p = cap.Plugins || {};
    return p.Filesystem && p.Share ? { Filesystem: p.Filesystem, Share: p.Share } : null;
  }

  function downloadInBrowser(text, name) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportBackup() {
    const text = backupText();
    const name = fileName();
    const native = nativePlugins();

    // En Android, los WebView no descargan blobs: se escribe el archivo y se abre el menú de compartir.
    if (native) {
      try {
        const written = await native.Filesystem.writeFile({
          path: name,
          data: text,
          directory: 'CACHE',
          encoding: 'utf8',
        });
        await native.Share.share({
          title: 'Copia de seguridad de Moneyto',
          url: written.uri,
          dialogTitle: 'Guardar copia de seguridad',
        });
        return UI.toast('Copia lista para guardar');
      } catch (e) {
        if (/cancel/i.test(String((e && e.message) || e))) return;
        UI.toast('No se pudo compartir el archivo. Probá con “Copiar como texto”.', true);
        return;
      }
    }

    try {
      downloadInBrowser(text, name);
      UI.toast('Se descargó ' + name);
    } catch (e) {
      UI.toast('No se pudo descargar. Probá con “Copiar como texto”.', true);
    }
  }

  async function copyBackup() {
    const ok = await UI.copyText(backupText());
    UI.toast(ok ? 'Copia pegada en el portapapeles. Guardala en un archivo .json' : 'No se pudo copiar.', !ok);
  }

  function readFile(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function restoreBackup() {
    const input = $('restore-file');
    if (!input.files.length) return UI.toast('Primero elegí un archivo .json.', true);

    let text;
    try {
      text = await readFile(input.files[0]);
    } catch (e) {
      return UI.toast('No se pudo leer el archivo.', true);
    }

    const parsed = Core.parseBackup(text);
    if (!parsed.ok) return UI.toast(parsed.error, true);

    const d = parsed.data;
    const summary =
      d.expenses.length + ' gastos, ' + d.incomes.length + ' ingresos, ' + d.debts.length + ' deudas y ' +
      d.budgets.length + ' presupuestos';
    const extra = parsed.discarded
      ? '\n\nSe omitirán ' + parsed.discarded + ' registros dañados o incompletos.'
      : '';
    if (!window.confirm('La copia tiene ' + summary + '.' + extra + '\n\nSe reemplazarán todos los datos actuales. ¿Restaurar?')) return;

    Store.replaceAll(d);
    UI.toast('Datos restaurados. Recargando…');
    window.Notifier.sync();
    setTimeout(() => window.location.reload(), 1200);
  }

  function clearAll() {
    if (!window.confirm('Se borrarán todos tus gastos, ingresos, deudas y ajustes de este dispositivo. ¿Continuar?')) return;
    if (!window.confirm('Esta acción no se puede deshacer. ¿Seguro que querés borrar todo?')) return;
    Store.clearAll();
    window.Notifier.sync();
    UI.toast('Se borraron todos los datos');
    setTimeout(() => (window.location.href = 'dashboard.html'), 1000);
  }

  $('btn-export').addEventListener('click', exportBackup);
  $('btn-copy').addEventListener('click', copyBackup);
  $('btn-restore').addEventListener('click', restoreBackup);
  $('btn-clear').addEventListener('click', clearAll);
})();
