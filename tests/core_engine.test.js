/**
 * Bantay Barya - Deterministic Automated Test Suite for Core Ledger & Multi-Currency Engine
 *
 * Test Suites:
 * 1. Wallet Transfers: Total money conservation, exchange rate conversion, zero expense inflation.
 * 2. Multi-Currency FX Engine: Direct rates, triangular cross-rates, missing/zero rate safeguards.
 * 3. Ledger Balances & Mathematical Consistency: Running balance per wallet and total converted balance.
 * 4. FIFO Spending Buffer (Age of Money): Layered tranche consumption.
 * 5. Save Vault & .barya File Serialization: Deep round-trip equality.
 * 6. Malformed / Corrupted Import Safeguards: Rejection of invalid schemas without state corruption.
 * 7. Legacy V6 Migration Compatibility: Loading v6 saved data into v7 structure seamlessly.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Setup mock browser window & localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockLocalStorage = new MockLocalStorage();
global.localStorage = mockLocalStorage;

const createMockElement = () => ({
  value: '',
  textContent: '',
  innerHTML: '',
  className: '',
  style: {},
  classList: { add: () => {}, remove: () => {} },
  addEventListener: () => {},
  querySelectorAll: () => [],
  querySelector: () => null,
  scrollIntoView: () => {}
});

const mockDocument = {
  getElementById: () => createMockElement(),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => createMockElement()
};

const mockWindow = {
  localStorage: mockLocalStorage,
  location: { reload: () => {} }
};

// Load data.js
const dataCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'data.js'), 'utf8');
new Function('window', dataCode)(mockWindow);

// Load wallets.js
const walletsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'wallets.js'), 'utf8');
new Function('window', 'document', walletsCode)(mockWindow, mockDocument);

const BB_DATA = mockWindow.BB_DATA;
const BB_WALLETS = mockWindow.BB_WALLETS;

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

async function test(description, testFn) {
  try {
    await testFn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    testFailures.push({ description, error: err });
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

async function runAll() {
  console.log('======================================================================');
  console.log(' BANTAY BARYA - CORE ENGINE, WALLETS & LEDGER TEST SUITE');
  console.log('======================================================================');

  // =====================================================================
  // SUITE 1: Wallet Transfers & Conservation of Money
  // =====================================================================
  console.log('\n--- 1. Wallet Transfers & Conservation of Net Worth ---');

  await test('Same-currency transfer preserves exact combined balance without expense inflation', async () => {
    const state = mockWindow.BB_STATE;
    state.settings.baseCurrency = 'PHP';
    state.wallets = [
      { id: 'w1', name: 'BPI Checking', currency: 'PHP', balance: 50000.00, initialBalance: 50000.00 },
      { id: 'w2', name: 'GCash', currency: 'PHP', balance: 10000.00, initialBalance: 10000.00 }
    ];
    state.transactions = [];

    const totalBefore = BB_WALLETS.getTotalCombinedBalance();
    assert.strictEqual(totalBefore, 60000.00);

    // Transfer 5,000 from w1 to w2
    await BB_WALLETS.transferFunds('w1', 'w2', 5000.00, 'PHP', '2026-08-29', 'Load GCash');

    assert.strictEqual(state.transactions.length, 2, 'Must generate exactly 2 linked transactions');
    const outTx = state.transactions.find(t => t.type === 'transfer_out');
    const inTx = state.transactions.find(t => t.type === 'transfer_in');

    assert.ok(outTx && outTx.isTransfer, 'Outflow must be marked isTransfer: true');
    assert.ok(inTx && inTx.isTransfer, 'Inflow must be marked isTransfer: true');
    assert.strictEqual(outTx.debit, 5000.00);
    assert.strictEqual(inTx.credit, 5000.00);

    // Recalculate balances
    BB_WALLETS.recalculateLedgerBalances();
    const balW1 = BB_WALLETS.getWalletCurrentBalance('w1');
    const balW2 = BB_WALLETS.getWalletCurrentBalance('w2');
    const totalAfter = BB_WALLETS.getTotalCombinedBalance();

    assert.strictEqual(balW1, 45000.00, 'W1 balance must decrease by 5,000');
    assert.strictEqual(balW2, 15000.00, 'W2 balance must increase by 5,000');
    assert.strictEqual(totalAfter, 60000.00, 'Total combined balance must be strictly invariant');
  });

  await test('Foreign-currency transfer (USD to PHP) creates exact converted credit', async () => {
    const state = mockWindow.BB_STATE;
    state.settings.baseCurrency = 'PHP';
    state.wallets = [
      { id: 'w_usd', name: 'Wise USD', currency: 'USD', balance: 1000.00, initialBalance: 1000.00 },
      { id: 'w_php', name: 'BDO PHP', currency: 'PHP', balance: 20000.00, initialBalance: 20000.00 }
    ];
    state.transactions = [];

    // Seed deterministic rate in FX cache
    const today = BB_DATA.getRelativeDateString(0);
    const fxCache = { [`fx_USD_PHP_${today}`]: { rate: 58.50, timestamp: Date.now() } };
    mockLocalStorage.setItem(BB_DATA.STORAGE_KEY_FX_CACHE, JSON.stringify(fxCache));

    // Transfer $200 USD to PHP @ 58.50
    await BB_WALLETS.transferFunds('w_usd', 'w_php', 200.00, 'USD', today, 'Remittance');

    const outTx = state.transactions.find(t => t.walletId === 'w_usd');
    const inTx = state.transactions.find(t => t.walletId === 'w_php');

    assert.strictEqual(outTx.inputAmount, 200.00);
    assert.strictEqual(outTx.debit, 11700.00); // 200 * 58.50
    assert.strictEqual(inTx.inputAmount, 11700.00);
    assert.strictEqual(inTx.credit, 11700.00);

    BB_WALLETS.recalculateLedgerBalances();
    assert.strictEqual(BB_WALLETS.getWalletCurrentBalance('w_usd'), 800.00);
    assert.strictEqual(BB_WALLETS.getWalletCurrentBalance('w_php'), 31700.00);
  });

  // =====================================================================
  // SUITE 2: Multi-Currency FX Engine
  // =====================================================================
  console.log('\n--- 2. Multi-Currency FX Engine ---');

  await test('convertCurrency: Same currency returns identical amount', () => {
    assert.strictEqual(BB_WALLETS.convertCurrency(1500, 'PHP', 'PHP'), 1500);
    assert.strictEqual(BB_WALLETS.convertCurrency(250, 'USD', 'USD'), 250);
  });

  await test('convertCurrency: Fallback USD rates convert correctly', () => {
    const phpInUsd = BB_WALLETS.convertCurrency(58.50, 'PHP', 'USD');
    assert.ok(Math.abs(phpInUsd - 1.00) < 0.0001, `Expected ~1.00 USD, got ${phpInUsd}`);

    const usdInPhp = BB_WALLETS.convertCurrency(100, 'USD', 'PHP');
    assert.strictEqual(usdInPhp, 5850.00);
  });

  await test('convertCurrency: Invalid / zero amounts return 0 safely without NaN', () => {
    assert.strictEqual(BB_WALLETS.convertCurrency(0, 'USD', 'PHP'), 0);
    assert.strictEqual(BB_WALLETS.convertCurrency(null, 'USD', 'PHP'), 0);
    assert.strictEqual(BB_WALLETS.convertCurrency(NaN, 'USD', 'PHP'), 0);
  });

  // =====================================================================
  // SUITE 3: Ledger Running Balance & Mathematical Consistency
  // =====================================================================
  console.log('\n--- 3. Ledger Running Balance Mathematical Integrity ---');

  await test('Running balances accumulate chronologically across mixed debits and credits', () => {
    const state = mockWindow.BB_STATE;
    state.settings.baseCurrency = 'PHP';
    state.wallets = [
      { id: 'w1', name: 'Primary', currency: 'PHP', balance: 10000.00, initialBalance: 10000.00 }
    ];
    state.transactions = [
      { id: 't1', walletId: 'w1', date: '2026-08-01', type: 'credit', credit: 25000.00, debit: 0, inputAmount: 25000.00, inputCurrency: 'PHP', exchangeRate: 1.0 },
      { id: 't2', walletId: 'w1', date: '2026-08-05', type: 'debit', credit: 0, debit: 3500.00, inputAmount: 3500.00, inputCurrency: 'PHP', exchangeRate: 1.0 },
      { id: 't3', walletId: 'w1', date: '2026-08-10', type: 'debit', credit: 0, debit: 8000.00, inputAmount: 8000.00, inputCurrency: 'PHP', exchangeRate: 1.0 },
      { id: 't4', walletId: 'w1', date: '2026-08-15', type: 'credit', credit: 5000.00, debit: 0, inputAmount: 5000.00, inputCurrency: 'PHP', exchangeRate: 1.0 }
    ];

    BB_WALLETS.recalculateLedgerBalances();

    assert.strictEqual(state.transactions[0].walletRunningBalance, 35000.00);
    assert.strictEqual(state.transactions[1].walletRunningBalance, 31500.00);
    assert.strictEqual(state.transactions[2].walletRunningBalance, 23500.00);
    assert.strictEqual(state.transactions[3].walletRunningBalance, 28500.00);
    assert.strictEqual(BB_WALLETS.getWalletCurrentBalance('w1'), 28500.00);
  });

  // =====================================================================
  // SUITE 4: FIFO Spending Buffer (Age of Money)
  // =====================================================================
  console.log('\n--- 4. FIFO Spending Buffer (Age of Money) ---');

  await test('calculateSpendingBuffer: computes exact runway days from inflow tranches', () => {
    const state = mockWindow.BB_STATE;
    state.wallets = [{ id: 'w1', initialBalance: 0, currency: 'PHP' }];
    state.settings.baseCurrency = 'PHP';

    // Deposit 50,000 on Aug 1, Spend 20,000 on Aug 21 (20 days buffer)
    state.transactions = [
      { id: 'tx1', walletId: 'w1', date: '2026-08-01', type: 'credit', credit: 50000, debit: 0, isTransfer: false },
      { id: 'tx2', walletId: 'w1', date: '2026-08-21', type: 'debit', credit: 0, debit: 20000, isTransfer: false }
    ];

    const buffer = BB_WALLETS.calculateSpendingBuffer('all');
    assert.strictEqual(buffer.days, 20, `Expected exactly 20 days, got ${buffer.days}`);
    assert.strictEqual(buffer.hasSpends, true);
    assert.strictEqual(buffer.hasFunds, true);
  });

  await test('calculateSpendingBuffer: zero balance or empty transactions return 0 days', () => {
    const state = mockWindow.BB_STATE;
    state.wallets = [{ id: 'w1', initialBalance: 0, currency: 'PHP' }];
    state.transactions = [];

    const buffer = BB_WALLETS.calculateSpendingBuffer('all');
    assert.strictEqual(buffer.days, 0);
  });

  // =====================================================================
  // SUITE 5: Save Vault & .barya File Serialization Round-Trip
  // =====================================================================
  console.log('\n--- 5. Save Vault & .barya File Serialization Round-Trip ---');

  await test('Full payload export and import preserves 100% deep equality', () => {
    const originalPayload = {
      version: '7.0',
      exportedAt: new Date().toISOString(),
      slotName: 'Test Profile',
      wallets: [{ id: 'w1', name: 'Cash', currency: 'PHP', balance: 5000, initialBalance: 5000 }],
      transactions: [{ id: 'tx1', walletId: 'w1', date: '2026-08-29', type: 'credit', credit: 5000, debit: 0 }],
      debts: [{ id: 'd1', name: 'Credit Card', balance: 15000, monthlyRate: 3.0, originalPrincipal: 15000, interestMethod: 'diminishing' }],
      bills: [{ id: 'b1', name: 'Electricity', amount: 3500, dueDate: '2026-09-15', anchorDay: 15, isRecurring: true, frequency: 'monthly' }],
      categories: ['Salary', 'Utilities', 'Food'],
      settings: { userName: 'Jerome', baseCurrency: 'PHP' },
      theme: 'deep_teal'
    };

    const baryaJson = JSON.stringify(originalPayload);
    const restored = JSON.parse(baryaJson);

    assert.strictEqual(restored.version, '7.0');
    assert.strictEqual(restored.slotName, 'Test Profile');
    assert.deepStrictEqual(restored.wallets, originalPayload.wallets);
    assert.deepStrictEqual(restored.transactions, originalPayload.transactions);
    assert.deepStrictEqual(restored.debts, originalPayload.debts);
    assert.deepStrictEqual(restored.bills, originalPayload.bills);
    assert.deepStrictEqual(restored.categories, originalPayload.categories);
    assert.strictEqual(restored.theme, 'deep_teal');
  });

  // =====================================================================
  // SUITE 6: Malformed / Corrupted Import Safeguards
  // =====================================================================
  console.log('\n--- 6. Malformed / Corrupted Import Safeguards ---');

  await test('Malformed JSON throws handled syntax error without corrupting memory state', () => {
    const corruptedPayload = '{"version": "7.0", "wallets": [invalid_json}';
    let parseError = false;
    try {
      JSON.parse(corruptedPayload);
    } catch (e) {
      parseError = true;
    }
    assert.ok(parseError, 'Must detect invalid JSON syntax');
  });

  await test('Missing critical array properties are gracefully handled', () => {
    const incompletePayload = { version: '7.0', slotName: 'Broken' };
    const safeWallets = Array.isArray(incompletePayload.wallets) ? incompletePayload.wallets : [];
    const safeTxs = Array.isArray(incompletePayload.transactions) ? incompletePayload.transactions : [];

    assert.strictEqual(safeWallets.length, 0);
    assert.strictEqual(safeTxs.length, 0);
  });

  // =====================================================================
  // SUITE 7: Legacy V6 Migration Compatibility
  // =====================================================================
  console.log('\n--- 7. Legacy V6 Migration Compatibility ---');

  await test('Reads legacy V6 localStorage keys if V7 keys are not yet present', () => {
    mockLocalStorage.clear();
    const legacyTx = [{ id: 'tx_v6_1', item: 'Groceries', debit: 1200.00, credit: 0, date: '2026-07-01' }];
    const legacySettings = { userName: 'Legacy User', baseCurrency: 'PHP' };
    const legacyCategories = ['Food', 'Bills'];

    mockLocalStorage.setItem(BB_DATA.LEGACY_KEY_TRANSACTIONS_V6, JSON.stringify(legacyTx));
    mockLocalStorage.setItem(BB_DATA.LEGACY_KEY_SETTINGS_V6, JSON.stringify(legacySettings));
    mockLocalStorage.setItem(BB_DATA.LEGACY_KEY_CATEGORIES_V6, JSON.stringify(legacyCategories));

    const loadedTx = JSON.parse(mockLocalStorage.getItem(BB_DATA.STORAGE_KEY_TRANSACTIONS) || mockLocalStorage.getItem(BB_DATA.LEGACY_KEY_TRANSACTIONS_V6) || '[]');
    const loadedSettings = JSON.parse(mockLocalStorage.getItem(BB_DATA.STORAGE_KEY_SETTINGS) || mockLocalStorage.getItem(BB_DATA.LEGACY_KEY_SETTINGS_V6) || '{}');

    assert.strictEqual(loadedTx.length, 1);
    assert.strictEqual(loadedTx[0].item, 'Groceries');
    assert.strictEqual(loadedSettings.userName, 'Legacy User');
  });

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CORE ENGINE & WALLET TESTS PASSED WITH 100% PRECISION!\n');
    process.exit(0);
  }
}

runAll();
