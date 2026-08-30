/**
 * Bantay Barya - Strict Schema Validator & Normalization Engine
 * Protects application against hostile imports, prototype pollution, malformed types,
 * oversized payloads, and referential integrity violations.
 */

(function (global) {
  'use strict';

  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
  const MAX_JSON_DEPTH = 10;

  const MAX_TRANSACTIONS = 50000;
  const MAX_WALLETS = 100;
  const MAX_DEBTS = 200;
  const MAX_BILLS = 200;
  const MAX_CATEGORIES = 500;
  const MAX_SAVE_SLOTS = 50;

  const MAX_STRING_NAME = 100;
  const MAX_STRING_NOTES = 2000;
  const MAX_STRING_ID = 64;

  const VALID_ID_PATTERN = /^[a-zA-Z0-9_\-\.]{1,64}$/;
  const SUPPORTED_CURRENCIES = new Set([
    'PHP', 'USD', 'EUR', 'JPY', 'GBP', 'SGD', 'AUD', 'CAD', 'HKD', 'CNY', 'KRW', 'THB', 'AED',
    'CHF', 'NZD', 'MYR', 'IDR', 'INR', 'VND', 'TWD', 'SAR', 'QAR', 'BRL', 'MXN', 'ZAR'
  ]);
  const VALID_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  function isValidCurrencyCode(code) {
    return typeof code === 'string' && SUPPORTED_CURRENCIES.has(code.toUpperCase());
  }

  const VALID_WALLET_TYPES = new Set([
    'ewallet', 'spending', 'savings', 'crypto', 'investment',
    'time_deposit', 'bond', 'real_estate', 'current', 'cash', 'credit', 'other'
  ]);

  const VALID_TX_TYPES = new Set(['credit', 'debit', 'transfer_in', 'transfer_out']);
  const VALID_DEBT_METHODS = new Set(['diminishing', 'flat']);
  const VALID_BILL_FREQUENCIES = new Set(['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']);

  class ValidationError extends Error {
    constructor(message, fieldPath = '') {
      super(fieldPath ? `[Validation Error at ${fieldPath}]: ${message}` : `[Validation Error]: ${message}`);
      this.name = 'ValidationError';
      this.fieldPath = fieldPath;
    }
  }

  function isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]' && obj !== null;
  }

  function checkPrototypePollution(obj, depth = 0, path = '') {
    if (depth > MAX_JSON_DEPTH) {
      throw new ValidationError('JSON structure exceeds maximum allowed nesting depth', path);
    }
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        checkPrototypePollution(obj[i], depth + 1, `${path}[${i}]`);
      }
      return;
    }

    const keys = Object.getOwnPropertyNames(obj);
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new ValidationError(`Dangerous prototype pollution key detected: "${key}"`, path ? `${path}.${key}` : key);
      }
      checkPrototypePollution(obj[key], depth + 1, path ? `${path}.${key}` : key);
    }
  }

  function isDaysInMonthValid(year, month, day) {
    const daysInMonth = new Date(year, month, 0).getDate();
    return day >= 1 && day <= daysInMonth;
  }

  function isValidCalendarDate(dateStr) {
    if (typeof dateStr !== 'string' || !VALID_DATE_PATTERN.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y < 1900 || y > 2100) return false;
    return isDaysInMonthValid(y, m, d);
  }

  function sanitizeString(str, maxLen = 100, allowEmpty = true) {
    if (str === null || str === undefined) return allowEmpty ? '' : null;
    if (typeof str !== 'string') return null;
    const clean = str.trim().slice(0, maxLen);
    if (!allowEmpty && clean.length === 0) return null;
    return clean;
  }

  function sanitizeNumber(val, { min = -Infinity, max = Infinity, fallback = 0, allowNegative = true } = {}) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      if (!allowNegative && val < 0) return null;
      if (val < min || val > max) return null;
      return Math.round(val * 100) / 100;
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (Number.isFinite(parsed)) {
        if (!allowNegative && parsed < 0) return null;
        if (parsed < min || parsed > max) return null;
        return Math.round(parsed * 100) / 100;
      }
    }
    return fallback;
  }

  /**
   * Validate and normalize an imported ledger or save-slot payload
   */
  function validateAndNormalizeLedger(rawInput, options = {}) {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new ValidationError('Import payload must be a non-null object');
    }

    const depth = typeof options.depth === 'number' ? options.depth : 1;
    if (depth > 2) {
      throw new ValidationError('Maximum nested payload recursion depth exceeded', 'depth');
    }
    const isSlotPayload = Boolean(options.isSlotPayload);

    checkPrototypePollution(rawInput);

    let source = rawInput;
    if (rawInput.format === 'bantay_barya_save' && isPlainObject(rawInput.slot)) {
      source = rawInput.slot.payload || rawInput.slot;
    } else if (isPlainObject(rawInput.payload)) {
      source = rawInput.payload;
    }

    const normalized = {
      wallets: [],
      transactions: [],
      debts: [],
      bills: [],
      categories: [],
      settings: { userName: '', baseCurrency: 'PHP', theme: 'auto_date' },
      saveSlots: [],
      activeSlotId: 'slot_primary'
    };

    // 1. Settings validation
    const rawSettings = source.settings || rawInput.settings;
    if (isPlainObject(rawSettings)) {
      const rawBase = sanitizeString(rawSettings.baseCurrency, 3);
      const baseCurr = rawBase ? rawBase.toUpperCase() : '';
      normalized.settings.baseCurrency = isValidCurrencyCode(baseCurr) ? baseCurr : 'PHP';
      normalized.settings.userName = sanitizeString(rawSettings.userName, MAX_STRING_NAME) || '';
      normalized.settings.theme = sanitizeString(rawSettings.theme, 50) || 'auto_date';
    }

    const baseCurr = normalized.settings.baseCurrency;

    // 2. Wallets validation
    const rawWallets = source.wallets || rawInput.wallets;
    const walletIdSet = new Set();

    if (Array.isArray(rawWallets)) {
      if (rawWallets.length > MAX_WALLETS) {
        throw new ValidationError(`Wallets array exceeds maximum allowed size (${MAX_WALLETS})`, 'wallets');
      }

      for (let i = 0; i < rawWallets.length; i++) {
        const w = rawWallets[i];
        const path = `wallets[${i}]`;
        if (!isPlainObject(w)) throw new ValidationError('Wallet entry must be an object', path);

        let id = sanitizeString(w.id, MAX_STRING_ID, false);
        if (!id || !VALID_ID_PATTERN.test(id)) {
          id = `wallet_${Date.now()}_${i}`;
        }
        if (walletIdSet.has(id)) {
          id = `${id}_${i}`;
        }
        walletIdSet.add(id);

        const name = sanitizeString(w.name, MAX_STRING_NAME, false) || `Wallet ${i + 1}`;
        const type = VALID_WALLET_TYPES.has(w.type) ? w.type : 'spending';
        const rawCurr = sanitizeString(w.currency, 3);
        const upperCurr = rawCurr ? rawCurr.toUpperCase() : '';
        const currency = isValidCurrencyCode(upperCurr) ? upperCurr : baseCurr;
        const icon = sanitizeString(w.icon, 10) || '👛';
        const initBal = sanitizeNumber(w.initialBalance, { fallback: 0 });

        normalized.wallets.push({
          id,
          name,
          type,
          currency,
          icon,
          initialBalance: initBal !== null ? initBal : 0,
          createdAt: typeof w.createdAt === 'number' && w.createdAt > 0 ? w.createdAt : Date.now()
        });
      }
    }

    if (normalized.wallets.length === 0) {
      const defId = 'wallet_default';
      walletIdSet.add(defId);
      normalized.wallets.push({
        id: defId,
        name: 'Personal Spending',
        type: 'spending',
        currency: baseCurr,
        icon: '👛',
        initialBalance: 0,
        createdAt: 1
      });
    }

    const defaultWalletId = normalized.wallets[0].id;

    // 3. Transactions validation
    const rawTx = source.transactions || rawInput.transactions;
    const txIdSet = new Set();

    if (Array.isArray(rawTx)) {
      if (rawTx.length > MAX_TRANSACTIONS) {
        throw new ValidationError(`Transactions array exceeds maximum limit (${MAX_TRANSACTIONS})`, 'transactions');
      }

      for (let i = 0; i < rawTx.length; i++) {
        const t = rawTx[i];
        const path = `transactions[${i}]`;
        if (!isPlainObject(t)) throw new ValidationError('Transaction entry must be an object', path);

        let id = sanitizeString(t.id, MAX_STRING_ID, false);
        if (!id || !VALID_ID_PATTERN.test(id) || txIdSet.has(id)) {
          id = `tx_${Date.now()}_${i}`;
        }
        txIdSet.add(id);

        let walletId = sanitizeString(t.walletId, MAX_STRING_ID, false);
        if (!walletId || !walletIdSet.has(walletId)) {
          walletId = defaultWalletId;
        }

        const date = isValidCalendarDate(t.date) ? t.date : new Date().toISOString().split('T')[0];
        const item = sanitizeString(t.item, MAX_STRING_NAME, false) || 'General';
        const type = VALID_TX_TYPES.has(t.type) ? t.type : (t.credit > 0 ? 'credit' : 'debit');

        const credit = sanitizeNumber(t.credit, { min: 0, fallback: 0, allowNegative: false }) || 0;
        const debit = sanitizeNumber(t.debit, { min: 0, fallback: 0, allowNegative: false }) || 0;

        const inputCurrRaw = sanitizeString(t.inputCurrency, 3);
        const upperTxCurr = inputCurrRaw ? inputCurrRaw.toUpperCase() : '';
        const inputCurrency = isValidCurrencyCode(upperTxCurr) ? upperTxCurr : baseCurr;
        const inputAmount = sanitizeNumber(t.inputAmount, { min: 0, fallback: credit || debit || 0, allowNegative: false });
        const exchangeRate = sanitizeNumber(t.exchangeRate, { min: 0.000001, fallback: 1.0, allowNegative: false });
        const notes = sanitizeString(t.notes, MAX_STRING_NOTES) || '';

        normalized.transactions.push({
          id,
          walletId,
          date,
          item,
          type,
          credit,
          debit,
          inputCurrency,
          inputAmount: inputAmount !== null ? inputAmount : (credit || debit || 0),
          exchangeRate: exchangeRate !== null ? exchangeRate : 1.0,
          notes,
          createdAt: typeof t.createdAt === 'number' && t.createdAt > 0 ? t.createdAt : Date.now(),
          isTransfer: Boolean(t.isTransfer),
          transferId: sanitizeString(t.transferId, MAX_STRING_ID) || undefined,
          isArchived: Boolean(t.isArchived)
        });
      }
    }

    // 4. Debts validation
    const rawDebts = source.debts || rawInput.debts;
    if (Array.isArray(rawDebts)) {
      if (rawDebts.length > MAX_DEBTS) throw new ValidationError(`Debts array exceeds maximum limit (${MAX_DEBTS})`, 'debts');

      for (let i = 0; i < rawDebts.length; i++) {
        const d = rawDebts[i];
        const path = `debts[${i}]`;
        if (!isPlainObject(d)) continue;

        let id = sanitizeString(d.id, MAX_STRING_ID, false) || `debt_${Date.now()}_${i}`;
        const name = sanitizeString(d.name, MAX_STRING_NAME, false) || `Debt ${i + 1}`;
        const balance = sanitizeNumber(d.balance, { min: 0, fallback: 0, allowNegative: false }) || 0;
        const monthlyRate = sanitizeNumber(d.monthlyRate !== undefined ? d.monthlyRate : (d.apr ? d.apr / 12 : 0), { min: 0, fallback: 0, allowNegative: false }) || 0;
        const rawMinPay = d.minPayment !== undefined ? d.minPayment : d.minimumPayment;
        const minPayment = sanitizeNumber(rawMinPay, { min: 0, fallback: 0, allowNegative: false }) || 0;
        const interestMethod = VALID_DEBT_METHODS.has(d.interestMethod) ? d.interestMethod : 'diminishing';

        normalized.debts.push({
          id,
          name,
          type: sanitizeString(d.type, 30) || 'credit_card',
          icon: sanitizeString(d.icon, 10) || '💳',
          balance,
          monthlyRate,
          minPayment,
          interestMethod,
          originalPrincipal: sanitizeNumber(d.originalPrincipal, { min: 0, fallback: balance, allowNegative: false }) || balance,
          createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now()
        });
      }
    }

    // 5. Bills validation
    const rawBills = source.bills || rawInput.bills;
    if (Array.isArray(rawBills)) {
      if (rawBills.length > MAX_BILLS) throw new ValidationError(`Bills array exceeds maximum limit (${MAX_BILLS})`, 'bills');

      for (let i = 0; i < rawBills.length; i++) {
        const b = rawBills[i];
        const path = `bills[${i}]`;
        if (!isPlainObject(b)) continue;

        let id = sanitizeString(b.id, MAX_STRING_ID, false) || `bill_${Date.now()}_${i}`;
        const name = sanitizeString(b.name, MAX_STRING_NAME, false) || `Bill ${i + 1}`;
        const amount = sanitizeNumber(b.amount, { min: 0, fallback: 0, allowNegative: false }) || 0;
        const rawCurr = sanitizeString(b.currency, 3);
        const upperBillCurr = rawCurr ? rawCurr.toUpperCase() : '';
        const currency = isValidCurrencyCode(upperBillCurr) ? upperBillCurr : baseCurr;
        const dueDate = isValidCalendarDate(b.dueDate) ? b.dueDate : new Date().toISOString().split('T')[0];
        const isRecurring = Boolean(b.isRecurring);
        const frequency = VALID_BILL_FREQUENCIES.has(b.frequency) ? b.frequency : 'monthly';
        let walletId = sanitizeString(b.walletId, MAX_STRING_ID, false);
        if (!walletId || !walletIdSet.has(walletId)) walletId = defaultWalletId;

        normalized.bills.push({
          id,
          name,
          amount,
          currency,
          walletId,
          dueDate,
          isRecurring,
          frequency,
          category: sanitizeString(b.category, MAX_STRING_NAME) || 'Utilities',
          status: b.status === 'paid' ? 'paid' : 'unpaid',
          lastPaidDate: isValidCalendarDate(b.lastPaidDate) ? b.lastPaidDate : null,
          autoPostTx: Boolean(b.autoPostTx),
          notes: sanitizeString(b.notes, MAX_STRING_NOTES) || '',
          createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now()
        });
      }
    }

    // 6. Categories validation
    const rawCats = source.categories || rawInput.categories;
    const catSet = new Set(['Balance Brought Forward', 'Balance Reconciliation']);

    if (Array.isArray(rawCats)) {
      if (rawCats.length > MAX_CATEGORIES) throw new ValidationError(`Categories array exceeds maximum limit (${MAX_CATEGORIES})`, 'categories');

      for (const c of rawCats) {
        const cleanCat = sanitizeString(c, MAX_STRING_NAME, false);
        if (cleanCat) catSet.add(cleanCat);
      }
    }
    normalized.categories = Array.from(catSet);

    // 7. Save slots validation (recursive with bounded depth, ignoring nested saveSlots)
    if (!isSlotPayload) {
      const rawSlots = source.saveSlots || rawInput.saveSlots;
      if (Array.isArray(rawSlots)) {
        if (rawSlots.length > MAX_SAVE_SLOTS) throw new ValidationError(`Save slots array exceeds maximum limit (${MAX_SAVE_SLOTS})`, 'saveSlots');

        for (let i = 0; i < rawSlots.length; i++) {
          const s = rawSlots[i];
          if (!isPlainObject(s)) continue;

          const slotId = sanitizeString(s.id, MAX_STRING_ID, false) || `slot_${Date.now()}_${i}`;
          const slotName = sanitizeString(s.name, MAX_STRING_NAME, false) || `Slot ${i + 1}`;
          let slotPayload = null;
          if (isPlainObject(s.payload)) {
            // Recursively validate slot payload without allowing nested saveSlots
            slotPayload = validateAndNormalizeLedger(s.payload, {
              isSlotPayload: true,
              depth: depth + 1
            });
            delete slotPayload.saveSlots;
            delete slotPayload.activeSlotId;
          }

          normalized.saveSlots.push({
            id: slotId,
            name: slotName,
            description: sanitizeString(s.description, MAX_STRING_NOTES) || '',
            icon: sanitizeString(s.icon, 10) || '🌟',
            createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
            updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
            payload: slotPayload
          });
        }
      }
    }

    return normalized;
  }

  const ValidatorModule = {
    ValidationError,
    MAX_FILE_SIZE_BYTES,
    isPlainObject,
    checkPrototypePollution,
    isValidCalendarDate,
    sanitizeString,
    sanitizeNumber,
    validateAndNormalizeLedger
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidatorModule;
  }
  global.BB_VALIDATOR = ValidatorModule;
})(typeof globalThis !== 'undefined' ? globalThis : window);
