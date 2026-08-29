/**
 * Bantay Barya - Multi-Wallet Engine, Save Vault (.barya), FX Conversion, FIFO Spending Buffer & Reconciliation
 */
(function (window) {
  'use strict';

  const {
    CURRENCIES,
    DEFAULT_WALLETS,
    DEFAULT_CATEGORIES,
    FALLBACK_USD_RATES,
    STORAGE_KEY_FX_CACHE,
    getRelativeDateString,
    formatDateTime,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;

  function getWallet(walletId) {
    if (!walletId || walletId === 'all') return null;
    return state.wallets.find(w => w.id === walletId) || state.wallets[0];
  }

  function getWalletName(walletId) {
    const w = getWallet(walletId);
    return w ? `${w.icon} ${w.name}` : 'Main Wallet';
  }

  function getWalletTypeLabel(type) {
    const map = {
      ewallet: 'E-Wallet / Super App',
      spending: 'Personal Spending',
      savings: 'Savings / Reserve',
      crypto: 'Cryptocurrency / Digital Asset',
      investment: 'Stocks & Equities',
      time_deposit: 'Time Deposit (TD)',
      bond: 'Bonds / T-Bills (RTB)',
      real_estate: 'Real Estate Equity',
      current: 'Current / Checking',
      cash: 'Cash on Hand',
      credit: 'Credit Card',
      other: 'Capital Asset'
    };
    return map[type] || 'Asset Account';
  }

  function getWalletIcon(type) {
    const map = {
      ewallet: '📱', spending: '👛', savings: '🏦', crypto: '🪙',
      investment: '📈', time_deposit: '⏳', bond: '📜', real_estate: '🏡',
      current: '🏛️', cash: '💵', credit: '💳', other: '📋'
    };
    return map[type] || '👛';
  }

  function getWalletCurrentBalance(walletId) {
    const wallet = getWallet(walletId);
    if (!wallet) return 0;
    const baseCurr = state.settings?.baseCurrency || 'PHP';
    const wCurr = wallet.currency || baseCurr;

    let balance = parseFloat(wallet.initialBalance) || 0;
    const sorted = state.transactions
      .filter(t => t.walletId === walletId)
      .sort((a, b) => {
        if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
        return a.date.localeCompare(b.date);
      });

    sorted.forEach(tx => {
      let crNative = 0;
      let dbNative = 0;

      if (tx.inputCurrency === wCurr && tx.inputAmount !== undefined) {
        if (tx.type === 'credit' || tx.type === 'transfer_in') crNative = parseFloat(tx.inputAmount) || 0;
        if (tx.type === 'debit' || tx.type === 'transfer_out') dbNative = parseFloat(tx.inputAmount) || 0;
      } else {
        const crBase = parseFloat(tx.credit) || 0;
        const dbBase = parseFloat(tx.debit) || 0;
        crNative = wCurr === baseCurr ? crBase : convertCurrency(crBase, baseCurr, wCurr);
        dbNative = wCurr === baseCurr ? dbBase : convertCurrency(dbBase, baseCurr, wCurr);
      }

      balance = balance + crNative - dbNative;
    });

    return balance;
  }

  function getFxRate(fromCurrency, toCurrency) {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return 1.0;
    const todayStr = getRelativeDateString(0);
    const cacheKey = `fx_${fromCurrency}_${toCurrency}_${todayStr}`;
    try {
      const cacheStore = JSON.parse(localStorage.getItem(STORAGE_KEY_FX_CACHE) || '{}');
      if (cacheStore[cacheKey]?.rate) return cacheStore[cacheKey].rate;
    } catch (e) {}
    const fromUsd = FALLBACK_USD_RATES[fromCurrency] || 1.0;
    const toUsd = FALLBACK_USD_RATES[toCurrency] || 1.0;
    return toUsd / fromUsd;
  }

  function convertCurrency(amount, fromCurrency, toCurrency) {
    const num = parseFloat(amount) || 0;
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return num;
    const rate = getFxRate(fromCurrency, toCurrency);
    return num * rate;
  }

  async function fetchExchangeRate(fromCurrency, toCurrency, dateStr) {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return 1.0;

    const todayStr = getRelativeDateString(0);
    const queryDate = (!dateStr || dateStr > todayStr) ? todayStr : dateStr;
    const cacheKey = `fx_${fromCurrency}_${toCurrency}_${queryDate}`;\n\n    try {\n      const cacheStore = JSON.parse(localStorage.getItem(STORAGE_KEY_FX_CACHE) || '{}');\n      if (cacheStore[cacheKey] && (Date.now() - cacheStore[cacheKey].timestamp < 86400000)) {\n        return cacheStore[cacheKey].rate;\n      }\n    } catch (e) {}\n\n    let rate = null;\n\n    try {\n      const isHistorical = queryDate < todayStr;\n      const endpoint = isHistorical\n        ? `https://api.frankfurter.app/${queryDate}?from=${fromCurrency}&to=${toCurrency}`\n        : `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`;\n\n      const res = await fetch(endpoint, { cache: 'force-cache' });\n      if (res.ok) {\n        const data = await res.json();\n        if (data.rates && data.rates[toCurrency]) {\n          rate = parseFloat(data.rates[toCurrency]);\n        }\n      }\n    } catch (err) {}\n\n    if (!rate) {\n      try {\n        const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);\n        if (res.ok) {\n          const data = await res.json();\n          if (data.rates && data.rates[toCurrency]) {\n            rate = parseFloat(data.rates[toCurrency]);\n          }\n        }\n      } catch (err) {}\n    }\n\n    if (!rate) {\n      const fromUsdRate = FALLBACK_USD_RATES[fromCurrency] || 1.0;\n      const toUsdRate = FALLBACK_USD_RATES[toCurrency] || 1.0;\n      rate = toUsdRate / fromUsdRate;\n    }\n\n    try {\n      const cacheStore = JSON.parse(localStorage.getItem(STORAGE_KEY_FX_CACHE) || '{}');\n      cacheStore[cacheKey] = { rate: rate, timestamp: Date.now() };\n      localStorage.setItem(STORAGE_KEY_FX_CACHE, JSON.stringify(cacheStore));\n    } catch (e) {}\n\n    return rate;\n  }\n\n  function getWalletBaseConvertedBalance(walletId) {\n    const wallet = getWallet(walletId);\n    if (!wallet) return 0;\n    const bal = getWalletCurrentBalance(walletId);\n    const walletCurr = wallet.currency || state.settings.baseCurrency || 'PHP';\n    const baseCurr = state.settings.baseCurrency || 'PHP';\n    if (walletCurr === baseCurr) return bal;\n    return convertCurrency(bal, walletCurr, baseCurr);\n  }\n\n  function getTotalCombinedBalance() {\n    let total = 0;\n    state.wallets.forEach(w => {\n      total += getWalletBaseConvertedBalance(w.id);\n    });\n    return total;\n  }\n\n  function recalculateLedgerBalances() {\n    const baseCurr = state.settings?.baseCurrency || 'PHP';\n\n    state.wallets.forEach(wallet => {\n      const wCurr = wallet.currency || baseCurr;\n      const walletTx = state.transactions\n        .filter(t => t.walletId === wallet.id)\n        .sort((a, b) => {\n          if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);\n          return a.date.localeCompare(b.date);\n        });\n\n      let running = parseFloat(wallet.initialBalance) || 0;\n      walletTx.forEach(tx => {\n        let crNative = 0;\n        let dbNative = 0;\n\n        if (tx.inputCurrency === wCurr && tx.inputAmount !== undefined) {\n          if (tx.type === 'credit' || tx.type === 'transfer_in') crNative = parseFloat(tx.inputAmount) || 0;\n          if (tx.type === 'debit' || tx.type === 'transfer_out') dbNative = parseFloat(tx.inputAmount) || 0;\n        } else {\n          const crBase = parseFloat(tx.credit) || 0;\n          const dbBase = parseFloat(tx.debit) || 0;\n          crNative = wCurr === baseCurr ? crBase : convertCurrency(crBase, baseCurr, wCurr);\n          dbNative = wCurr === baseCurr ? dbBase : convertCurrency(dbBase, baseCurr, wCurr);\n        }\n\n        running = running + crNative - dbNative;\n        tx.walletRunningBalance = running;\n      });\n    });\n\n    const allSorted = [...state.transactions].sort((a, b) => {\n      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);\n      return a.date.localeCompare(b.date);\n    });\n\n    const totalInitial = state.wallets.reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);\n    let globalRunning = totalInitial;\n\n    allSorted.forEach(tx => {\n      const cr = parseFloat(tx.credit) || 0;\n      const db = parseFloat(tx.debit) || 0;\n      globalRunning = globalRunning + cr - db;\n      tx.runningBalance = globalRunning;\n    });\n\n    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();\n  }\n\n  function calculateSpendingBuffer(walletFilter = 'all') {\n    let txList = state.transactions || [];\n    let initialBal = 0;\n\n    if (walletFilter !== 'all') {\n      txList = txList.filter(t => t.walletId === walletFilter);\n      const w = getWallet(walletFilter);\n      initialBal = w ? (parseFloat(w.initialBalance) || 0) : 0;\n    } else {\n      initialBal = (state.wallets || []).reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);\n    }\n\n    const totalCredits = txList.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0);\n    const totalDebits = txList.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0);\n    const currentNetBalance = initialBal + totalCredits - totalDebits;\n\n    if (txList.length === 0 && initialBal <= 0) {\n      return { days: 0, hasSpends: false, hasFunds: false };\n    }\n    if (currentNetBalance <= 0 && txList.length === 0) {\n      return { days: 0, hasSpends: false, hasFunds: false };\n    }\n\n    const sorted = [...txList].sort((a, b) => {\n      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);\n      return a.date.localeCompare(b.date);\n    });\n\n    const now = new Date();\n    let defaultInitDate;\n    if (sorted.length > 0 && sorted[0].date) {\n      const firstTxDate = new Date(sorted[0].date + 'T00:00:00');\n      defaultInitDate = new Date(firstTxDate.getTime() - 30 * 24 * 60 * 60 * 1000);\n    } else {\n      defaultInitDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);\n    }\n\n    const inflowQueue = [];\n\n    if (initialBal > 0) {\n      inflowQueue.push({ date: defaultInitDate, remaining: initialBal });\n    }\n\n    let lastDebitDate = null;\n    let lastInflowBatchDate = null;\n\n    sorted.forEach((tx) => {\n      if (tx.isArchived) return;\n      if (walletFilter === 'all' && (tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in')) {\n        return;\n      }\n\n      const credit = parseFloat(tx.credit) || 0;\n      const debit = parseFloat(tx.debit) || 0;\n      const txDateObj = new Date(tx.date + 'T00:00:00');\n\n      if (credit > 0) {\n        inflowQueue.push({ date: txDateObj, remaining: credit });\n      }\n\n      if (debit > 0) {\n        let needed = debit;\n        lastDebitDate = txDateObj;\n\n        while (needed > 0 && inflowQueue.length > 0) {\n          const currentBatch = inflowQueue[0];\n          lastInflowBatchDate = currentBatch.date;\n\n          if (currentBatch.remaining <= needed) {\n            needed -= currentBatch.remaining;\n            inflowQueue.shift();\n          } else {\n            currentBatch.remaining -= needed;\n            needed = 0;\n          }\n        }\n      }\n    });\n\n    if (!lastDebitDate) {\n      return { days: 0, hasSpends: false, hasFunds: currentNetBalance > 0 };\n    }\n\n    if (!lastInflowBatchDate) {\n      return { days: 0, hasSpends: true, hasFunds: currentNetBalance > 0 };\n    }\n\n    const diffTime = lastDebitDate.getTime() - lastInflowBatchDate.getTime();\n    const bufferDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));\n\n    return { days: bufferDays, hasSpends: true, hasFunds: currentNetBalance > 0 };\n  }\n\n  async function transferFunds(fromWalletId, toWalletId, amount, currency, date, notes) {\n    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) {\n      throw new Error('Please select different source and destination wallets.');\n    }\n\n    const fromWallet = getWallet(fromWalletId);\n    const toWallet = getWallet(toWalletId);\n    if (!fromWallet || !toWallet) {\n      throw new Error('Invalid source or destination wallet.');\n    }\n\n    const numAmount = parseFloat(amount);\n    if (isNaN(numAmount) || numAmount <= 0) {\n      throw new Error('Please enter a valid positive transfer amount.');\n    }\n\n    const baseCurrency = state.settings.baseCurrency || 'PHP';\n    const fromCurr = currency || fromWallet.currency || baseCurrency;\n    const toCurr = toWallet.currency || baseCurrency;\n    const txDate = date || (window.BB_DATA?.getRelativeDateString ? window.BB_DATA.getRelativeDateString(0) : new Date().toISOString().split('T')[0]);\n\n    const rateSourceToBase = fromCurr === baseCurrency\n      ? 1.0\n      : await fetchExchangeRate(fromCurr, baseCurrency, txDate);\n    const baseAmount = Math.round((numAmount * rateSourceToBase) * 100) / 100;\n\n    const rateDestToBase = toCurr === baseCurrency\n      ? 1.0\n      : await fetchExchangeRate(toCurr, baseCurrency, txDate);\n    const destAmount = Math.round((baseAmount / rateDestToBase) * 100) / 100;\n\n    const outTxId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);\n    const inTxId = 'tx_' + (Date.now() + 1) + '_' + Math.random().toString(36).substring(2, 6);\n\n    const outTx = {\n      id: outTxId,\n      walletId: fromWalletId,\n      date: txDate,\n      item: `⇄ Transfer to ${toWallet.name}`,\n      type: 'transfer_out',\n      isTransfer: true,\n      transferPeerId: toWalletId,\n      transferPeerTxId: inTxId,\n      inputCurrency: fromCurr,\n      inputAmount: numAmount,\n      exchangeRate: rateSourceToBase,\n      credit: 0,\n      debit: baseAmount,\n      notes: notes || '',\n      createdAt: Date.now()\n    };\n\n    const inTx = {\n      id: inTxId,\n      walletId: toWalletId,\n      date: txDate,\n      item: `⇄ Transfer from ${fromWallet.name}`,\n      type: 'transfer_in',\n      isTransfer: true,\n      transferPeerId: fromWalletId,\n      transferPeerTxId: outTxId,\n      inputCurrency: toCurr,\n      inputAmount: destAmount,\n      exchangeRate: (rateSourceToBase / rateDestToBase) || 1.0,\n      credit: baseAmount,\n      debit: 0,\n      notes: notes || '',\n      createdAt: Date.now() + 1\n    };\n\n    state.transactions.push(outTx, inTx);\n    recalculateLedgerBalances();\n    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();\n\n    return { outTx, inTx, baseAmount, destAmount };\n  }\n\n  window.BB_WALLETS = {\n    getWallet,\n    getWalletName,\n    getWalletTypeLabel,\n    getWalletIcon,\n    getWalletCurrentBalance,\n    getWalletBaseConvertedBalance,\n    getTotalCombinedBalance,\n    getFxRate,\n    convertCurrency,\n    fetchExchangeRate,\n    recalculateLedgerBalances,\n    calculateSpendingBuffer,\n    transferFunds\n  };\n})(window);\n