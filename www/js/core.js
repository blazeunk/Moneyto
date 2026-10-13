/**
 * Moneyto - núcleo de lógica pura.
 *
 * No toca el DOM ni localStorage, así que se puede testear en Node
 * (`npm test`) y también se carga en el navegador como `MoneytoCore`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MoneytoCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CURRENCIES = ['USD', 'EUR', 'ARS'];

  // Tasas de ejemplo. La app avisa al usuario que las actualice.
  const DEFAULT_RATES = Object.freeze({
    USD_EUR: 0.92,
    USD_ARS: 980,
    EUR_USD: 1.09,
    ARS_USD: 0.00102,
  });

  const BACKUP_VERSION = 2;

  // ---------------------------------------------------------------- texto

  /** Escapa texto para insertarlo de forma segura dentro de HTML. */
  function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value === null || value === undefined ? '' : value).replace(
      /[&<>"']/g,
      (c) => map[c]
    );
  }

  // ---------------------------------------------------------------- fechas

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Fecha local en formato YYYY-MM-DD.
   * `toISOString()` devuelve UTC y en Argentina (UTC-3) "adelanta" el día
   * después de las 21:00, por eso se arma con los getters locales.
   */
  function toLocalDateString(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function monthKey(date) {
    return toLocalDateString(date).slice(0, 7);
  }

  function previousMonthKey(date) {
    const d = date ? new Date(date.getTime()) : new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return monthKey(d);
  }

  function isValidDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  /** Días entre `today` y `dateStr` (negativo si ya pasó). Ignora husos horarios. */
  function daysUntil(dateStr, today) {
    const ref = today || toLocalDateString();
    const [y1, m1, d1] = dateStr.split('-').map(Number);
    const [y2, m2, d2] = ref.split('-').map(Number);
    return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
  }

  // ---------------------------------------------------------------- números

  /** Devuelve un monto positivo con 2 decimales, o null si no es válido. */
  function parseAmount(value) {
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  let seq = 0;
  function makeId() {
    seq = (seq + 1) % 1000;
    return Date.now() * 1000 + seq;
  }

  // ---------------------------------------------------------------- monedas

  /**
   * Convierte `amount` de `from` a `to` con las tasas dadas.
   * Prueba tasa directa, tasa inversa y por último pasa por USD.
   * Devuelve null si no hay forma de convertir (en vez de inventar un número).
   */
  function convert(amount, from, to, rates) {
    if (!Number.isFinite(amount)) return null;
    if (from === to) return amount;
    const r = rates || {};
    const direct = r[from + '_' + to];
    if (direct > 0) return amount * direct;
    const inverse = r[to + '_' + from];
    if (inverse > 0) return amount / inverse;
    if (from !== 'USD' && to !== 'USD') {
      const viaUsd = convert(amount, from, 'USD', r);
      return viaUsd === null ? null : convert(viaUsd, 'USD', to, r);
    }
    return null;
  }

  /** Suma una lista de {monto, moneda} en la moneda `to`. */
  function sumConverted(items, to, rates) {
    let total = 0;
    let missing = 0;
    items.forEach((item) => {
      const value = convert(item.monto, item.moneda, to, rates);
      if (value === null) missing += 1;
      else total += value;
    });
    return { total, missing };
  }

  /** Agrupa por categoría, convirtiendo todo a `to`. */
  function groupByCategory(items, to, rates) {
    const totals = {};
    let missing = 0;
    items.forEach((item) => {
      const value = convert(item.monto, item.moneda, to, rates);
      if (value === null) {
        missing += 1;
        return;
      }
      const cat = item.categoria || 'Sin categoría';
      totals[cat] = (totals[cat] || 0) + value;
    });
    return { totals, missing };
  }

  /** Filtra por mes 'YYYY-MM'. Con 'all' devuelve todo. */
  function filterByMonth(items, month) {
    if (!month || month === 'all') return items.slice();
    return items.filter((item) => String(item.fecha || '').slice(0, 7) === month);
  }

  // ---------------------------------------------------------------- presupuestos

  /**
   * Estado de un presupuesto mensual: gasto del mes (convertido a la moneda
   * del presupuesto), restante y porcentaje usado.
   */
  function budgetStatus(budget, expenses, month, rates) {
    const inMonth = filterByMonth(expenses, month).filter((e) => e.categoria === budget.categoria);
    const { total, missing } = sumConverted(inMonth, budget.moneda, rates);
    const spent = Math.round(total * 100) / 100;
    const remaining = Math.round((budget.limite - spent) * 100) / 100;
    const percent = budget.limite > 0 ? Math.round((spent / budget.limite) * 100) : 0;
    return { spent, remaining, percent, missing };
  }

  // ---------------------------------------------------------------- deudas

  /** Estado visible de una deuda según la fecha local de hoy. */
  function debtStatus(debt, today) {
    if (debt.pagado) return { key: 'paid', label: 'Pagada', days: null };
    const days = daysUntil(debt.fechaVencimiento, today);
    if (days < 0) return { key: 'overdue', label: 'Vencida hace ' + -days + (days === -1 ? ' día' : ' días'), days };
    if (days === 0) return { key: 'today', label: 'Vence hoy', days };
    if (days <= 3) return { key: 'soon', label: 'Vence en ' + days + (days === 1 ? ' día' : ' días'), days };
    return { key: 'pending', label: 'Pendiente', days };
  }

  /** Deudas impagas vencidas o que vencen en los próximos `withinDays` días. */
  function debtsNeedingAttention(debts, today, withinDays) {
    const limit = withinDays === undefined ? 3 : withinDays;
    return debts
      .filter((d) => !d.pagado && isValidDate(d.fechaVencimiento) && daysUntil(d.fechaVencimiento, today) <= limit)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  }

  // ---------------------------------------------------------------- normalización

  function cleanText(value, max) {
    return String(value === null || value === undefined ? '' : value).trim().slice(0, max);
  }

  function normalizeTransaction(raw, fallbackCurrency) {
    if (!raw || typeof raw !== 'object') return null;
    const monto = parseAmount(raw.monto);
    if (monto === null || !isValidDate(raw.fecha)) return null;
    return {
      id: Number.isFinite(raw.id) ? raw.id : makeId(),
      fecha: raw.fecha,
      monto,
      moneda: CURRENCIES.includes(raw.moneda) ? raw.moneda : fallbackCurrency || 'USD',
      categoria: cleanText(raw.categoria, 60) || 'Sin categoría',
      descripcion: cleanText(raw.descripcion, 300),
    };
  }

  function normalizeDebt(raw, fallbackCurrency) {
    if (!raw || typeof raw !== 'object') return null;
    const monto = parseAmount(raw.monto);
    const concepto = cleanText(raw.concepto, 100);
    if (monto === null || !concepto || !isValidDate(raw.fechaVencimiento)) return null;
    return {
      id: Number.isFinite(raw.id) ? raw.id : makeId(),
      concepto,
      monto,
      moneda: CURRENCIES.includes(raw.moneda) ? raw.moneda : fallbackCurrency || 'USD',
      fechaVencimiento: raw.fechaVencimiento,
      descripcion: cleanText(raw.descripcion, 300),
      pagado: raw.pagado === true,
    };
  }

  function normalizeBudget(raw, fallbackCurrency) {
    if (!raw || typeof raw !== 'object') return null;
    const limite = parseAmount(raw.limite);
    const categoria = cleanText(raw.categoria, 60);
    if (limite === null || !categoria) return null;
    return {
      id: Number.isFinite(raw.id) ? raw.id : makeId(),
      categoria,
      limite,
      moneda: CURRENCIES.includes(raw.moneda) ? raw.moneda : fallbackCurrency || 'USD',
    };
  }

  function normalizeCategories(list, fallback) {
    if (!Array.isArray(list)) return fallback.slice();
    const seen = new Set();
    const out = [];
    list.forEach((c) => {
      const name = cleanText(c, 60);
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    });
    return out;
  }

  function normalizeRates(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    Object.keys(raw).forEach((key) => {
      const [from, to] = key.split('_');
      const value = Number(raw[key]);
      if (CURRENCIES.includes(from) && CURRENCIES.includes(to) && from !== to && value > 0 && Number.isFinite(value)) {
        out[key] = value;
      }
    });
    return out;
  }

  function normalizeShoppingItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const price = parseAmount(raw.price);
    const name = cleanText(raw.name, 100);
    if (price === null || !name) return null;
    return { id: Number.isFinite(raw.id) ? raw.id : makeId(), name, price };
  }

  // ---------------------------------------------------------------- backups

  const DEFAULT_EXPENSE_CATEGORIES = ['Comida', 'Alquiler', 'Transporte'];
  const DEFAULT_INCOME_CATEGORIES = ['Salario', 'Freelance', 'Inversión'];

  /** Arma el objeto de copia de seguridad (versión 2). */
  function buildBackup(data, now) {
    return {
      app: 'moneyto',
      version: BACKUP_VERSION,
      fecha: (now || new Date()).toISOString(),
      data: {
        expenses: data.expenses || [],
        incomes: data.incomes || [],
        debts: data.debts || [],
        budgets: data.budgets || [],
        expenseCategories: data.expenseCategories || [],
        incomeCategories: data.incomeCategories || [],
        exchangeRates: data.exchangeRates || null,
        shoppingList: data.shoppingList || [],
        preferredCurrency: data.preferredCurrency || 'USD',
      },
    };
  }

  /** Los backups v1 guardaban cada colección como string JSON. */
  function parseMaybeJson(value) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Lee y valida un backup (v1 o v2). Descarta registros inválidos en vez de
   * romper la app, y cuenta cuántos descartó para avisarle al usuario.
   */
  function parseBackup(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'El archivo no es un JSON válido.' };
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, error: 'El archivo no tiene el formato de una copia de Moneyto.' };
    }

    let src;
    if (obj.version === 2 && obj.data && typeof obj.data === 'object') {
      src = obj.data;
    } else if (obj.version === 1 || 'expenses' in obj || 'incomes' in obj) {
      src = {
        expenses: parseMaybeJson(obj.expenses),
        incomes: parseMaybeJson(obj.incomes),
        debts: parseMaybeJson(obj.debts),
        budgets: parseMaybeJson(obj.budgets),
        expenseCategories: parseMaybeJson(obj.expense_categories),
        incomeCategories: parseMaybeJson(obj.income_categories),
        exchangeRates: parseMaybeJson(obj.exchange_rates),
        shoppingList: parseMaybeJson(obj.shopping_list),
        preferredCurrency: obj.preferred_currency,
      };
    } else {
      return { ok: false, error: 'El archivo no tiene el formato de una copia de Moneyto.' };
    }

    let discarded = 0;
    const currency = CURRENCIES.includes(src.preferredCurrency) ? src.preferredCurrency : 'USD';

    function list(value, normalizer) {
      if (!Array.isArray(value)) return [];
      const out = [];
      value.forEach((item) => {
        const n = normalizer(item, currency);
        if (n) out.push(n);
        else discarded += 1;
      });
      return out;
    }

    const data = {
      expenses: list(src.expenses, normalizeTransaction),
      incomes: list(src.incomes, normalizeTransaction),
      debts: list(src.debts, normalizeDebt),
      budgets: list(src.budgets, normalizeBudget),
      expenseCategories: normalizeCategories(src.expenseCategories, DEFAULT_EXPENSE_CATEGORIES),
      incomeCategories: normalizeCategories(src.incomeCategories, DEFAULT_INCOME_CATEGORIES),
      exchangeRates: normalizeRates(src.exchangeRates),
      shoppingList: list(src.shoppingList, normalizeShoppingItem),
      preferredCurrency: currency,
    };
    return { ok: true, data, discarded };
  }

  return {
    CURRENCIES,
    DEFAULT_RATES,
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES,
    BACKUP_VERSION,
    escapeHtml,
    toLocalDateString,
    monthKey,
    previousMonthKey,
    isValidDate,
    daysUntil,
    parseAmount,
    makeId,
    convert,
    sumConverted,
    groupByCategory,
    filterByMonth,
    budgetStatus,
    debtStatus,
    debtsNeedingAttention,
    normalizeTransaction,
    normalizeDebt,
    normalizeBudget,
    normalizeCategories,
    normalizeRates,
    normalizeShoppingItem,
    buildBackup,
    parseBackup,
  };
});
