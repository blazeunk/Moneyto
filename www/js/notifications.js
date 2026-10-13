/**
 * Moneyto - recordatorios de vencimiento de deudas.
 *
 * En la app de Android usa @capacitor/local-notifications, que programa los
 * avisos en el sistema aunque la app esté cerrada. La API `Notification` del
 * navegador no funciona de forma confiable dentro de un WebView.
 * En el navegador queda un aviso simple, una vez por día.
 *
 * Avisa el día anterior y el mismo día del vencimiento, a las 9:00.
 */
(function () {
  'use strict';

  const Core = window.MoneytoCore;
  const Store = window.Store;
  const UI = window.UI;

  function nativePlugin() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.LocalNotifications) || null;
  }

  function unpaid() {
    return Store.get('debts').filter((d) => !d.pagado && Core.isValidDate(d.fechaVencimiento));
  }

  async function syncNative(plugin) {
    const perm = await plugin.checkPermissions();
    if (perm.display !== 'granted') return;

    const pending = await plugin.getPending();
    if (pending.notifications && pending.notifications.length) {
      await plugin.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    const now = Date.now();
    const notifications = [];
    unpaid().forEach((debt) => {
      const [y, m, d] = debt.fechaVencimiento.split('-').map(Number);
      const base = (debt.id % 100000000) * 10; // cabe en un entero de 32 bits
      [
        [1, 'mañana'],
        [0, 'hoy'],
      ].forEach(([daysBefore, when], i) => {
        const at = new Date(y, m - 1, d - daysBefore, 9, 0, 0);
        if (at.getTime() > now) {
          notifications.push({
            id: base + i,
            title: 'Deuda: ' + debt.concepto,
            body: 'Vence ' + when + ': ' + UI.formatMoney(debt.monto, debt.moneda),
            schedule: { at },
          });
        }
      });
    });
    if (notifications.length) await plugin.schedule({ notifications });
  }

  function syncWeb() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const today = Core.toLocalDateString();
    if (localStorage.getItem(Store.KEYS.lastReminderDay) === today) return;
    const due = Core.debtsNeedingAttention(unpaid(), today, 3);
    if (!due.length) return;
    due.forEach((debt) => {
      const status = Core.debtStatus(debt, today);
      new Notification('Deuda: ' + debt.concepto, {
        body: status.label + ' · ' + UI.formatMoney(debt.monto, debt.moneda),
      });
    });
    localStorage.setItem(Store.KEYS.lastReminderDay, today);
  }

  const Notifier = {
    /** Pide permiso. Llamar desde una acción del usuario (por ejemplo, al guardar una deuda). */
    async requestPermission() {
      try {
        const native = nativePlugin();
        if (native) {
          const result = await native.requestPermissions();
          return result.display === 'granted';
        }
        if ('Notification' in window) {
          if (Notification.permission === 'granted') return true;
          return (await Notification.requestPermission()) === 'granted';
        }
      } catch (e) {
        /* sin permiso o sin soporte: la app sigue funcionando sin avisos */
      }
      return false;
    },

    /** Reprograma los avisos según las deudas actuales. */
    async sync() {
      try {
        const native = nativePlugin();
        if (native) await syncNative(native);
        else syncWeb();
      } catch (e) {
        /* los recordatorios son opcionales: nunca deben romper la página */
      }
    },
  };

  window.Notifier = Notifier;
})();
