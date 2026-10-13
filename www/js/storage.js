/**
 * Moneyto - almacenamiento local.
 *
 * Mantiene las claves `gp_*` de la versión anterior para que quien ya tenga
 * datos cargados no los pierda. Toda lectura/escritura pasa por acá, así el
 * resto de la app no repite JSON.parse(localStorage...) en cada archivo.
 */
(function () {
  'use strict';

  const Core = window.MoneytoCore;

  const KEYS = {
    expenses: 'gp_expenses',
    incomes: 'gp_incomes',
    debts: 'gp_debts',
    budgets: 'gp_budgets',
    expenseCategories: 'gp_expense_categories',
    incomeCategories: 'gp_income_categories',
    exchangeRates: 'gp_exchange_rates',
    shoppingList: 'gp_shopping_list',
    currency: 'gp_moneda_preferida',
    lastReminderDay: 'gp_last_reminder_day',
  };

  const DEFAULTS = {
    expenses: () => [],
    incomes: () => [],
    debts: () => [],
    budgets: () => [],
    shoppingList: () => [],
    expenseCategories: () => Core.DEFAULT_EXPENSE_CATEGORIES.slice(),
    incomeCategories: () => Core.DEFAULT_INCOME_CATEGORIES.slice(),
  };

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      window.dispatchEvent(new CustomEvent('moneyto:storage-error'));
      return false;
    }
  }

  function detectCurrency() {
    const locale = navigator.language || 'en-US';
    const country = (locale.split('-')[1] || '').toUpperCase();
    if (country === 'AR') return 'ARS';
    if (['ES', 'FR', 'DE', 'IT', 'PT'].includes(country)) return 'EUR';
    return 'USD';
  }

  const Store = {
    KEYS,

    /** Colecciones: expenses, incomes, debts, budgets, shoppingList y categorías. */
    get(name) {
      const fallback = DEFAULTS[name]();
      const value = readJson(KEYS[name]);
      return Array.isArray(value) ? value : fallback;
    },

    set(name, value) {
      return writeJson(KEYS[name], value);
    },

    getCurrency() {
      let stored = null;
      try {
        stored = localStorage.getItem(KEYS.currency);
      } catch (e) {
        stored = null;
      }
      if (stored && Core.CURRENCIES.includes(stored)) return stored;
      return detectCurrency();
    },

    setCurrency(currency) {
      if (!Core.CURRENCIES.includes(currency)) return;
      try {
        localStorage.setItem(KEYS.currency, currency);
      } catch (e) {
        window.dispatchEvent(new CustomEvent('moneyto:storage-error'));
      }
      document.dispatchEvent(new CustomEvent('moneyto:currency', { detail: currency }));
    },

    /** Tasas guardadas por el usuario, o las de ejemplo si nunca guardó ninguna. */
    getRates() {
      const saved = Core.normalizeRates(readJson(KEYS.exchangeRates));
      return saved && Object.keys(saved).length ? saved : Object.assign({}, Core.DEFAULT_RATES);
    },

    hasCustomRates() {
      const saved = Core.normalizeRates(readJson(KEYS.exchangeRates));
      return !!(saved && Object.keys(saved).length);
    },

    setRates(rates) {
      return writeJson(KEYS.exchangeRates, rates);
    },

    /** Todo el contenido, listo para armar una copia de seguridad. */
    exportAll() {
      return {
        expenses: Store.get('expenses'),
        incomes: Store.get('incomes'),
        debts: Store.get('debts'),
        budgets: Store.get('budgets'),
        expenseCategories: Store.get('expenseCategories'),
        incomeCategories: Store.get('incomeCategories'),
        exchangeRates: Store.hasCustomRates() ? Store.getRates() : null,
        shoppingList: Store.get('shoppingList'),
        preferredCurrency: Store.getCurrency(),
      };
    },

    /** Reemplaza todo con datos ya validados por Core.parseBackup. */
    replaceAll(data) {
      Store.set('expenses', data.expenses);
      Store.set('incomes', data.incomes);
      Store.set('debts', data.debts);
      Store.set('budgets', data.budgets);
      Store.set('expenseCategories', data.expenseCategories);
      Store.set('incomeCategories', data.incomeCategories);
      Store.set('shoppingList', data.shoppingList);
      if (data.exchangeRates && Object.keys(data.exchangeRates).length) {
        Store.setRates(data.exchangeRates);
      } else {
        localStorage.removeItem(KEYS.exchangeRates);
      }
      localStorage.setItem(KEYS.currency, data.preferredCurrency);
    },

    clearAll() {
      Object.keys(KEYS).forEach((k) => localStorage.removeItem(KEYS[k]));
    },

    /** Agrega una categoría si no existe (sin distinguir mayúsculas). Devuelve el nombre final. */
    addCategory(listName, rawName) {
      const name = String(rawName || '').trim().slice(0, 60);
      if (!name) return null;
      const list = Store.get(listName);
      const existing = list.find((c) => c.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      list.push(name);
      Store.set(listName, list);
      return name;
    },
  };

  /**
   * Migración de la versión anterior: deudas, presupuestos y lista de compras
   * no tenían `id` (se identificaban por posición) y los presupuestos no
   * guardaban moneda.
   */
  function migrate() {
    const currency = Store.getCurrency();
    ['debts', 'budgets', 'shoppingList'].forEach((name) => {
      const list = readJson(KEYS[name]);
      if (!Array.isArray(list)) return;
      let changed = false;
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        if (!Number.isFinite(item.id)) {
          item.id = Core.makeId();
          changed = true;
        }
        if (name === 'budgets' && !item.moneda) {
          item.moneda = currency;
          changed = true;
        }
      });
      if (changed) writeJson(KEYS[name], list);
    });
  }

  migrate();
  window.Store = Store;
})();
