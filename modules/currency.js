/**
 * Bantay Barya - Pure Multi-Currency & Ledger Calculation Engine
 * Provides deterministic currency conversions, native wallet balances,
 * combined base totals, transfer neutrality, and FIFO spending buffer runway.
 */

(function (global) {
  'use strict';

  const FALLBACK_USD_RATES = {
    USD: 1.0,
    PHP: 58.50,
    EUR: 0.92,
    JPY: 155.20,
    GBP: 0.79,
    SGD: 1.35,
    AUD: 1.52,
    CAD: 1.36,
    HKD: 7.82,
    CNY: 7.24,
    KRW: 1380.0,
    THB: 36.80,
    AED: 3.67
  };

  function roundMoney(val) {
    const num = parseFloat(val);
    if (!Number.isFinite(num)) return 0;
    const sign = num < 0 ? -1 : 1;
    return sign * (Math.round(Math.abs(num) * 100) / 100);
  }

  function getFxRate(fromCurr, toCurr, customRates = {}) {
    if (!fromCurr || !toCurr || fromCurr === toCurr) return 1.0;
    const key = `${fromCurr}_${toCurr}`;
    if (customRates && typeof customRates[key] === 'number') {
      return customRates[key];
    }
    const fromUsd = customRates[fromCurr] || FALLBACK_USD_RATES[fromCurr] || 1.0;
    const toUsd = customRates[toCurr] || FALLBACK_USD_RATES[toCurr] || 1.0;
    return toUsd / fromUsd;
  }

  function convertCurrency(amount, fromCurr, toCurr, customRates = {}) {
    const num = parseFloat(amount) || 0;
    if (!fromCurr || !toCurr || fromCurr === toCurr) return roundMoney(num);
    const rate = getFxRate(fromCurr, toCurr, customRates);
    return roundMoney(num * rate);
  }

  function getWalletBalance(wallet, transactions = [], baseCurrency = 'PHP', customRates = {}) {
    if (!wallet) return 0;
    const wCurr = wallet.currency || baseCurrency;
    let balance = parseFloat(wallet.initialBalance) || 0;

    const txList = (transactions || [])
      .filter(t => t.walletId === wallet.id && !t.isArchived)
      .sort((a, b) => {
        if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
        return (a.date || '').localeCompare(b.date || '');
      });

    for (const tx of txList) {
      let crNative = 0;
      let dbNative = 0;

      if (tx.inputCurrency === wCurr && tx.inputAmount !== undefined) {
        const amt = parseFloat(tx.inputAmount) || 0;
        if (tx.type === 'credit' || tx.type === 'transfer_in') crNative = amt;
        if (tx.type === 'debit' || tx.type === 'transfer_out') dbNative = amt;
      } else {
        const crBase = parseFloat(tx.credit) || 0;
        const dbBase = parseFloat(tx.debit) || 0;

        if (wCurr === baseCurrency) {
          crNative = crBase;
          dbNative = dbBase;
        } else if (tx.exchangeRate && tx.exchangeRate > 0) {
          // If transaction has recorded exchange rate relative to wallet/base
          // Rate direction: 1 foreign = exchangeRate base => foreign = base / exchangeRate
          crNative = roundMoney(crBase / tx.exchangeRate);
          dbNative = roundMoney(dbBase / tx.exchangeRate);
        } else {
          crNative = convertCurrency(crBase, baseCurrency, wCurr, customRates);
          dbNative = convertCurrency(dbBase, baseCurrency, wCurr, customRates);
        }
      }

      balance = balance + crNative - dbNative;
    }

    return roundMoney(balance);
  }

  function getWalletBaseBalance(wallet, transactions = [], baseCurrency = 'PHP', customRates = {}) {
    if (!wallet) return 0;
    const nativeBal = getWalletBalance(wallet, transactions, baseCurrency, customRates);
    const wCurr = (wallet.currency || baseCurrency).toUpperCase();
    if (wCurr === baseCurrency.toUpperCase()) return nativeBal;
    return convertCurrency(nativeBal, wCurr, baseCurrency, customRates);
  }

  function getTotalBaseBalance(wallets = [], transactions = [], baseCurrency = 'PHP', customRates = {}) {
    let total = 0;
    for (const w of wallets) {
      const baseBal = getWalletBaseBalance(w, transactions, baseCurrency, customRates);
      total += baseBal;
    }
    return roundMoney(total);
  }

  function calculateSpendingBuffer(wallets = [], transactions = [], baseCurrency = 'PHP', walletFilter = 'all', customRates = {}) {
    let txList = transactions || [];
    let initialBal = 0;

    if (walletFilter !== 'all') {
      txList = txList.filter(t => t.walletId === walletFilter && !t.isArchived);
      const targetWallet = wallets.find(w => w.id === walletFilter);
      initialBal = targetWallet ? (parseFloat(targetWallet.initialBalance) || 0) : 0;
    } else {
      // In aggregate mode, convert all wallet initial balances to base currency
      initialBal = wallets.reduce((acc, w) => {
        const wCurr = w.currency || baseCurrency;
        const bal = parseFloat(w.initialBalance) || 0;
        const baseBal = wCurr === baseCurrency ? bal : convertCurrency(bal, wCurr, baseCurrency, customRates);
        return acc + baseBal;
      }, 0);
    }

    const sorted = [...txList].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return (a.date || '').localeCompare(b.date || '');
    });

    const now = new Date();
    let defaultInitDate;
    if (sorted.length > 0 && sorted[0].date) {
      const firstTxDate = new Date(sorted[0].date + 'T00:00:00');
      defaultInitDate = new Date(firstTxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      defaultInitDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const inflowQueue = [];
    if (initialBal > 0) {
      inflowQueue.push({ date: defaultInitDate, remaining: initialBal });
    }

    let totalCredits = 0;
    let totalDebits = 0;
    let lastDebitDate = null;
    let lastInflowBatchDate = null;

    for (const tx of sorted) {
      if (tx.isArchived) continue;
      // In aggregate mode, transfers are net-neutral and must NOT distort FIFO cash runway
      if (walletFilter === 'all' && (tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in')) {
        continue;
      }

      const credit = parseFloat(tx.credit) || 0;
      const debit = parseFloat(tx.debit) || 0;
      totalCredits += credit;
      totalDebits += debit;

      const txDateObj = new Date((tx.date || '') + 'T00:00:00');

      if (credit > 0) {
        inflowQueue.push({ date: txDateObj, remaining: credit });
      }

      if (debit > 0) {
        let needed = debit;
        lastDebitDate = txDateObj;

        while (needed > 0 && inflowQueue.length > 0) {
          const currentBatch = inflowQueue[0];
          lastInflowBatchDate = currentBatch.date;

          if (currentBatch.remaining <= needed) {
            needed -= currentBatch.remaining;
            inflowQueue.shift();
          } else {
            currentBatch.remaining -= needed;
            needed = 0;
          }
        }
      }
    }

    const currentNet = initialBal + totalCredits - totalDebits;

    if (txList.length === 0 && initialBal <= 0) {
      return { days: 0, hasSpends: false, hasFunds: false };
    }
    if (!lastDebitDate) {
      return { days: 0, hasSpends: false, hasFunds: currentNet > 0 };
    }
    if (!lastInflowBatchDate) {
      return { days: 0, hasSpends: true, hasFunds: currentNet > 0 };
    }

    const diffTime = lastDebitDate.getTime() - lastInflowBatchDate.getTime();
    const bufferDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    return { days: bufferDays, hasSpends: true, hasFunds: currentNet > 0 };
  }

  const CurrencyModule = {
    FALLBACK_USD_RATES,
    roundMoney,
    getFxRate,
    convertCurrency,
    getWalletBalance,
    getWalletBaseBalance,
    getTotalBaseBalance,
    calculateSpendingBuffer
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyModule;
  }
  global.BB_CURRENCY = CurrencyModule;
})(typeof globalThis !== 'undefined' ? globalThis : window);
