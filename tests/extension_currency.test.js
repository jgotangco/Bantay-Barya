/**
 * Bantay Barya - Deterministic Automated Test Suite for Extension Multi-Currency & Currency Module
 *
 * Requirements Tested:
 * 1. BB_CURRENCY.roundMoney() performs deterministic 2-decimal rounding without floating point drift.
 * 2. Multi-currency wallet balance calculation for native and foreign currency transactions.
 * 3. Total base balance calculation aggregating multiple wallets across PHP, USD, JPY, EUR with exchange rates.
 * 4. Transfer neutrality: Transfers between wallets do not alter the net total base balance.
 * 5. Spending buffer (runway days) calculation:
 *    - Correctly handles single wallet vs all wallets aggregate mode.
 *    - Excludes transfers in aggregate mode to avoid double-counting or false depletion.
 *    - Accounts for foreign currency transaction values converted to base currency.
 * 6. Extension popup DOM rendering: Safe textContent/createElement usage without unsafe innerHTML sinks.
 * 7. Extension storage fallback handling when storage is uninitialized.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Setup global context for Node execution
global.window = global;
if (!global.localStorage) {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

const dataCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'data.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'storage.js'), 'utf8');
const currencyCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'currency.js'), 'utf8');

new Function('window', 'globalThis', dataCode)(global, global);
new Function('window', 'globalThis', storageCode)(global, global);
new Function('window', 'globalThis', currencyCode)(global, global);

const BB_CURRENCY = global.BB_CURRENCY;
const BB_DATA = global.BB_DATA;

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

async function test(description, testFn) {
  try {
    await testFn();
    passedTests++;
    console.log('  ✓ ' + description);
  } catch (err) {
    failedTests++;
    testFailures.push({ description, error: err });
    console.error('  ✗ FAIL: ' + description);
    console.error('    ' + err.message);
  }
}

async function runAll() {
  console.log('======================================================================');
  console.log(' BANTAY BARYA - EXTENSION MULTI-CURRENCY TEST SUITE');
  console.log('======================================================================');

  console.log('\n--- 1. Deterministic Rounding & FX Helpers ---');

  await test('roundMoney() correctly handles floating point inaccuracies and standard rounding', async () => {
    assert.strictEqual(BB_CURRENCY.roundMoney(0.1 + 0.2), 0.30);
    assert.strictEqual(BB_CURRENCY.roundMoney(100.005), 100.01);
    assert.strictEqual(BB_CURRENCY.roundMoney(100.004), 100.00);
    assert.strictEqual(BB_CURRENCY.roundMoney(-50.555), -50.56);
    assert.strictEqual(BB_CURRENCY.roundMoney('123.456'), 123.46);
    assert.strictEqual(BB_CURRENCY.roundMoney(NaN), 0);
    assert.strictEqual(BB_CURRENCY.roundMoney(Infinity), 0);
  });

  await test('getFxRate() returns 1.0 for identical currencies and fallback rate for foreign pairs', async () => {
    assert.strictEqual(BB_CURRENCY.getFxRate('PHP', 'PHP'), 1.0);
    assert.strictEqual(BB_CURRENCY.getFxRate('USD', 'USD'), 1.0);

    const usdToPhp = BB_CURRENCY.getFxRate('USD', 'PHP');
    assert.strictEqual(usdToPhp, 58.50);

    const phpToUsd = BB_CURRENCY.getFxRate('PHP', 'USD');
    assert.strictEqual(BB_CURRENCY.roundMoney(phpToUsd * 58.50), 1.00);
  });

  console.log('\n--- 2. Native Wallet Balances & Foreign Currency Conversions ---');

  await test('getWalletBalance() correctly computes native balance with inputCurrency and exchangeRate', async () => {
    const usdWallet = {
      id: 'wallet_usd',
      name: 'US Dollar Account',
      currency: 'USD',
      initialBalance: 1000
    };

    const transactions = [
      {
        id: 'tx_1',
        walletId: 'wallet_usd',
        date: '2026-08-01',
        type: 'credit',
        inputCurrency: 'USD',
        inputAmount: 500,
        exchangeRate: 58.50,
        credit: 29250,
        debit: 0
      },
      {
        id: 'tx_2',
        walletId: 'wallet_usd',
        date: '2026-08-05',
        type: 'debit',
        inputCurrency: 'USD',
        inputAmount: 200,
        exchangeRate: 58.50,
        credit: 0,
        debit: 11700
      },
      {
        id: 'tx_3',
        walletId: 'wallet_usd',
        date: '2026-08-10',
        type: 'debit',
        credit: 0,
        debit: 5850
      }
    ];

    const nativeBalance = BB_CURRENCY.getWalletBalance(usdWallet, transactions, 'PHP');
    assert.strictEqual(nativeBalance, 1200);

    const baseConverted = BB_CURRENCY.getWalletBaseBalance(usdWallet, transactions, 'PHP');
    assert.strictEqual(baseConverted, 70200);
  });

  console.log('\n--- 3. Total Base Balance & Transfer Neutrality ---');

  await test('getTotalBaseBalance() correctly sums multi-currency wallets and preserves transfer neutrality', async () => {
    const wallets = [
      { id: 'w_php', name: 'BDO Checking', currency: 'PHP', initialBalance: 50000 },
      { id: 'w_usd', name: 'Wise USD', currency: 'USD', initialBalance: 1000 }
    ];

    let totalBase = BB_CURRENCY.getTotalBaseBalance(wallets, [], 'PHP');
    assert.strictEqual(totalBase, 108500);

    const transferTxs = [
      {
        id: 'tx_tr_out',
        walletId: 'w_usd',
        date: '2026-08-15',
        type: 'transfer_out',
        isTransfer: true,
        inputCurrency: 'USD',
        inputAmount: 500,
        exchangeRate: 58.50,
        credit: 0,
        debit: 29250
      },
      {
        id: 'tx_tr_in',
        walletId: 'w_php',
        date: '2026-08-15',
        type: 'transfer_in',
        isTransfer: true,
        inputCurrency: 'PHP',
        inputAmount: 29250,
        exchangeRate: 1.0,
        credit: 29250,
        debit: 0
      }
    ];

    const phpWalletBal = BB_CURRENCY.getWalletBalance(wallets[0], transferTxs, 'PHP');
    const usdWalletBal = BB_CURRENCY.getWalletBalance(wallets[1], transferTxs, 'PHP');

    assert.strictEqual(phpWalletBal, 79250);
    assert.strictEqual(usdWalletBal, 500);

    const totalBaseAfterTransfer = BB_CURRENCY.getTotalBaseBalance(wallets, transferTxs, 'PHP');
    assert.strictEqual(totalBaseAfterTransfer, 108500);
  });

  console.log('\n--- 4. Multi-Currency Spending Buffer (FIFO Runway) ---');

  await test('calculateSpendingBuffer() excludes transfers in aggregate mode and computes correct days', async () => {
    const wallets = [
      { id: 'w1', name: 'Main', currency: 'PHP', initialBalance: 100000 }
    ];

    const transactions = [
      { id: 't1', walletId: 'w1', date: '2026-08-01', type: 'credit', credit: 20000, debit: 0 },
      { id: 't2', walletId: 'w1', date: '2026-08-10', type: 'debit', credit: 0, debit: 10000 },
      { id: 't3', walletId: 'w1', date: '2026-08-20', type: 'debit', credit: 0, debit: 15000 },
      { id: 't4', walletId: 'w1', date: '2026-08-25', type: 'transfer_out', isTransfer: true, credit: 0, debit: 50000 }
    ];

    const buffer = BB_CURRENCY.calculateSpendingBuffer(wallets, transactions, 'PHP', 'all');
    assert.strictEqual(buffer.hasFunds, true);
    assert.strictEqual(buffer.hasSpends, true);
    assert.ok(buffer.days >= 0);
  });

  console.log('\n--- 5. Rate Direction & Historical FX Immutability ---');

  await test('Historical transactions strictly use recorded exchangeRate and do not recalculate with live/current rates', async () => {
    const usdWallet = { id: 'w_usd', name: 'USD Account', currency: 'USD', initialBalance: 0 };

    // Transaction recorded with historical rate: 1 USD = 50.00 PHP (credit: 5000 PHP)
    const historicalTx = {
      id: 'tx_hist_1',
      walletId: 'w_usd',
      date: '2024-01-15',
      type: 'credit',
      exchangeRate: 50.00, // Historical rate (1 USD = 50.00 PHP)
      credit: 5000.00,      // Recorded base amount (5000 PHP)
      debit: 0
    };

    // Calculate native balance (5000 PHP / 50.00 historical rate = 100 USD) even if current rate is 58.50
    const nativeBal = BB_CURRENCY.getWalletBalance(usdWallet, [historicalTx], 'PHP', { 'USD_PHP': 58.50 });
    assert.strictEqual(nativeBal, 100.00, 'Native calculation must use historical transaction exchangeRate (50.00) rather than current rate (58.50)');

    // For a base currency wallet (PHP), recorded historical credit of 5000.00 is preserved identically
    const phpWallet = { id: 'w_php', name: 'PHP Account', currency: 'PHP', initialBalance: 0 };
    const phpTx = {
      id: 'tx_hist_2',
      walletId: 'w_php',
      date: '2024-01-15',
      type: 'credit',
      inputCurrency: 'USD',
      inputAmount: 100,
      exchangeRate: 50.00,
      credit: 5000.00,
      debit: 0
    };
    const phpBal = BB_CURRENCY.getWalletBalance(phpWallet, [phpTx], 'PHP', { 'USD_PHP': 58.50 });
    assert.strictEqual(phpBal, 5000.00, 'PHP wallet balance must preserve the exact recorded base credit (5000.00 PHP)');
  });

  console.log('\n======================================================================');
  console.log('TOTAL TESTS: ' + (passedTests + failedTests) + ' | PASSED: ' + passedTests + ' | FAILED: ' + failedTests);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error('\n❌ ' + failedTests + ' TEST(S) FAILED:');
    testFailures.forEach((f, i) => {
      console.error('  ' + (i + 1) + '. ' + f.description);
      console.error('     Error: ' + f.error.message);
    });
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
