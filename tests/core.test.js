const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../www/js/core.js');

const RATES = { USD_ARS: 1000, USD_EUR: 0.9 };

test('escapeHtml neutraliza HTML y comillas', () => {
  assert.equal(
    Core.escapeHtml('<img src=x onerror="alert(1)">\'&'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;'
  );
  assert.equal(Core.escapeHtml(null), '');
  assert.equal(Core.escapeHtml(undefined), '');
  assert.equal(Core.escapeHtml(42), '42');
});

test('toLocalDateString usa la fecha local y no UTC', () => {
  // 23:30 hora local: con toISOString() en UTC-3 daría el día siguiente.
  const d = new Date(2026, 9, 9, 23, 30);
  assert.equal(Core.toLocalDateString(d), '2026-10-09');
  assert.equal(Core.monthKey(d), '2026-10');
});

test('previousMonthKey cruza el cambio de año', () => {
  assert.equal(Core.previousMonthKey(new Date(2026, 0, 31)), '2025-12');
  assert.equal(Core.previousMonthKey(new Date(2026, 2, 31)), '2026-02');
});

test('isValidDate rechaza fechas imposibles', () => {
  assert.equal(Core.isValidDate('2026-02-28'), true);
  assert.equal(Core.isValidDate('2026-02-30'), false);
  assert.equal(Core.isValidDate('2026-13-01'), false);
  assert.equal(Core.isValidDate('hoy'), false);
  assert.equal(Core.isValidDate(null), false);
});

test('daysUntil cuenta días de calendario', () => {
  assert.equal(Core.daysUntil('2026-10-12', '2026-10-09'), 3);
  assert.equal(Core.daysUntil('2026-10-09', '2026-10-09'), 0);
  assert.equal(Core.daysUntil('2026-10-07', '2026-10-09'), -2);
  assert.equal(Core.daysUntil('2027-01-01', '2026-12-31'), 1);
});

test('parseAmount acepta coma decimal y rechaza inválidos', () => {
  assert.equal(Core.parseAmount('12,5'), 12.5);
  assert.equal(Core.parseAmount(3.456), 3.46);
  assert.equal(Core.parseAmount(0), null);
  assert.equal(Core.parseAmount(-5), null);
  assert.equal(Core.parseAmount('abc'), null);
  assert.equal(Core.parseAmount(Infinity), null);
});

test('makeId no repite ids consecutivos', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(Core.makeId());
  assert.equal(ids.size, 500);
});

test('convert: misma moneda, directa, inversa y vía USD', () => {
  assert.equal(Core.convert(10, 'USD', 'USD', RATES), 10);
  assert.equal(Core.convert(2, 'USD', 'ARS', RATES), 2000);
  assert.equal(Core.convert(2000, 'ARS', 'USD', RATES), 2);
  // EUR -> ARS: EUR -> USD (inversa de USD_EUR) -> ARS
  assert.ok(Math.abs(Core.convert(9, 'EUR', 'ARS', RATES) - 10000) < 1e-6);
});

test('convert devuelve null si no hay tasa en vez de inventar un valor', () => {
  assert.equal(Core.convert(10, 'EUR', 'ARS', { USD_EUR: 0.9 }), null);
  assert.equal(Core.convert(10, 'USD', 'EUR', {}), null);
  assert.equal(Core.convert(NaN, 'USD', 'EUR', RATES), null);
});

test('sumConverted suma monedas distintas y cuenta las que no pudo convertir', () => {
  const items = [
    { monto: 10, moneda: 'USD' },
    { monto: 5000, moneda: 'ARS' },
    { monto: 3, moneda: 'EUR' },
  ];
  const ok = Core.sumConverted(items, 'USD', RATES);
  assert.ok(Math.abs(ok.total - (10 + 5 + 3 / 0.9)) < 1e-6);
  assert.equal(ok.missing, 0);

  const partial = Core.sumConverted(items, 'USD', { USD_ARS: 1000 });
  assert.equal(partial.missing, 1);
  assert.equal(partial.total, 15);
});

