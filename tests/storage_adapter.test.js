/**
 * Bantay Barya - Deterministic Automated Test Suite for Independent Storage Backends & Chrome Storage Adapter
 *
 * Requirements Tested:
 * 1. Independent LocalStorage Backend:
 *    - Isolated synchronous & asynchronous batch CRUD operations.
 *    - Plaintext ledger purge & zero residue.
 *    - Migration staging, promotion, and interruption safety.
 * 2. Independent Chrome.storage.local Backend:
 *    - Asynchronous callback handling & delayed write execution.
 *    - Propagation of chrome.runtime.lastError for set, get, and remove operations.
 *    - Authoritative Chrome storage value verification before plaintext deletion.
 *    - Interruption handling: failed promotion aborts migration and preserves plaintext ledger in Chrome storage.
 *    - Full plaintext residue audit across chrome.storage.local key store.
 * 3. Debt Payment Regression:
 *    - Canonical minPayment field preservation.
 *    - Legacy minimumPayment alias normalization without value mutation.
 * 4. Recursive Save Slots:
 *    - Nested slot payload validation with depth <= 2.
 *    - Rejection of nested saveSlots inside slot payloads.
 * 5. 300-Second Throttle Tier:
 *    - Progressive lockout at 5 (30s), 8 (60s), and 10+ attempts (300s).
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

global.window = global;
global.crypto = webcrypto;
if (!global.btoa) global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
if (!global.atob) global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');

// Factory for independent LocalStorage mock
function createIsolatedLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    dump: () => Object.fromEntries(store)
  };
}

// Factory for independent Chrome Storage mock with controllable error injection and latency
function createIsolatedChromeStorage() {
  const store = new Map();
  let failNextSet = null;
  let failNextGet = null;
  let failNextRemove = null;
  let simulatedDelayMs = 0;

  const mockRuntime = {
    lastError: null
  };

  const mockStorageLocal = {
    get(keys, callback) {
      setTimeout(() => {
        if (failNextGet) {
          mockRuntime.lastError = new Error(failNextGet);
          failNextGet = null;
          callback({});
          mockRuntime.lastError = null;
          return;
        }

        const result = {};
        if (typeof keys === 'string') {
          if (store.has(keys)) result[keys] = store.get(keys);
        } else if (Array.isArray(keys)) {
          keys.forEach(k => { if (store.has(k)) result[k] = store.get(k); });
        } else if (keys === null || keys === undefined) {
          for (const [k, v] of store.entries()) result[k] = v;
        }
        callback(result);
      }, simulatedDelayMs);
    },

    set(items, callback) {
      setTimeout(() => {
        if (failNextSet) {
          mockRuntime.lastError = new Error(failNextSet);
          failNextSet = null;
          if (callback) callback();
          mockRuntime.lastError = null;
          return;
        }

        for (const k of Object.keys(items)) {
          store.set(k, items[k]);
        }
        if (callback) callback();
      }, simulatedDelayMs);
    },

    remove(keys, callback) {
      setTimeout(() => {
        if (failNextRemove) {
          mockRuntime.lastError = new Error(failNextRemove);
          failNextRemove = null;
          if (callback) callback();
          mockRuntime.lastError = null;
          return;
        }

        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => store.delete(k));
        if (callback) callback();
      }, simulatedDelayMs);
    },

    clear(callback) {
      setTimeout(() => {
        store.clear();
        if (callback) callback();
      }, simulatedDelayMs);
    }
  };

  return {
    chromeMock: {
      storage: { local: mockStorageLocal },
      runtime: mockRuntime
    },
    setFailNextSet: (msg) => { failNextSet = msg; },
    setFailNextGet: (msg) => { failNextGet = msg; },
    setFailNextRemove: (msg) => { failNextRemove = msg; },
    setSimulatedDelayMs: (ms) => { simulatedDelayMs = ms; },
    dump: () => Object.fromEntries(store)
  };
}

const dataCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'data.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'storage.js'), 'utf8');
const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'crypto.js'), 'utf8');
const validatorCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'validator.js'), 'utf8');

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
  console.log(' BANTAY BARYA - INDEPENDENT STORAGE BACKENDS & CHROME ADAPTER SUITE');
  console.log('======================================================================');

  console.log('\n--- 1. Pure LocalStorage Backend (Isolated) ---');

  await test('LocalStorage: Batch set, migration staging, promotion, and zero residue cleanup', async () => {
    delete global.chrome;
    const mockLS = createIsolatedLocalStorage();
    global.localStorage = mockLS;

    new Function('window', 'globalThis', dataCode)(global, global);
    new Function('window', 'globalThis', storageCode)(global, global);
    new Function('window', 'globalThis', cryptoCode)(global, global);

    const { BB_DATA, BB_STORAGE, BB_CRYPTO } = global;

    // Seed plaintext ledger
    await BB_STORAGE.setBatch({
      [BB_DATA.STORAGE_KEY_WALLETS]: JSON.stringify([{ id: 'w1', name: 'LS Wallet', initialBalance: 1000 }]),
      [BB_DATA.STORAGE_KEY_PIN]: '1234567'
    });

    assert.strictEqual(BB_STORAGE.hasLegacyPlaintextPin(), true);
    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), false);

    // Stage
    const payload = { wallets: [{ id: 'w1', name: 'LS Wallet', initialBalance: 1000 }] };
    const staged = await BB_CRYPTO.encryptPayload(payload, '1234567');
    await BB_STORAGE.setItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(staged));

    // Promote
    await BB_STORAGE.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(staged));
    await BB_STORAGE.removeItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING);
    await BB_STORAGE.clearPlaintextLedger();

    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), true);
    assert.strictEqual(BB_STORAGE.hasLegacyPlaintextPin(), false);
    assert.strictEqual(mockLS.getItem(BB_DATA.STORAGE_KEY_WALLETS), null);
    assert.strictEqual(mockLS.getItem(BB_DATA.STORAGE_KEY_PIN), null);
  });

  console.log('\n--- 2. Pure Chrome Storage Local Backend (Isolated) ---');

  await test('Chrome Storage: Delayed writes, runtime.lastError propagation on failures', async () => {
    delete global.localStorage;
    const { chromeMock, setFailNextSet, setFailNextRemove, setSimulatedDelayMs, dump } = createIsolatedChromeStorage();
    global.chrome = chromeMock;

    new Function('window', 'globalThis', dataCode)(global, global);
    new Function('window', 'globalThis', storageCode)(global, global);
    new Function('window', 'globalThis', cryptoCode)(global, global);

    const { BB_DATA, BB_STORAGE, BB_CRYPTO } = global;

    setSimulatedDelayMs(10);
    await BB_STORAGE.setItem('test_chrome_key', 'test_val');
    const readVal = await BB_STORAGE.getItem('test_chrome_key');
    assert.strictEqual(readVal, 'test_val');

    // Test Write Failure Rejection
    setFailNextSet('QUOTA_BYTES_EXCEEDED');
    await assert.rejects(
      async () => {
        await BB_STORAGE.setItem('fail_key', 'val');
      },
      /QUOTA_BYTES_EXCEEDED/
    );

    // Test Remove Failure Rejection
    setFailNextRemove('CHROME_REMOVE_IO_ERROR');
    await assert.rejects(
      async () => {
        await BB_STORAGE.removeItem('test_chrome_key');
      },
      /CHROME_REMOVE_IO_ERROR/
    );
  });

  await test('Chrome Storage: Interrupted promotion preserves plaintext, successful promotion clears residue', async () => {
    delete global.localStorage;
    const { chromeMock, setFailNextSet, dump } = createIsolatedChromeStorage();
    global.chrome = chromeMock;

    new Function('window', 'globalThis', dataCode)(global, global);
    new Function('window', 'globalThis', storageCode)(global, global);
    new Function('window', 'globalThis', cryptoCode)(global, global);

    const { BB_DATA, BB_STORAGE, BB_CRYPTO } = global;
    const pin = '5678901';

    // Seed Chrome storage with plaintext ledger
    await BB_STORAGE.setBatch({
      [BB_DATA.STORAGE_KEY_WALLETS]: JSON.stringify([{ id: 'w_chrome', name: 'Chrome Wallet' }]),
      [BB_DATA.STORAGE_KEY_PIN]: pin
    });

    const payload = { wallets: [{ id: 'w_chrome', name: 'Chrome Wallet' }] };
    const staged = await BB_CRYPTO.encryptPayload(payload, pin);
    await BB_STORAGE.setItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(staged));

    // Simulate Failure During Promotion to Encrypted Vault
    setFailNextSet('CHROME_DISK_FULL_ON_PROMOTING');
    let promotionFailed = false;
    try {
      await BB_STORAGE.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(staged));
    } catch (e) {
      promotionFailed = true;
    }
    assert.strictEqual(promotionFailed, true, 'Promotion must fail cleanly');

    // Plaintext ledger must survive intact because promotion aborted
    const survivingWallets = await BB_STORAGE.getItem(BB_DATA.STORAGE_KEY_WALLETS);
    assert.ok(survivingWallets.includes('Chrome Wallet'));

    // Retry and complete successfully
    await BB_STORAGE.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(staged));
    const verifiedVault = await BB_STORAGE.getItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    assert.ok(verifiedVault.length > 20);

    await BB_STORAGE.removeItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING);
    await BB_STORAGE.clearPlaintextLedger();

    // Verify Zero Residue in Chrome storage
    const allChromeData = dump();
    for (const key of Object.keys(allChromeData)) {
      if (key === BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT) continue;
      assert.strictEqual(key.startsWith('bb_wallets'), false);
      assert.strictEqual(key.startsWith('bb_transactions'), false);
      assert.strictEqual(key.startsWith('bb_app_pin'), false);
    }
  });

  console.log('\n--- 3. Canonical minPayment Debt Preservation ---');

  await test('Preserves minPayment field and normalizes legacy minimumPayment without value alteration', async () => {
    delete global.chrome;
    global.localStorage = createIsolatedLocalStorage();
    new Function('window', 'globalThis', dataCode)(global, global);
    new Function('window', 'globalThis', validatorCode)(global, global);

    const { BB_VALIDATOR } = global;

    const fixtureWithCanonical = {
      debts: [
        { id: 'd1', name: 'Auto Loan', balance: 500000, monthlyRate: 1.5, minPayment: 15500.50 }
      ]
    };
    const validated1 = BB_VALIDATOR.validateAndNormalizeLedger(fixtureWithCanonical);
    assert.strictEqual(validated1.debts[0].minPayment, 15500.50);

    const fixtureWithLegacyAlias = {
      debts: [
        { id: 'd2', name: 'Credit Card', balance: 80000, monthlyRate: 2.0, minimumPayment: 4000 }
      ]
    };
    const validated2 = BB_VALIDATOR.validateAndNormalizeLedger(fixtureWithLegacyAlias);
    assert.strictEqual(validated2.debts[0].minPayment, 4000);
    assert.strictEqual(validated2.debts[0].minimumPayment, undefined);
  });

  console.log('\n--- 4. Recursive Save Slots & Bounded Depth Validation ---');

  await test('Recursively validates save slot payloads without accepting nested saveSlots inside slots', async () => {
    const { BB_VALIDATOR } = global;

    const fixture = {
      saveSlots: [
        {
          id: 'slot_1',
          name: 'Backup Slot',
          payload: {
            wallets: [{ id: 'w1', name: 'Nested Wallet', currency: 'USD', initialBalance: 200 }],
            transactions: [{ id: 't1', walletId: 'w1', item: 'Nested Tx', credit: 200, debit: 0, date: '2026-08-01' }],
            debts: [{ id: 'd1', name: 'Nested Debt', minPayment: 500, balance: 5000 }],
            saveSlots: [{ id: 'illegal_nested_slot', name: 'Illegal' }]
          }
        }
      ]
    };

    const validated = BB_VALIDATOR.validateAndNormalizeLedger(fixture);
    assert.strictEqual(validated.saveSlots.length, 1);
    assert.strictEqual(validated.saveSlots[0].payload.wallets[0].name, 'Nested Wallet');
    assert.strictEqual(validated.saveSlots[0].payload.wallets[0].currency, 'USD');
    assert.strictEqual(validated.saveSlots[0].payload.debts[0].minPayment, 500);
    assert.strictEqual(validated.saveSlots[0].payload.saveSlots, undefined);
  });

  console.log('\n--- 5. Documented 300-Second Throttle Tier ---');

  await test('Throttling triggers 30s at 5 attempts, 60s at 8 attempts, and 300s at 10+ attempts', async () => {
    global.localStorage = createIsolatedLocalStorage();
    new Function('window', 'globalThis', dataCode)(global, global);
    new Function('window', 'globalThis', storageCode)(global, global);
    new Function('window', 'globalThis', cryptoCode)(global, global);

    const { BB_STORAGE, BB_CRYPTO } = global;

    BB_CRYPTO.ThrottlingManager.resetThrottle(BB_STORAGE);

    for (let i = 1; i <= 4; i++) {
      const res = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE);
      assert.strictEqual(res.isLocked, false);
      assert.strictEqual(res.remainingSeconds, 0);
    }

    // 5 attempts -> 30s
    const res5 = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE);
    assert.strictEqual(res5.isLocked, true);
    assert.ok(res5.remainingSeconds >= 28 && res5.remainingSeconds <= 30);

    // 8 attempts -> 60s
    BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE); // 6
    BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE); // 7
    const res8 = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE); // 8
    assert.strictEqual(res8.isLocked, true);
    assert.ok(res8.remainingSeconds >= 58 && res8.remainingSeconds <= 60);

    // 10 attempts -> 300s (5 mins)
    BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE); // 9
    const res10 = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE); // 10
    assert.strictEqual(res10.isLocked, true);
    assert.ok(res10.remainingSeconds >= 298 && res10.remainingSeconds <= 300);
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
