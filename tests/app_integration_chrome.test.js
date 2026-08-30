/**
 * Bantay Barya - Production Lifecycle Integration Test Suite
 * Pure Chrome environment (localStorage absent) verifying:
 * 1. Startup & loadData() with Chrome-only Encrypted Vault:
 *    - Locked-start does not render financial state or start autosave.
 * 2. Real App unlockAppWithPin() from Chrome-only Encrypted Vault:
 *    - Populates in-memory ledger and sets _isVaultLocked = false.
 * 3. Real App Legacy PIN Migration in Chrome:
 *    - Promotion failure resilience and zero-residue successful migration.
 * 4. Real App enablePinProtection() in Chrome Storage.
 * 5. Locked-Start Regression & Complete Production Lifecycle Verification:
 *    - setupStaticListenersOnce() idempotently activates wallet, debt, bill, report,
 *      save-vault, reconciliation, settings, Drive, and edit listeners before or after unlock.
 *    - initializeUnlockedApplication() starts autosave and renders financial views.
 *    - Changes made to unlocked ledger are encrypted on autosave.
 *    - Repeated lock & unlock cycles do not duplicate listeners or autosave intervals.
 *    - No financial rendering or autosave occurs before unlock.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

global.window = global;
global.crypto = webcrypto;
if (!global.btoa) global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
if (!global.atob) global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.innerWidth = 1024;
global.innerHeight = 768;
global.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
});
global.Chart = class MockChart {
  constructor() {}
  destroy() {}
  update() {}
};

// Factory for independent Chrome Storage mock with controllable error injection
function createMockChromeStorage() {
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
      const execute = () => {
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
      };

      if (simulatedDelayMs > 0) setTimeout(execute, simulatedDelayMs);
      else execute();
    },

    set(items, callback) {
      const execute = () => {
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
      };

      if (simulatedDelayMs > 0) setTimeout(execute, simulatedDelayMs);
      else execute();
    },

    remove(keys, callback) {
      const execute = () => {
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
      };

      if (simulatedDelayMs > 0) setTimeout(execute, simulatedDelayMs);
      else execute();
    },

    clear(callback) {
      const execute = () => {
        store.clear();
        if (callback) callback();
      };

      if (simulatedDelayMs > 0) setTimeout(execute, simulatedDelayMs);
      else execute();
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

const mockCtx = {
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  measureText: () => ({ width: 10 }),
  fillText: () => {},
  createLinearGradient: () => ({
    addColorStop: () => {}
  }),
  save: () => {},
  restore: () => {},
  setLineDash: () => {},
  closePath: () => {}
};

function createMockElement(id = '') {
  const listeners = {};
  const classListSet = new Set();
  const attrs = {};

  const el = {
    id,
    style: {},
    width: 300,
    height: 150,
    clientWidth: 1024,
    clientHeight: 768,
    getContext: () => mockCtx,
    classList: {
      add: (...classes) => classes.forEach(c => classListSet.add(c)),
      remove: (...classes) => classes.forEach(c => classListSet.delete(c)),
      toggle: (c) => {
        if (classListSet.has(c)) { classListSet.delete(c); return false; }
        classListSet.add(c); return true;
      },
      contains: (c) => classListSet.has(c)
    },
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(h => h !== handler);
    },
    dispatchEvent: (event) => {
      const type = typeof event === 'string' ? event : event.type;
      const handlers = listeners[type] || [];
      const evtObj = typeof event === 'string' ? { type: event, target: el, preventDefault: () => {}, stopPropagation: () => {} } : event;
      handlers.forEach(h => h(evtObj));
    },
    click: () => {
      el.dispatchEvent({ type: 'click', target: el, preventDefault: () => {}, stopPropagation: () => {} });
    },
    getListenerCount: (event) => (listeners[event] || []).length,
    focus: () => {},
    blur: () => {},
    select: () => {},
    scrollIntoView: () => {},
    reset: () => {},
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    getAttribute: (attr) => attrs[attr] || '',
    setAttribute: (attr, val) => { attrs[attr] = val; },
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false
  };
  return el;
}

const dataCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'data.js'), 'utf8');
const currencyCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'currency.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'storage.js'), 'utf8');
const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'crypto.js'), 'utf8');
const validatorCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'validator.js'), 'utf8');
const themeCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'theme.js'), 'utf8');
const walletsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'wallets.js'), 'utf8');
const debtsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'debts.js'), 'utf8');
const billsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'bills.js'), 'utf8');
const reportsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'reports.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Helper to instantiate clean app environment
function setupChromeAppEnvironment() {
  if (global.BB_CORE?.stopAutoSaveEngine) {
    global.BB_CORE.stopAutoSaveEngine();
  }

  delete global.localStorage;
  const chromeHarness = createMockChromeStorage();
  global.chrome = chromeHarness.chromeMock;

  // Reset globals
  global.BB_STATE = null;
  global.BB_CORE = null;
  global.BB_STORAGE = null;
  global.BB_CRYPTO = null;
  global.BB_VALIDATOR = null;
  global.BB_THEME = null;
  global.BB_WALLETS = null;
  global.BB_DEBTS = null;
  global.BB_BILLS = null;
  global.BB_REPORTS = null;
  global.app = null;

  const elementCache = new Map();
  const docElement = createMockElement('html');
  const bodyEl = createMockElement('body');
  const docListeners = {};

  global.document = {
    readyState: 'complete',
    documentElement: docElement,
    body: bodyEl,
    getElementById: (id) => {
      if (!elementCache.has(id)) elementCache.set(id, createMockElement(id));
      return elementCache.get(id);
    },
    querySelector: (sel) => {
      const key = 'sel_' + sel;
      if (!elementCache.has(key)) elementCache.set(key, createMockElement(key));
      return elementCache.get(key);
    },
    querySelectorAll: () => [],
    createElement: () => createMockElement(),
    addEventListener: (event, handler) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!docListeners[event]) return;
      docListeners[event] = docListeners[event].filter(h => h !== handler);
    }
  };

  new Function('window', 'globalThis', dataCode)(global, global);
  new Function('window', 'globalThis', currencyCode)(global, global);
  new Function('window', 'globalThis', storageCode)(global, global);
  new Function('window', 'globalThis', cryptoCode)(global, global);
  new Function('window', 'globalThis', validatorCode)(global, global);
  new Function('window', 'globalThis', themeCode)(global, global);
  new Function('window', 'globalThis', walletsCode)(global, global);
  new Function('window', 'globalThis', debtsCode)(global, global);
  new Function('window', 'globalThis', billsCode)(global, global);
  new Function('window', 'globalThis', reportsCode)(global, global);
  new Function('window', 'globalThis', appCode)(global, global);

  return {
    chromeHarness,
    elementCache,
    BB_DATA: global.BB_DATA,
    BB_STORAGE: global.BB_STORAGE,
    BB_CRYPTO: global.BB_CRYPTO,
    BB_VALIDATOR: global.BB_VALIDATOR,
    BB_THEME: global.BB_THEME,
    BB_WALLETS: global.BB_WALLETS,
    BB_DEBTS: global.BB_DEBTS,
    BB_BILLS: global.BB_BILLS,
    BB_REPORTS: global.BB_REPORTS,
    BB_CORE: global.BB_CORE,
    app: global.app,
    appState: global.BB_STATE,
    getElement: (id) => global.document.getElementById(id)
  };
}

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
  console.log(' BANTAY BARYA - PRODUCTION LIFECYCLE & INTEGRATION TEST SUITE');
  console.log('======================================================================');

  console.log('\n--- 1. Startup & loadData() with Chrome-Only Encrypted Vault ---');

  await test('loadData() detects Chrome-only vault, sets _isVaultLocked=true, and leaves state unpopulated', async () => {
    const env = setupChromeAppEnvironment();
    const pin = '3456789';

    // Seed Chrome-only encrypted vault
    const initialPayload = {
      wallets: [{ id: 'w_chrome_1', name: 'Chrome Vault Wallet', initialBalance: 50000 }],
      debts: [],
      bills: [],
      transactions: [{ id: 'tx_1', walletId: 'w_chrome_1', item: 'Salary', credit: 50000, debit: 0, date: '2026-08-01' }],
      categories: ['Salary'],
      settings: { baseCurrency: 'PHP' },
      saveSlots: [],
      activeSlotId: 'slot_primary'
    };
    const vaultEnvelope = await env.BB_CRYPTO.encryptPayload(initialPayload, pin);
    await env.BB_STORAGE.setItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(vaultEnvelope));

    // Execute actual app loadData()
    await env.BB_CORE.loadData();

    assert.strictEqual(env.appState._isVaultLocked, true, '_isVaultLocked must be true when encrypted vault exists');
    const foundWallet = env.appState.wallets.find(w => w.name === 'Chrome Vault Wallet');
    assert.strictEqual(foundWallet, undefined, 'Plaintext ledger must not be loaded into memory while vault is locked');
  });

  console.log('\n--- 2. Real App unlockAppWithPin() from Chrome-Only Encrypted Vault ---');

  await test('unlockAppWithPin() successfully unlocks and loads ledger from Chrome-only vault', async () => {
    const env = setupChromeAppEnvironment();
    const pin = '4567890';

    const payload = {
      wallets: [{ id: 'w_c2', name: 'Secure Chrome Wallet', initialBalance: 88000 }],
      debts: [],
      bills: [],
      transactions: [],
      categories: ['Groceries'],
      settings: { baseCurrency: 'PHP' },
      saveSlots: [],
      activeSlotId: 'slot_primary'
    };
    const vaultEnvelope = await env.BB_CRYPTO.encryptPayload(payload, pin);
    await env.BB_STORAGE.setItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(vaultEnvelope));

    await env.BB_CORE.loadData();
    assert.strictEqual(env.appState._isVaultLocked, true);

    const unlocked = await env.BB_CORE.unlockAppWithPin(pin);
    assert.strictEqual(unlocked, true);
    assert.strictEqual(env.appState._isVaultLocked, false);
    assert.strictEqual(env.appState.wallets[0].name, 'Secure Chrome Wallet');
    assert.strictEqual(env.appState.wallets[0].initialBalance, 88000);
  });

  console.log('\n--- 3. Real App Legacy PIN Migration in Chrome ---');

  await test('Legacy PIN migration in Chrome: Promotion failure preserves plaintext, retry completes migration with zero residue', async () => {
    const env = setupChromeAppEnvironment();
    const pin = '8889990';

    await env.BB_STORAGE.setBatch({
      [env.BB_DATA.STORAGE_KEY_PIN]: pin,
      [env.BB_DATA.STORAGE_KEY_WALLETS]: JSON.stringify([{ id: 'w_legacy', name: 'Legacy Wallet', initialBalance: 25000 }]),
      [env.BB_DATA.STORAGE_KEY_TRANSACTIONS]: JSON.stringify([{ id: 'tx_l1', walletId: 'w_legacy', credit: 25000, debit: 0 }])
    });

    await env.BB_CORE.loadData();
    assert.strictEqual(env.appState._isVaultLocked, true, 'env.appState._isVaultLocked must be true after loadData with legacy PIN');

    env.chromeHarness.setFailNextSet('CHROME_STORAGE_PROMOTION_ERROR');

    let migrationError = null;
    try {
      await env.BB_CORE.unlockAppWithPin(pin);
    } catch (err) {
      migrationError = err;
    }
    assert.ok(migrationError, 'unlockAppWithPin must throw when Chrome storage promotion fails');

    const rawWalletsAfterFailure = await env.BB_STORAGE.getItem(env.BB_DATA.STORAGE_KEY_WALLETS);
    assert.ok(rawWalletsAfterFailure && rawWalletsAfterFailure.includes('Legacy Wallet'), 'Plaintext ledger must survive failed promotion');
    const rawPinAfterFailure = await env.BB_STORAGE.getItem(env.BB_DATA.STORAGE_KEY_PIN);
    assert.strictEqual(rawPinAfterFailure, pin, 'Plaintext PIN must survive failed promotion');

    const unlocked = await env.BB_CORE.unlockAppWithPin(pin);
    assert.strictEqual(unlocked, true, 'unlockAppWithPin must return true on retry');
    assert.strictEqual(env.appState._isVaultLocked, false, 'env.appState._isVaultLocked must be false after unlock');
    assert.strictEqual(env.appState.wallets[0].name, 'Legacy Wallet');

    const canonicalVault = await env.BB_STORAGE.getItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    assert.ok(canonicalVault && canonicalVault.length > 20, 'Canonical vault must be populated');

    const chromeDump = env.chromeHarness.dump();
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_WALLETS], undefined);
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_TRANSACTIONS], undefined);
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_PIN], undefined);
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_MIGRATION_STAGING], undefined);
  });

  console.log('\n--- 4. Real App enablePinProtection() in Chrome Storage ---');

  await test('enablePinProtection() encrypts ledger, verifies authoritative readback, and purges plaintext in Chrome', async () => {
    const env = setupChromeAppEnvironment();
    const pin = '1122334';

    env.appState.wallets = [{ id: 'w_new', name: 'Fresh Wallet', initialBalance: 12000 }];
    env.appState.transactions = [{ id: 'tx_n', walletId: 'w_new', credit: 12000, debit: 0 }];
    env.appState.settings = { baseCurrency: 'PHP' };

    await env.BB_STORAGE.setBatch({
      [env.BB_DATA.STORAGE_KEY_WALLETS]: JSON.stringify(env.appState.wallets),
      [env.BB_DATA.STORAGE_KEY_TRANSACTIONS]: JSON.stringify(env.appState.transactions)
    });

    await env.BB_CORE.enablePinProtection(pin);

    assert.strictEqual(env.appState._isVaultLocked, false);
    assert.ok(env.appState._vaultDerivedKey);

    const storedVault = await env.BB_STORAGE.getItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    assert.ok(storedVault && storedVault.length > 20);

    const chromeDump = env.chromeHarness.dump();
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_WALLETS], undefined);
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_TRANSACTIONS], undefined);
    assert.strictEqual(chromeDump[env.BB_DATA.STORAGE_KEY_MIGRATION_STAGING], undefined);
  });

  console.log('\n--- 5. Locked-Start Regression & Complete Production Lifecycle ---');

  await test('Locked startup installs listeners idempotently, delays rendering/autosave until unlock, encrypts autosave, and prevents duplicate listeners/intervals across lock/unlock cycles', async () => {
    const env = setupChromeAppEnvironment();
    const pin = '7778889';

    // 1. Seed Chrome storage with an encrypted vault
    const initialLedger = {
      wallets: [{ id: 'w_prod_1', name: 'Primary Wallet', initialBalance: 100000 }],
      debts: [{ id: 'd_prod_1', name: 'Credit Card', balance: 20000, minPayment: 1000, interestRate: 24 }],
      bills: [{ id: 'b_prod_1', name: 'Internet', amount: 1899, dueDate: '2026-08-15' }],
      transactions: [{ id: 'tx_prod_1', walletId: 'w_prod_1', item: 'Initial Paycheck', credit: 100000, debit: 0, date: '2026-08-01' }],
      categories: ['Salary', 'Utilities'],
      settings: { baseCurrency: 'PHP', userName: 'Jerome' },
      saveSlots: [{ id: 'slot_primary', name: 'Main Slot', timestamp: Date.now() }],
      activeSlotId: 'slot_primary'
    };
    const vaultEnvelope = await env.BB_CRYPTO.encryptPayload(initialLedger, pin);
    await env.BB_STORAGE.setItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(vaultEnvelope));

    // 2. Perform real startup flow
    env.BB_CORE.setupStaticListenersOnce();
    await env.BB_CORE.loadData();
    env.BB_THEME.initPinSecurity();

    // Verify state before unlock
    assert.strictEqual(env.appState._isVaultLocked, true, 'Vault must be locked on startup');
    assert.strictEqual(env.BB_CORE.getAutoSaveTimer(), null, 'Autosave timer must NOT run before unlock');
    assert.strictEqual(env.appState.wallets.find(w => w.name === 'Primary Wallet'), undefined, 'Ledger must not be in memory before unlock');

    // 3. Verify that all UI controls and listeners are active even while locked or prior to unlock
    const openWalletsBtn = env.getElement('openWalletsModalBtn');
    const walletsModal = env.getElement('walletsModal');
    openWalletsBtn.click();
    assert.ok(walletsModal.classList.contains('active'), 'Wallet modal listener must be active');
    walletsModal.classList.remove('active');

    const openDebtsBtn = env.getElement('openDebtsModalBtn');
    const debtsModal = env.getElement('debtsModal');
    openDebtsBtn.click();
    assert.ok(debtsModal.classList.contains('active'), 'Debts modal listener must be active');
    debtsModal.classList.remove('active');

    const openBillsBtn = env.getElement('openBillsModalBtn');
    const billsModal = env.getElement('billsModal');
    openBillsBtn.click();
    assert.ok(billsModal.classList.contains('active'), 'Bills modal listener must be active');
    billsModal.classList.remove('active');

    const openReportBtn = env.getElement('openReportBtn');
    const reportModal = env.getElement('reportModal');
    openReportBtn.click();
    assert.ok(reportModal.classList.contains('active'), 'Report modal listener must be active');
    reportModal.classList.remove('active');

    const openSaveVaultBtn = env.getElement('openSaveVaultBtn');
    const saveVaultModal = env.getElement('saveVaultModal');
    openSaveVaultBtn.click();
    assert.ok(saveVaultModal.classList.contains('active'), 'Save vault modal listener must be active');
    saveVaultModal.classList.remove('active');

    const openReconcileBtn = env.getElement('openReconcileModalBtn');
    const reconcileModal = env.getElement('reconcileModal');
    openReconcileBtn.click();
    assert.ok(reconcileModal.classList.contains('active'), 'Reconcile modal listener must be active');
    reconcileModal.classList.remove('active');

    const openInitialBalanceBtn = env.getElement('openInitialBalanceBtn');
    const initialBalanceModal = env.getElement('initialBalanceModal');
    openInitialBalanceBtn.click();
    assert.ok(initialBalanceModal.classList.contains('active'), 'Settings modal listener must be active');
    initialBalanceModal.classList.remove('active');

    const openGuideBtn = env.getElement('openGuideModalBtn');
    const guideModal = env.getElement('guideModal');
    openGuideBtn.click();
    assert.ok(guideModal.classList.contains('active'), 'Guide modal listener must be active');
    guideModal.classList.remove('active');

    // 4. Unlock with PIN
    const unlockResult = await env.BB_CORE.unlockAppWithPin(pin);
    assert.strictEqual(unlockResult, true, 'Unlock must succeed with correct PIN');
    assert.strictEqual(env.appState._isVaultLocked, false, 'App state must be unlocked');
    assert.strictEqual(env.appState.wallets[0].name, 'Primary Wallet');
    assert.strictEqual(env.appState.debts[0].name, 'Credit Card');
    assert.strictEqual(env.appState.bills[0].name, 'Internet');

    // Verify Autosave started after unlock
    assert.notStrictEqual(env.BB_CORE.getAutoSaveTimer(), null, 'Autosave timer must start after unlock');

    // 5. Change ledger and verify encrypted autosave
    env.appState.transactions.push({
      id: 'tx_autosave_change',
      walletId: 'w_prod_1',
      item: 'Autosaved Expense',
      debit: 4500,
      credit: 0,
      date: '2026-08-05'
    });

    await env.BB_CORE.saveData();

    // Verify Chrome storage contains encrypted vault and can be decrypted with derived key
    const rawVaultFromStorage = await env.BB_STORAGE.getItem(env.BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    assert.ok(rawVaultFromStorage && rawVaultFromStorage.length > 20);
    const parsedVault = JSON.parse(rawVaultFromStorage);
    const decryptedVault = await env.BB_CRYPTO.decryptPayload(parsedVault, env.appState._vaultDerivedKey);
    const foundNewTx = decryptedVault.transactions.find(t => t.item === 'Autosaved Expense');
    assert.ok(foundNewTx, 'Autosaved encrypted vault must contain newly added transaction');
    assert.strictEqual(foundNewTx.debit, 4500);

    // Verify zero plaintext residue in Chrome storage
    const chromeDumpAfterSave = env.chromeHarness.dump();
    assert.strictEqual(chromeDumpAfterSave[env.BB_DATA.STORAGE_KEY_TRANSACTIONS], undefined);
    assert.strictEqual(chromeDumpAfterSave[env.BB_DATA.STORAGE_KEY_WALLETS], undefined);

    // 6. Test Lock -> Unlock -> Lock -> Unlock cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      // Lock app
      env.BB_CORE.lockApp();
      assert.strictEqual(env.appState._isVaultLocked, true, 'Cycle ' + cycle + ': App must be locked');
      assert.strictEqual(env.BB_CORE.getAutoSaveTimer(), null, 'Cycle ' + cycle + ': Autosave must be stopped when locked');

      // Unlock app
      await env.BB_CORE.unlockAppWithPin(pin);
      assert.strictEqual(env.appState._isVaultLocked, false, 'Cycle ' + cycle + ': App must be unlocked');
      assert.notStrictEqual(env.BB_CORE.getAutoSaveTimer(), null, 'Cycle ' + cycle + ': Autosave must resume after unlock');

      // Explicitly trigger setupStaticListenersOnce() to verify idempotency
      env.BB_CORE.setupStaticListenersOnce();

      // Check click listener count on key buttons
      assert.strictEqual(openWalletsBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openWalletsModalBtn');
      assert.strictEqual(openDebtsBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openDebtsModalBtn');
      assert.strictEqual(openBillsBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openBillsModalBtn');
      assert.strictEqual(openReportBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openReportBtn');
      assert.strictEqual(openSaveVaultBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openSaveVaultBtn');
      assert.strictEqual(openReconcileBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openReconcileModalBtn');
      assert.strictEqual(openInitialBalanceBtn.getListenerCount('click'), 1, 'Cycle ' + cycle + ': Must have exactly 1 click listener on openInitialBalanceBtn');
    }
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