test('groupByCategory agrupa y convierte', () => {
  const items = [
    { monto: 10, moneda: 'USD', categoria: 'Comida' },
    { monto: 1000, moneda: 'ARS', categoria: 'Comida' },
    { monto: 4, moneda: 'USD', categoria: 'Transporte' },
  ];
  const { totals, missing } = Core.groupByCategory(items, 'USD', RATES);
  assert.equal(missing, 0);
  assert.equal(totals.Comida, 11);
  assert.equal(totals.Transporte, 4);
});

test('filterByMonth filtra por mes y "all" devuelve todo', () => {
  const items = [{ fecha: '2026-09-30' }, { fecha: '2026-10-01' }, { fecha: '2026-10-31' }];
  assert.equal(Core.filterByMonth(items, '2026-10').length, 2);
  assert.equal(Core.filterByMonth(items, 'all').length, 3);
});

test('budgetStatus solo cuenta el mes elegido y convierte monedas', () => {
  const budget = { categoria: 'Comida', limite: 100, moneda: 'USD' };
  const expenses = [
    { fecha: '2026-10-02', monto: 40, moneda: 'USD', categoria: 'Comida' },
    { fecha: '2026-10-05', monto: 10000, moneda: 'ARS', categoria: 'Comida' }, // 10 USD
    { fecha: '2026-09-20', monto: 500, moneda: 'USD', categoria: 'Comida' }, // otro mes
    { fecha: '2026-10-06', monto: 99, moneda: 'USD', categoria: 'Transporte' }, // otra categoría
  ];
  const s = Core.budgetStatus(budget, expenses, '2026-10', RATES);
  assert.equal(s.spent, 50);
  assert.equal(s.remaining, 50);
  assert.equal(s.percent, 50);
  assert.equal(s.missing, 0);
});

test('budgetStatus marca más de 100% cuando se pasa del límite', () => {
  const budget = { categoria: 'Comida', limite: 10, moneda: 'USD' };
  const expenses = [{ fecha: '2026-10-02', monto: 25, moneda: 'USD', categoria: 'Comida' }];
  const s = Core.budgetStatus(budget, expenses, '2026-10', RATES);
  assert.equal(s.percent, 250);
  assert.equal(s.remaining, -15);
});

test('debtStatus distingue pagada, vencida, hoy, pronto y pendiente', () => {
  const today = '2026-10-09';
  const base = { pagado: false };
  assert.equal(Core.debtStatus({ pagado: true, fechaVencimiento: '2020-01-01' }, today).key, 'paid');
  assert.equal(Core.debtStatus({ ...base, fechaVencimiento: '2026-10-08' }, today).key, 'overdue');
  assert.equal(Core.debtStatus({ ...base, fechaVencimiento: '2026-10-09' }, today).key, 'today');
  assert.equal(Core.debtStatus({ ...base, fechaVencimiento: '2026-10-11' }, today).key, 'soon');
  assert.equal(Core.debtStatus({ ...base, fechaVencimiento: '2026-11-01' }, today).key, 'pending');
});

test('debtsNeedingAttention incluye las vencidas (el bug original las ignoraba)', () => {
  const debts = [
    { id: 1, pagado: false, fechaVencimiento: '2026-10-01' }, // vencida
    { id: 2, pagado: false, fechaVencimiento: '2026-10-11' }, // en 2 días
    { id: 3, pagado: false, fechaVencimiento: '2026-12-01' }, // lejos
    { id: 4, pagado: true, fechaVencimiento: '2026-10-01' }, // pagada
  ];
  const ids = Core.debtsNeedingAttention(debts, '2026-10-09', 3).map((d) => d.id);
  assert.deepEqual(ids, [1, 2]);
});

test('normalizeTransaction limpia y descarta registros inválidos', () => {
  const ok = Core.normalizeTransaction(
    { id: 5, fecha: '2026-10-01', monto: '12,5', moneda: 'XXX', categoria: '  Comida ', descripcion: ' hola ' },
    'ARS'
  );
  assert.deepEqual(ok, { id: 5, fecha: '2026-10-01', monto: 12.5, moneda: 'ARS', categoria: 'Comida', descripcion: 'hola' });
  assert.equal(Core.normalizeTransaction({ fecha: '2026-10-01', monto: -1 }), null);
  assert.equal(Core.normalizeTransaction({ fecha: 'mal', monto: 1 }), null);
  assert.equal(Core.normalizeTransaction(null), null);
});

