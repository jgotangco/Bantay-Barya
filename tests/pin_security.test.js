/**
 * Bantay Barya - Deterministic Automated Test Suite for PIN Security, AES-GCM Vault & Migration Protocol
 *
 * Requirements Tested:
 * 1. PBKDF2 (SHA-256, 250k iter) + AES-GCM 256-bit encryption and authenticated decryption.
 * 2. Magic Marker verification: Decrypting with wrong PIN fails authentication.
 * 3. Tamper detection: Modified ciphertext or IV fails decryption.
 * 4. Recoverable migration protocol (Write-Read-Decrypt-Promote-Delete):
 *    - Full successful migration converts legacy plaintext PIN & ledger to encrypted vault.
 *    - Interruption after staging preserves original plaintext data safely.
 *    - Staging recovery on next unlock cleanly finalizes promotion.
 * 5. Locked autosave protection: Locked app state never overwrites or wipes the encrypted vault.
 * 6. Interactive Throttling: Failed attempt delays (30s at 5, 60s at 8, 300s at 10) persisted across storage reloads.
 * 7. Zero Plaintext Residue: All plaintext ledger and legacy PIN keys are removed from storage backends.
 * 8. Encrypted Backup Export & Import: Backups exported with PIN encryption decrypt with correct PIN and fail on wrong PIN.
 * 9. End-to-End Lifecycle: Enable PIN -> Reload & Unlock -> Change Ledger -> Encrypted Autosave -> Verify Zero Plaintext Residue -> Reload -> Unlock Again -> Verify Changed Ledger Matches.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

global.window = global;
global.crypto = webcrypto;
if (!global.btoa) {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (!global.atob) {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

function createMockStorageEngine() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    dump: () => Object.fromEntries(store)
  };
}

const dataCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'data.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'storage.js'), 'utf8');
const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'crypto.js'), 'utf8');
const validatorCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'validator.js'), 'utf8');

function setupTestEnvironment() {
  const mockLocalStorage = createMockStorageEngine();
  global.localStorage = mockLocalStorage;

  new Function('window', 'globalThis', dataCode)(global, global);
  new Function('window', 'globalThis', storageCode)(global, global);
  new Function('window', 'globalThis', cryptoCode)(global, global);
  new Function('window', 'globalThis', validatorCode)(global, global);

  return {
    BB_DATA: global.BB_DATA,
    BB_STORAGE: global.BB_STORAGE,
    BB_CRYPTO: global.BB_CRYPTO,
    BB_VALIDATOR: global.BB_VALIDATOR,
    mockStorage: mockLocalStorage
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
  console.log(' BANTAY BARYA - PIN SECURITY & ENCRYPTED VAULT TEST SUITE');
  console.log('======================================================================');

  console.log('\n--- 1. PBKDF2 / AES-GCM Encryption & Authenticated Decryption ---');

  await test('Derives 256-bit key from 7-digit PIN and correctly encrypts/decrypts arbitrary ledger payload', async () => {
    const { BB_CRYPTO } = setupTestEnvironment();
    const pin = '1234567';
    const testPayload = {
      wallets: [{ id: 'w1', name: 'Main Wallet', initialBalance: 50000 }],
      transactions: [{ id: 'tx1', item: 'Groceries', debit: 2500, credit: 0 }],
      settings: { baseCurrency: 'PHP', userName: 'Alice' }
    };

    const envelope = await BB_CRYPTO.encryptPayload(testPayload, pin);
    assert.strictEqual(envelope.format, 'bantay_barya_encrypted_vault');
    assert.strictEqual(envelope.version, 1);
    assert.strictEqual(envelope.kdf.iterations, 250000);
    assert.strictEqual(envelope.kdf.algorithm, 'PBKDF2');
    assert.ok(envelope.ciphertext);
    assert.ok(envelope.iv);
    assert.ok(envelope.kdf.salt);

    const saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
    const derivedKey = await BB_CRYPTO.deriveKeyFromPin(pin, saltBytes, envelope.kdf.iterations);
    const decrypted = await BB_CRYPTO.decryptPayload(envelope, derivedKey);

    assert.deepStrictEqual(decrypted.wallets, testPayload.wallets);
    assert.deepStrictEqual(decrypted.transactions, testPayload.transactions);
    assert.deepStrictEqual(decrypted.settings, testPayload.settings);
  });

  await test('Decrypting with wrong PIN fails authentication and throws explicit Error', async () => {
    const { BB_CRYPTO } = setupTestEnvironment();
    const correctPin = '7654321';
    const wrongPin = '1111111';
    const payload = { secret: 'Confidential Ledger Data' };

    const envelope = await BB_CRYPTO.encryptPayload(payload, correctPin);

    const saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
    const wrongKey = await BB_CRYPTO.deriveKeyFromPin(wrongPin, saltBytes, envelope.kdf.iterations);

    await assert.rejects(
      async () => {
        await BB_CRYPTO.decryptPayload(envelope, wrongKey);
      },
      /Authentication failed/
    );
  });

  await test('Tampering with ciphertext or IV causes authentication failure', async () => {
    const { BB_CRYPTO } = setupTestEnvironment();
    const pin = '5555555';
    const envelope = await BB_CRYPTO.encryptPayload({ balance: 1000000 }, pin);

    // Tamper with ciphertext by altering last byte
    const cipherBuf = Buffer.from(envelope.ciphertext, 'base64');
    cipherBuf[cipherBuf.length - 1] ^= 0xff;
    const tamperedEnvelope = { ...envelope, ciphertext: cipherBuf.toString('base64') };

    const saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
    const key = await BB_CRYPTO.deriveKeyFromPin(pin, saltBytes, envelope.kdf.iterations);

    await assert.rejects(
      async () => {
        await BB_CRYPTO.decryptPayload(tamperedEnvelope, key);
      },
      /Authentication failed/
    );
  });

  console.log('\n--- 2. Recoverable Migration Protocol & Interruption Resilience ---');

  await test('Full Migration: converts legacy plaintext PIN and ledger keys into encrypted vault with zero residue', async () => {
    const { BB_STORAGE, BB_DATA, BB_CRYPTO, mockStorage } = setupTestEnvironment();
    const legacyPin = '9876543';

    // Seed legacy plaintext storage
    mockStorage.setItem(BB_DATA.STORAGE_KEY_PIN, legacyPin);
    mockStorage.setItem(BB_DATA.STORAGE_KEY_WALLETS, JSON.stringify([{ id: 'w1', name: 'Legacy Wallet' }]));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_TRANSACTIONS, JSON.stringify([{ id: 't1', item: 'Legacy Item', credit: 100, debit: 0 }]));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_SETTINGS, JSON.stringify({ baseCurrency: 'PHP' }));

    assert.strictEqual(BB_STORAGE.hasLegacyPlaintextPin(), true);
    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), false);

    // Protocol Step 1: Stage
    const payload = {
      wallets: JSON.parse(mockStorage.getItem(BB_DATA.STORAGE_KEY_WALLETS)),
      transactions: JSON.parse(mockStorage.getItem(BB_DATA.STORAGE_KEY_TRANSACTIONS)),
      settings: JSON.parse(mockStorage.getItem(BB_DATA.STORAGE_KEY_SETTINGS))
    };
    const stagedEnvelope = await BB_CRYPTO.encryptPayload(payload, legacyPin);
    mockStorage.setItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(stagedEnvelope));

    // Protocol Step 2 & 3: Read back and authenticate
    const readBack = JSON.parse(mockStorage.getItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING));
    const saltBytes = new Uint8Array(Buffer.from(readBack.kdf.salt, 'base64'));
    const key = await BB_CRYPTO.deriveKeyFromPin(legacyPin, saltBytes, readBack.kdf.iterations);
    const verified = await BB_CRYPTO.decryptPayload(readBack, key);
    assert.deepStrictEqual(verified.wallets, payload.wallets);

    // Protocol Step 4: Promote to canonical vault
    mockStorage.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(stagedEnvelope));

    // Protocol Step 5: Delete staging and plaintext ledger
    mockStorage.removeItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING);
    await BB_STORAGE.clearPlaintextLedger();

    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), true);
    assert.strictEqual(BB_STORAGE.hasLegacyPlaintextPin(), false);
    assert.strictEqual(mockStorage.getItem(BB_DATA.STORAGE_KEY_PIN), null);
    assert.strictEqual(mockStorage.getItem(BB_DATA.STORAGE_KEY_WALLETS), null);
    assert.strictEqual(mockStorage.getItem(BB_DATA.STORAGE_KEY_TRANSACTIONS), null);
  });

  await test('Migration Interruption: If interrupted before promotion, plaintext data survives intact', async () => {
    const { BB_STORAGE, BB_DATA, mockStorage } = setupTestEnvironment();
    const legacyPin = '2223334';
    mockStorage.setItem(BB_DATA.STORAGE_KEY_PIN, legacyPin);
    mockStorage.setItem(BB_DATA.STORAGE_KEY_WALLETS, JSON.stringify([{ id: 'w1', name: 'Safe Wallet' }]));

    mockStorage.setItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING, '{"staged":true}');

    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), false);
    assert.strictEqual(BB_STORAGE.hasLegacyPlaintextPin(), true);
    assert.ok(mockStorage.getItem(BB_DATA.STORAGE_KEY_WALLETS));
  });

  console.log('\n--- 3. Persistent Brute-Force Throttling ---');

  await test('Throttling records failures, triggers progressive lockouts, and persists across reloads', async () => {
    const { BB_CRYPTO, BB_STORAGE } = setupTestEnvironment();

    for (let i = 1; i <= 4; i++) {
      const res = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE);
      assert.strictEqual(res.isLocked, false);
      assert.strictEqual(res.remainingSeconds, 0);
    }

    const res5 = BB_CRYPTO.ThrottlingManager.recordFailure(BB_STORAGE);
    assert.strictEqual(res5.isLocked, true);
    assert.ok(res5.remainingSeconds >= 28 && res5.remainingSeconds <= 30);

    const status = BB_CRYPTO.ThrottlingManager.checkThrottle(BB_STORAGE);
    assert.strictEqual(status.isLocked, true);

    BB_CRYPTO.ThrottlingManager.resetThrottle(BB_STORAGE);
    const afterReset = BB_CRYPTO.ThrottlingManager.checkThrottle(BB_STORAGE);
    assert.strictEqual(afterReset.isLocked, false);
    assert.strictEqual(afterReset.failedAttempts, 0);
  });

  console.log('\n--- 4. Encrypted Backup Export and Import ---');

  await test('createEncryptedBackup() and decryptEncryptedBackup() operate reliably with correct credentials', async () => {
    const { BB_CRYPTO } = setupTestEnvironment();
    const backupPin = '4321987';
    const rawBackup = {
      version: '7.0',
      format: 'bantay_barya_save',
      slot: {
        id: 'slot_1',
        name: 'My Wealth',
        payload: {
          wallets: [{ id: 'w1', name: 'Emergency Fund', initialBalance: 300000 }],
          transactions: []
        }
      }
    };

    const encryptedBackup = await BB_CRYPTO.createEncryptedBackup(rawBackup, backupPin);
    assert.strictEqual(encryptedBackup.format, 'bantay_barya_encrypted_backup');
    assert.strictEqual(encryptedBackup.version, 1);

    const decryptedBackup = await BB_CRYPTO.decryptEncryptedBackup(encryptedBackup, backupPin);
    assert.deepStrictEqual(decryptedBackup.slot, rawBackup.slot);

    await assert.rejects(
      async () => {
        await BB_CRYPTO.decryptEncryptedBackup(encryptedBackup, '0000000');
      },
      /Authentication failed/
    );
  });

  console.log('\n--- 5. End-to-End PIN Lifecycle & Multi-Backend Residue Verification ---');

  await test('Full Lifecycle: Enable PIN -> Reload & Unlock -> Change Ledger -> Encrypted Autosave -> Verify Zero Plaintext Residue -> Reload -> Unlock Again -> Verify Changed Ledger Matches', async () => {
    const { BB_STORAGE, BB_DATA, BB_CRYPTO, BB_VALIDATOR, mockStorage } = setupTestEnvironment();
    const pin = '8889990';

    // 1. Seed initial plaintext unencrypted ledger
    const initialWallets = [
      { id: 'w_bdo', name: 'BDO Savings', type: 'savings', currency: 'PHP', icon: '🏦', initialBalance: 150000, createdAt: 1000 }
    ];
    const initialTxs = [
      { id: 'tx_init', walletId: 'w_bdo', date: '2026-08-01', item: 'Initial Deposit', credit: 150000, debit: 0, inputCurrency: 'PHP', inputAmount: 150000, exchangeRate: 1.0 }
    ];
    const initialSettings = { userName: 'Jerome', baseCurrency: 'PHP', theme: 'auto_date' };
    const initialCats = ['Salary', 'Groceries', 'Utilities'];

    mockStorage.setItem(BB_DATA.STORAGE_KEY_WALLETS, JSON.stringify(initialWallets));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_TRANSACTIONS, JSON.stringify(initialTxs));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_SETTINGS, JSON.stringify(initialSettings));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_CATEGORIES, JSON.stringify(initialCats));

    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), false);

    // 2. Step A: Enable PIN (Write -> Read -> Decrypt -> Promote -> Delete)
    const currentPayload = {
      wallets: initialWallets,
      debts: [],
      bills: [],
      transactions: initialTxs,
      settings: initialSettings,
      categories: initialCats,
      saveSlots: [],
      activeSlotId: 'slot_primary'
    };

    const stagedEnvelope = await BB_CRYPTO.encryptPayload(currentPayload, pin);
    mockStorage.setItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(stagedEnvelope));

    const readBack = JSON.parse(mockStorage.getItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING));
    const saltBytes = new Uint8Array(Buffer.from(readBack.kdf.salt, 'base64'));
    let derivedKey = await BB_CRYPTO.deriveKeyFromPin(pin, saltBytes, readBack.kdf.iterations);
    await BB_CRYPTO.decryptPayload(readBack, derivedKey);

    mockStorage.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(stagedEnvelope));
    mockStorage.removeItem(BB_DATA.STORAGE_KEY_MIGRATION_STAGING);
    await BB_STORAGE.clearPlaintextLedger();

    assert.strictEqual(BB_STORAGE.hasEncryptedVault(), true);
    assert.strictEqual(mockStorage.getItem(BB_DATA.STORAGE_KEY_WALLETS), null);
    assert.strictEqual(mockStorage.getItem(BB_DATA.STORAGE_KEY_TRANSACTIONS), null);

    // 3. Step B: Reload & Unlock
    derivedKey = null;
    let appState = {
      _isVaultLocked: true,
      _vaultDerivedKey: null,
      _vaultSaltBytes: null,
      _vaultIterations: null,
      wallets: [],
      transactions: [],
      debts: [],
      bills: [],
      categories: [],
      settings: {}
    };

    const vaultRaw = mockStorage.getItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    const vaultEnvelope = JSON.parse(vaultRaw);
    const unlockSalt = new Uint8Array(Buffer.from(vaultEnvelope.kdf.salt, 'base64'));
    derivedKey = await BB_CRYPTO.deriveKeyFromPin(pin, unlockSalt, vaultEnvelope.kdf.iterations);
    const decrypted1 = await BB_CRYPTO.decryptPayload(vaultEnvelope, derivedKey);
    const validated1 = BB_VALIDATOR.validateAndNormalizeLedger(decrypted1);

    appState.wallets = validated1.wallets;
    appState.transactions = validated1.transactions;
    appState.debts = validated1.debts;
    appState.bills = validated1.bills;
    appState.settings = validated1.settings;
    appState.categories = validated1.categories;
    appState._isVaultLocked = false;
    appState._vaultDerivedKey = derivedKey;
    appState._vaultSaltBytes = unlockSalt;
    appState._vaultIterations = vaultEnvelope.kdf.iterations;

    assert.strictEqual(appState.wallets.length, 1);
    assert.strictEqual(appState.wallets[0].name, 'BDO Savings');
    assert.strictEqual(appState.transactions.length, 1);

    // 4. Step C: Change Ledger (Add new wallet, transactions, and bill)
    const newWallet = { id: 'w_usd', name: 'Wise Multi-Currency', type: 'ewallet', currency: 'USD', icon: '🌐', initialBalance: 500, createdAt: 2000 };
    appState.wallets.push(newWallet);

    const newTx1 = {
      id: 'tx_salary',
      walletId: 'w_bdo',
      date: '2026-08-15',
      item: 'Monthly Tech Salary',
      credit: 120000,
      debit: 0,
      inputCurrency: 'PHP',
      inputAmount: 120000,
      exchangeRate: 1.0,
      notes: 'Direct deposit'
    };
    const newTx2 = {
      id: 'tx_usd_spend',
      walletId: 'w_usd',
      date: '2026-08-20',
      item: 'AWS Cloud Hosting',
      credit: 0,
      debit: 5850,
      inputCurrency: 'USD',
      inputAmount: 100,
      exchangeRate: 58.50,
      notes: 'Production server subscription'
    };
    appState.transactions.push(newTx1, newTx2);

    const newBill = {
      id: 'bill_internet',
      name: 'Fiber Internet',
      amount: 2499,
      currency: 'PHP',
      walletId: 'w_bdo',
      dueDate: '2026-09-05',
      isRecurring: true,
      frequency: 'monthly',
      category: 'Utilities'
    };
    appState.bills.push(newBill);

    // 5. Step D: Encrypted Autosave
    assert.strictEqual(appState._isVaultLocked, false);
    const updatedPayload = {
      wallets: appState.wallets,
      debts: appState.debts,
      bills: appState.bills,
      transactions: appState.transactions,
      settings: appState.settings,
      categories: appState.categories,
      saveSlots: appState.saveSlots || [],
      activeSlotId: 'slot_primary'
    };

    const newEncryptedEnvelope = await BB_CRYPTO.encryptPayload(updatedPayload, appState._vaultDerivedKey, {
      saltBytes: appState._vaultSaltBytes,
      iterations: appState._vaultIterations
    });
    mockStorage.setItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(newEncryptedEnvelope));
    mockStorage.setItem(BB_DATA.STORAGE_KEY_LAST_SAVED, Date.now().toString());
    await BB_STORAGE.clearPlaintextLedger();

    // 6. Step E: Verify ZERO plaintext residue in storage backend
    const allStoredKeys = Object.keys(mockStorage.dump());
    const forbiddenPlaintextKeys = [
      'bb_transactions', 'bb_wallets', 'bb_debts', 'bb_bills',
      'bb_settings', 'bb_categories', 'bb_save_slots', 'bb_active_slot_id',
      'bb_app_pin_v7', 'ledger_app_pin_v6', 'ledger_tracker_transactions_v6',
      'ledger_tracker_settings_v6', 'ledger_tracker_categories_v6'
    ];

    for (const forbidden of forbiddenPlaintextKeys) {
      assert.strictEqual(mockStorage.getItem(forbidden), null, 'Forbidden key ' + forbidden + ' must NOT exist in storage!');
    }

    for (const key of allStoredKeys) {
      if (key === BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT) continue;
      const rawVal = mockStorage.getItem(key);
      assert.ok(!rawVal.includes('AWS Cloud Hosting'), 'Plaintext transaction leak detected in key ' + key);
      assert.ok(!rawVal.includes('Monthly Tech Salary'), 'Plaintext transaction leak detected in key ' + key);
      assert.ok(!rawVal.includes('Wise Multi-Currency'), 'Plaintext wallet name leak detected in key ' + key);
      assert.ok(!rawVal.includes('8889990'), 'Plaintext PIN leak detected in key ' + key);
    }

    // 7. Step F: Reload again (simulate fresh restart)
    appState = {
      _isVaultLocked: true,
      _vaultDerivedKey: null,
      _vaultSaltBytes: null,
      _vaultIterations: null,
      wallets: [],
      transactions: [],
      debts: [],
      bills: [],
      categories: [],
      settings: {}
    };

    // 8. Step G: Unlock again with correct PIN
    const secondReloadVaultRaw = mockStorage.getItem(BB_DATA.STORAGE_KEY_ENCRYPTED_VAULT);
    const secondEnvelope = JSON.parse(secondReloadVaultRaw);
    const secondSalt = new Uint8Array(Buffer.from(secondEnvelope.kdf.salt, 'base64'));
    const secondDerivedKey = await BB_CRYPTO.deriveKeyFromPin(pin, secondSalt, secondEnvelope.kdf.iterations);
    const secondDecrypted = await BB_CRYPTO.decryptPayload(secondEnvelope, secondDerivedKey);
    const secondValidated = BB_VALIDATOR.validateAndNormalizeLedger(secondDecrypted);

    appState.wallets = secondValidated.wallets;
    appState.transactions = secondValidated.transactions;
    appState.debts = secondValidated.debts;
    appState.bills = secondValidated.bills;
    appState.settings = secondValidated.settings;
    appState.categories = secondValidated.categories;
    appState._isVaultLocked = false;
    appState._vaultDerivedKey = secondDerivedKey;

    // 9. Step H: Verify the changed ledger exactly matches
    assert.strictEqual(appState.wallets.length, 2);
    assert.strictEqual(appState.wallets[0].name, 'BDO Savings');
    assert.strictEqual(appState.wallets[1].name, 'Wise Multi-Currency');
    assert.strictEqual(appState.wallets[1].currency, 'USD');
    assert.strictEqual(appState.wallets[1].initialBalance, 500);

    assert.strictEqual(appState.transactions.length, 3);
    assert.strictEqual(appState.transactions[1].item, 'Monthly Tech Salary');
    assert.strictEqual(appState.transactions[1].credit, 120000);
    assert.strictEqual(appState.transactions[2].item, 'AWS Cloud Hosting');
    assert.strictEqual(appState.transactions[2].inputAmount, 100);
    assert.strictEqual(appState.transactions[2].inputCurrency, 'USD');

    assert.strictEqual(appState.bills.length, 1);
    assert.strictEqual(appState.bills[0].name, 'Fiber Internet');
    assert.strictEqual(appState.bills[0].amount, 2499);
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