test('normalizeDebt y normalizeBudget agregan id y moneda a datos viejos', () => {
  const debt = Core.normalizeDebt({ concepto: 'Tarjeta', monto: 100, moneda: 'USD', fechaVencimiento: '2026-10-20' });
  assert.ok(Number.isFinite(debt.id));
  assert.equal(debt.pagado, false);
  const budget = Core.normalizeBudget({ categoria: 'Comida', limite: 50 }, 'ARS');
  assert.equal(budget.moneda, 'ARS');
  assert.ok(Number.isFinite(budget.id));
});

test('normalizeRates descarta tasas inválidas', () => {
  const r = Core.normalizeRates({ USD_ARS: 1000, USD_USD: 1, EUR_XXX: 2, ARS_USD: -1, USD_EUR: '0.9' });
  assert.deepEqual(r, { USD_ARS: 1000, USD_EUR: 0.9 });
  assert.equal(Core.normalizeRates('hola'), null);
});

test('normalizeCategories quita duplicados sin importar mayúsculas', () => {
  assert.deepEqual(Core.normalizeCategories(['Comida', 'comida', ' Ocio '], []), ['Comida', 'Ocio']);
  assert.deepEqual(Core.normalizeCategories('x', ['A']), ['A']);
});

test('buildBackup + parseBackup (v2) hacen ida y vuelta', () => {
  const data = {
    expenses: [{ id: 1, fecha: '2026-10-01', monto: 10, moneda: 'USD', categoria: 'Comida', descripcion: '' }],
    incomes: [],
    debts: [],
    budgets: [],
    expenseCategories: ['Comida'],
    incomeCategories: ['Salario'],
    exchangeRates: { USD_ARS: 1000 },
    shoppingList: [],
    preferredCurrency: 'ARS',
  };
  const text = JSON.stringify(Core.buildBackup(data));
  const parsed = Core.parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.discarded, 0);
  assert.equal(parsed.data.expenses.length, 1);
  assert.equal(parsed.data.preferredCurrency, 'ARS');
  assert.deepEqual(parsed.data.exchangeRates, { USD_ARS: 1000 });
});

test('parseBackup lee el formato v1 de la app anterior (strings JSON)', () => {
  const v1 = {
    version: '1.0',
    fecha: '2026-01-01T00:00:00.000Z',
    expenses: JSON.stringify([{ id: 1, fecha: '2026-01-01', monto: 5, moneda: 'USD', categoria: 'Comida' }]),
    incomes: null,
    debts: JSON.stringify([{ concepto: 'Luz', monto: 20, moneda: 'ARS', fechaVencimiento: '2026-02-01', pagado: false }]),
    budgets: JSON.stringify([{ categoria: 'Comida', limite: 100 }]),
    expense_categories: JSON.stringify(['Comida']),
    income_categories: null,
    exchange_rates: JSON.stringify({ USD_ARS: 900 }),
    shopping_list: null,
    preferred_currency: 'ARS',
  };
  const parsed = Core.parseBackup(JSON.stringify(v1));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.expenses.length, 1);
  assert.equal(parsed.data.debts.length, 1);
  assert.equal(parsed.data.budgets[0].moneda, 'ARS');
  assert.deepEqual(parsed.data.incomeCategories, Core.DEFAULT_INCOME_CATEGORIES);
});

test('parseBackup descarta registros corruptos y los cuenta', () => {
  const text = JSON.stringify({
    version: 2,
    data: {
      expenses: [
        { id: 1, fecha: '2026-10-01', monto: 10, moneda: 'USD', categoria: 'A' },
        { fecha: 'mal', monto: 10 },
        'basura',
      ],
    },
  });
  const parsed = Core.parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.expenses.length, 1);
  assert.equal(parsed.discarded, 2);
});

test('parseBackup rechaza archivos que no son una copia de Moneyto', () => {
  assert.equal(Core.parseBackup('no es json').ok, false);
  assert.equal(Core.parseBackup('[1,2,3]').ok, false);
  assert.equal(Core.parseBackup('{"hola": "mundo"}').ok, false);
});
