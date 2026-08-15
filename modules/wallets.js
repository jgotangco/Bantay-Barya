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

    let balance = parseFloat(wallet.initialBalance) || 0;
    const sorted = state.transactions
      .filter(t => t.walletId === walletId)
      .sort((a, b) => {
        if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
        return a.date.localeCompare(b.date);
      });

    sorted.forEach(tx => {
      const cr = parseFloat(tx.credit) || 0;
      const db = parseFloat(tx.debit) || 0;
      balance = balance + cr - db;
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
    const cacheKey = `fx_${fromCurrency}_${toCurrency}_${queryDate}`;

    try {
      const cacheStore = JSON.parse(localStorage.getItem(STORAGE_KEY_FX_CACHE) || '{}');
      if (cacheStore[cacheKey] && (Date.now() - cacheStore[cacheKey].timestamp < 86400000)) {
        return cacheStore[cacheKey].rate;
      }
    } catch (e) {}

    let rate = null;

    try {
      const isHistorical = queryDate < todayStr;
      const endpoint = isHistorical
        ? `https://api.frankfurter.app/${queryDate}?from=${fromCurrency}&to=${toCurrency}`
        : `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`;

      const res = await fetch(endpoint, { cache: 'force-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.rates && data.rates[toCurrency]) {
          rate = parseFloat(data.rates[toCurrency]);
        }
      }
    } catch (err) {}

    if (!rate) {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
        if (res.ok) {
          const data = await res.json();
          if (data.rates && data.rates[toCurrency]) {
            rate = parseFloat(data.rates[toCurrency]);
          }
        }
      } catch (err) {}
    }

    if (!rate) {
      const fromUsdRate = FALLBACK_USD_RATES[fromCurrency] || 1.0;
      const toUsdRate = FALLBACK_USD_RATES[toCurrency] || 1.0;
      rate = toUsdRate / fromUsdRate;
    }

    try {
      const cacheStore = JSON.parse(localStorage.getItem(STORAGE_KEY_FX_CACHE) || '{}');
      cacheStore[cacheKey] = { rate: rate, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY_FX_CACHE, JSON.stringify(cacheStore));
    } catch (e) {}

    return rate;
  }

  function getWalletBaseConvertedBalance(walletId) {
    const wallet = getWallet(walletId);
    if (!wallet) return 0;
    const bal = getWalletCurrentBalance(walletId);
    const walletCurr = wallet.currency || state.settings.baseCurrency || 'PHP';
    const baseCurr = state.settings.baseCurrency || 'PHP';
    if (walletCurr === baseCurr) return bal;
    return convertCurrency(bal, walletCurr, baseCurr);
  }

  function getTotalCombinedBalance() {
    let total = 0;
    state.wallets.forEach(w => {
      total += getWalletBaseConvertedBalance(w.id);
    });
    return total;
  }

  function renderWalletsBar() {
    const container = document.getElementById('walletsChipsContainer');
    if (!container) return;

    const totalCombined = getTotalCombinedBalance();
    const isAllActive = state.selectedWalletId === 'all';
    const baseCurr = state.settings.baseCurrency || 'PHP';

    let html = `
      <button type="button" class="wallet-chip ${isAllActive ? 'active' : ''}" data-wallet-id="all" title="View all wallets combined">
        <span class="wallet-chip-icon">🌐</span>
        <div class="wallet-chip-info">
          <span class="wallet-chip-name">All Wallets (Combined)</span>
          <span class="wallet-chip-bal font-mono" style="color: ${totalCombined >= 0 ? 'var(--text-primary)' : 'var(--debit-color)'}">
            ${formatCurrency(totalCombined)}
          </span>
        </div>
      </button>
    `;

    state.wallets.forEach(w => {
      const bal = getWalletCurrentBalance(w.id);
      const wCurr = w.currency || baseCurr;
      const isActive = state.selectedWalletId === w.id;
      const isForeign = wCurr !== baseCurr;
      const convertedBal = isForeign ? getWalletBaseConvertedBalance(w.id) : null;

      html += `
        <button type="button" class="wallet-chip ${isActive ? 'active' : ''}" data-wallet-id="${w.id}" title="${escapeHtml(w.name)} (${wCurr})">
          <span class="wallet-chip-icon">${w.icon || getWalletIcon(w.type)}</span>
          <div class="wallet-chip-info">
            <span class="wallet-chip-name">${escapeHtml(w.name)}</span>
            <span class="wallet-chip-bal font-mono" style="color: ${bal >= 0 ? 'var(--text-primary)' : 'var(--debit-color)'}">
              ${formatForeignCurrency(bal, wCurr)}
            </span>
            ${isForeign ? `<span style="font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono)">≈ ${formatCurrency(convertedBal)}</span>` : ''}
          </div>
        </button>
      `;
    });

    container.innerHTML = html;

    const chips = container.querySelectorAll('.wallet-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const wid = chip.getAttribute('data-wallet-id');
        selectWallet(wid);
      });
    });
  }

  function selectWallet(walletId) {
    state.selectedWalletId = walletId;
    const filterSelect = document.getElementById('walletFilterSelect');
    const txSelect = document.getElementById('txWalletSelect');

    if (filterSelect) filterSelect.value = walletId;
    if (txSelect && walletId !== 'all') txSelect.value = walletId;

    renderWalletsBar();
    if (window.BB_CORE) {
      window.BB_CORE.updateKPIs();
      window.BB_CORE.renderLedgerTable();
      window.BB_CORE.updateProjectedBalance();
    }
    updateSpendingBufferDisplay();
    if (window.BB_THEME) window.BB_THEME.renderAllHeroCharts();

    const selectedName = walletId === 'all'
      ? 'All Wallets (Combined)'
      : (getWallet(walletId)?.name || 'Wallet');
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Viewing ${selectedName}`, 'info');
  }

  function populateWalletDropdowns() {
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const walletOptions = state.wallets.map(w => {
      const wCurr = w.currency || baseCurr;
      const currTag = wCurr !== baseCurr ? ` (${wCurr})` : '';
      return `<option value="${w.id}">${w.icon || getWalletIcon(w.type)} ${escapeHtml(w.name)}${currTag}</option>`;
    }).join('');

    const txWalletSelect = document.getElementById('txWalletSelect');
    if (txWalletSelect) {
      txWalletSelect.innerHTML = walletOptions;
      if (state.selectedWalletId !== 'all') txWalletSelect.value = state.selectedWalletId;
      else if (state.wallets[0]) txWalletSelect.value = state.wallets[0].id;
    }

    const editTxWalletSelect = document.getElementById('editTxWalletSelect');
    if (editTxWalletSelect) editTxWalletSelect.innerHTML = walletOptions;

    const walletFilterSelect = document.getElementById('walletFilterSelect');
    if (walletFilterSelect) {
      walletFilterSelect.innerHTML = `<option value="all">All Wallets (Combined)</option>${walletOptions}`;
      walletFilterSelect.value = state.selectedWalletId;
    }

    const reconcileWalletSelect = document.getElementById('reconcileWalletSelect');
    if (reconcileWalletSelect) {
      reconcileWalletSelect.innerHTML = walletOptions;
      if (state.selectedWalletId !== 'all') reconcileWalletSelect.value = state.selectedWalletId;
      else if (state.wallets[0]) reconcileWalletSelect.value = state.wallets[0].id;
    }

    const reportWalletSelect = document.getElementById('reportWalletSelect');
    if (reportWalletSelect) {
      reportWalletSelect.innerHTML = `<option value="all">All Wallets (Combined)</option>${walletOptions}`;
      reportWalletSelect.value = state.reportWalletFilter || 'all';
    }

    const billWalletSelect = document.getElementById('billWalletSelect');
    if (billWalletSelect) {
      billWalletSelect.innerHTML = walletOptions;
      if (state.wallets[0]) billWalletSelect.value = state.wallets[0].id;
    }

    const payBillWalletSelect = document.getElementById('payBillWalletSelect');
    if (payBillWalletSelect) payBillWalletSelect.innerHTML = walletOptions;
  }

  function renderManageWalletsTable() {
    const tableBody = document.getElementById('walletsTableBody');
    if (!tableBody) return;

    const baseCurr = state.settings.baseCurrency || 'PHP';
    let html = '';
    state.wallets.forEach(w => {
      const currentBal = getWalletCurrentBalance(w.id);
      const convertedBal = getWalletBaseConvertedBalance(w.id);
      const wCurr = w.currency || baseCurr;
      const txCount = state.transactions.filter(t => t.walletId === w.id).length;
      const typeLabel = getWalletTypeLabel(w.type);

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">${w.icon || getWalletIcon(w.type)}</span>
              <div>
                <strong>${escapeHtml(w.name)}</strong>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${wCurr} Account</div>
              </div>
            </div>
          </td>
          <td>
            <span class="asset-type-badge ${w.type}">${typeLabel}</span>
          </td>
          <td class="text-right font-mono">${formatForeignCurrency(w.initialBalance || 0, wCurr)}</td>
          <td class="text-right font-mono" style="font-weight: 700; color: ${currentBal >= 0 ? 'var(--text-primary)' : 'var(--debit-color)'}">
            ${formatForeignCurrency(currentBal, wCurr)}
          </td>
          <td class="text-right font-mono credit-text" style="font-weight: 700;">
            ${formatCurrency(convertedBal)}
          </td>
          <td class="text-center font-mono">${txCount}</td>
          <td class="text-right">
            <div class="row-actions" style="justify-content: flex-end;">
              <button class="btn-icon" title="Edit wallet" onclick="window.app.openEditWalletModal('${w.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" title="Delete wallet" onclick="window.app.promptDeleteWallet('${w.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  function createWallet(name, type, icon, initialBalance, currency) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    const baseCurr = state.settings.baseCurrency || 'PHP';
    const newWallet = {
      id: 'wallet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      type: type || 'spending',
      currency: currency || baseCurr,
      icon: icon || getWalletIcon(type),
      initialBalance: parseFloat(initialBalance) || 0.00,
      createdAt: Date.now()
    };

    state.wallets.push(newWallet);
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    populateWalletDropdowns();
    renderWalletsBar();
    renderManageWalletsTable();
    recalculateLedgerBalances();
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Created wallet "${cleanName}" (${newWallet.icon}, ${newWallet.currency})!`, 'success');
  }

  function openEditWalletModal(walletId) {
    const w = getWallet(walletId);
    if (!w) return;

    document.getElementById('editWalletId').value = w.id;
    document.getElementById('editWalletName').value = w.name;
    document.getElementById('editWalletType').value = w.type;
    const currEl = document.getElementById('editWalletCurrency');
    if (currEl) currEl.value = w.currency || state.settings.baseCurrency || 'PHP';
    document.getElementById('editWalletIcon').value = w.icon || getWalletIcon(w.type);
    document.getElementById('editWalletModalIcon').textContent = w.icon || getWalletIcon(w.type);
    document.getElementById('editWalletInitialBalance').value = (parseFloat(w.initialBalance) || 0).toFixed(2);

    document.getElementById('editWalletModal')?.classList.add('active');
  }

  function promptDeleteWallet(walletId) {
    if (state.wallets.length <= 1) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('You must have at least one wallet in Bantay Barya.', 'error');
      return;
    }

    const sourceWallet = getWallet(walletId);
    if (!sourceWallet) return;

    const txList = state.transactions.filter(t => t.walletId === walletId);
    const balance = getWalletCurrentBalance(walletId);
    const wCurr = sourceWallet.currency || state.settings.baseCurrency || 'PHP';

    document.getElementById('deleteSourceWalletId').value = sourceWallet.id;
    document.getElementById('deleteSourceWalletName').textContent = `${sourceWallet.icon} ${sourceWallet.name} (${wCurr})`;
    document.getElementById('deleteSourceTxCount').textContent = txList.length;
    document.getElementById('deleteSourceBalance').textContent = formatForeignCurrency(balance, wCurr);

    const remainingWallets = state.wallets.filter(w => w.id !== walletId);
    document.getElementById('deleteTargetWalletSelect').innerHTML = remainingWallets.map(w =>
      `<option value="${w.id}">${w.icon} ${escapeHtml(w.name)} (${formatForeignCurrency(getWalletCurrentBalance(w.id), w.currency || 'PHP')})</option>`
    ).join('');

    document.getElementById('deleteWalletModal')?.classList.add('active');
  }

  function reassignAndDeleteWallet(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sourceWallet = getWallet(sourceId);
    const targetWallet = getWallet(targetId);
    if (!sourceWallet || !targetWallet) return;

    let movedCount = 0;
    state.transactions.forEach(tx => {
      if (tx.walletId === sourceId) {
        tx.walletId = targetId;
        movedCount++;
      }
    });

    const sourceInitial = parseFloat(sourceWallet.initialBalance) || 0;
    targetWallet.initialBalance = (parseFloat(targetWallet.initialBalance) || 0) + sourceInitial;

    state.wallets = state.wallets.filter(w => w.id !== sourceId);

    if (state.selectedWalletId === sourceId) {
      state.selectedWalletId = targetId;
    }

    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    populateWalletDropdowns();
    renderWalletsBar();
    renderManageWalletsTable();
    recalculateLedgerBalances();

    document.getElementById('deleteWalletModal')?.classList.remove('active');
    if (window.BB_CORE?.showToast) {
      window.BB_CORE.showToast(`Transferred ${movedCount} transactions & balance to "${targetWallet.name}". Deleted "${sourceWallet.name}".`, 'success');
    }
  }

  function setupWalletListeners() {
    const openWallets = () => {
      renderManageWalletsTable();
      document.getElementById('walletsModal')?.classList.add('active');
      document.getElementById('newWalletName')?.focus();
    };

    document.getElementById('openWalletsModalBtn')?.addEventListener('click', openWallets);
    document.getElementById('manageWalletsBarBtn')?.addEventListener('click', openWallets);
    document.getElementById('quickAddWalletBtn')?.addEventListener('click', openWallets);
    document.getElementById('quickAddWalletFromFormBtn')?.addEventListener('click', openWallets);

    const closeWallets = () => document.getElementById('walletsModal')?.classList.remove('active');
    document.getElementById('closeWalletsModalBtn')?.addEventListener('click', closeWallets);
    document.getElementById('closeWalletsModalFooterBtn')?.addEventListener('click', closeWallets);
    document.getElementById('walletsModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('walletsModal')) closeWallets();
    });

    const newWalletForm = document.getElementById('newWalletForm');
    if (newWalletForm) {
      newWalletForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createWallet(
          document.getElementById('newWalletName').value,
          document.getElementById('newWalletType').value,
          document.getElementById('newWalletIcon').value,
          document.getElementById('newWalletInitialBalance').value,
          document.getElementById('newWalletCurrency')?.value || 'PHP'
        );
        document.getElementById('newWalletName').value = '';
        document.getElementById('newWalletInitialBalance').value = '0.00';
      });
    }

    const closeEditWallet = () => document.getElementById('editWalletModal')?.classList.remove('active');
    document.getElementById('closeEditWalletModalBtn')?.addEventListener('click', closeEditWallet);
    document.getElementById('cancelEditWalletBtn')?.addEventListener('click', closeEditWallet);
    document.getElementById('editWalletModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('editWalletModal')) closeEditWallet();
    });

    const editWalletForm = document.getElementById('editWalletForm');
    if (editWalletForm) {
      editWalletForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editWalletId').value;
        const w = getWallet(id);
        if (w) {
          w.name = document.getElementById('editWalletName').value.trim();
          w.type = document.getElementById('editWalletType').value;
          const currEl = document.getElementById('editWalletCurrency');
          if (currEl) w.currency = currEl.value;
          w.icon = document.getElementById('editWalletIcon').value;
          w.initialBalance = parseFloat(document.getElementById('editWalletInitialBalance').value) || 0;

          if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
          populateWalletDropdowns();
          renderWalletsBar();
          renderManageWalletsTable();
          recalculateLedgerBalances();
          closeEditWallet();
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Wallet "${w.name}" updated!`, 'success');
        }
      });
    }

    const closeDeleteWallet = () => document.getElementById('deleteWalletModal')?.classList.remove('active');
    document.getElementById('closeDeleteWalletModalBtn')?.addEventListener('click', closeDeleteWallet);
    document.getElementById('cancelDeleteWalletBtn')?.addEventListener('click', closeDeleteWallet);
    document.getElementById('deleteWalletModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('deleteWalletModal')) closeDeleteWallet();
    });

    const deleteWalletForm = document.getElementById('deleteWalletForm');
    if (deleteWalletForm) {
      deleteWalletForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sourceId = document.getElementById('deleteSourceWalletId').value;
        const targetId = document.getElementById('deleteTargetWalletSelect').value;
        reassignAndDeleteWallet(sourceId, targetId);
      });
    }
  }

  function calculateSpendingBuffer(walletFilter = 'all') {
    let txList = state.transactions || [];
    let initialBal = 0;
    let walletCreationDate = null;

    if (walletFilter !== 'all') {
      txList = txList.filter(t => t.walletId === walletFilter);
      const w = getWallet(walletFilter);
      initialBal = w ? (parseFloat(w.initialBalance) || 0) : 0;
      if (w && w.createdAt) walletCreationDate = new Date(w.createdAt);
    } else {
      initialBal = (state.wallets || []).reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);
      const earliestCreated = (state.wallets || []).reduce((min, w) => {
        if (!w.createdAt) return min;
        return (!min || w.createdAt < min) ? w.createdAt : min;
      }, null);
      if (earliestCreated) walletCreationDate = new Date(earliestCreated);
    }

    const totalCredits = txList.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0);
    const totalDebits = txList.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0);
    const currentNetBalance = initialBal + totalCredits - totalDebits;

    if (txList.length === 0 && initialBal <= 0) {
      return { days: 0, hasSpends: false, hasFunds: false };
    }
    if (currentNetBalance <= 0 && txList.length === 0) {
      return { days: 0, hasSpends: false, hasFunds: false };
    }

    const sorted = [...txList].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return a.date.localeCompare(b.date);
    });

    const now = new Date();
    const defaultInitDate = walletCreationDate && !isNaN(walletCreationDate.getTime())
      ? walletCreationDate
      : (sorted.length > 0 ? new Date(sorted[0].date + 'T00:00:00') : now);

    const inflowQueue = [];

    if (initialBal > 0) {
      inflowQueue.push({ date: defaultInitDate, remaining: initialBal });
    }

    let lastDebitDate = null;
    let lastInflowBatchDate = null;

    sorted.forEach((tx) => {
      const credit = parseFloat(tx.credit) || 0;
      const debit = parseFloat(tx.debit) || 0;
      const txDateObj = new Date(tx.date + 'T00:00:00');

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
    });

    if (!lastDebitDate) {
      if (inflowQueue.length === 0 || currentNetBalance <= 0) {
        return { days: 0, hasSpends: false, hasFunds: false };
      }
      const refDate = inflowQueue[0].date;
      const diffDays = Math.max(0, Math.floor((now - refDate) / (1000 * 60 * 60 * 24)));
      return { days: diffDays, hasSpends: false, hasFunds: true };
    }

    if (!lastInflowBatchDate) {
      return { days: 0, hasSpends: true, hasFunds: currentNetBalance > 0 };
    }

    const diffTime = lastDebitDate.getTime() - lastInflowBatchDate.getTime();
    const bufferDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    return { days: bufferDays, hasSpends: true, hasFunds: currentNetBalance > 0 };
  }

  function updateSpendingBufferDisplay() {
    const { days, hasSpends, hasFunds } = calculateSpendingBuffer('all');
    const aomDisplay = document.getElementById('aomDisplay');
    const aomBadge = document.getElementById('aomBadge');
    const aomSubtitle = document.getElementById('aomSubtitle');

    if (aomDisplay) aomDisplay.textContent = `${days} ${days === 1 ? 'Day' : 'Days'}`;

    if (!hasFunds && days === 0) {
      if (aomDisplay) aomDisplay.className = 'kpi-value font-mono aom-red';
      if (aomBadge) {
        aomBadge.textContent = '0d Buffer';
        aomBadge.className = 'kpi-badge badge-neutral';
      }
      if (aomSubtitle) aomSubtitle.textContent = 'Add deposits to build buffer';
    } else if (days >= 30) {
      if (aomDisplay) aomDisplay.className = 'kpi-value font-mono aom-green';
      if (aomBadge) {
        aomBadge.textContent = 'Healthy (≥30d)';
        aomBadge.className = 'kpi-badge badge-positive';
      }
      if (aomSubtitle) aomSubtitle.textContent = hasSpends ? 'All wallets grand total healthy' : 'All accounts buffer healthy';
    } else {
      if (aomDisplay) aomDisplay.className = 'kpi-value font-mono aom-red';
      if (aomBadge) {
        aomBadge.textContent = 'Buffer Alert (<30d)';
        aomBadge.className = 'kpi-badge badge-negative';
      }
      if (aomSubtitle) aomSubtitle.textContent = hasSpends ? 'Grand total uses recent money' : 'Building 30d global buffer';
    }
  }

  function recalculateLedgerBalances() {
    state.wallets.forEach(wallet => {
      const walletTx = state.transactions
        .filter(t => t.walletId === wallet.id)
        .sort((a, b) => {
          if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
          return a.date.localeCompare(b.date);
        });

      let running = parseFloat(wallet.initialBalance) || 0;
      walletTx.forEach(tx => {
        const cr = parseFloat(tx.credit) || 0;
        const db = parseFloat(tx.debit) || 0;
        running = running + cr - db;
        tx.walletRunningBalance = running;
      });
    });

    const allSorted = [...state.transactions].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return a.date.localeCompare(b.date);
    });

    const totalInitial = state.wallets.reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);
    let globalRunning = totalInitial;

    allSorted.forEach(tx => {
      const cr = parseFloat(tx.credit) || 0;
      const db = parseFloat(tx.debit) || 0;
      globalRunning = globalRunning + cr - db;
      tx.runningBalance = globalRunning;
    });

    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderWalletsBar();
    if (window.BB_CORE) {
      window.BB_CORE.updateKPIs();
      window.BB_CORE.renderLedgerTable();
      window.BB_CORE.updateProjectedBalance();
    }
    updateSpendingBufferDisplay();
    if (window.BB_THEME) window.BB_THEME.renderAllHeroCharts();
    updateActiveSlotBadge();
  }

  function generateSlotSummary(walletsList, txList, baseCurr) {
    let totalBal = 0;
    walletsList.forEach(w => {
      let b = parseFloat(w.initialBalance) || 0;
      txList.filter(t => t.walletId === w.id).forEach(tx => {
        b += (parseFloat(tx.credit) || 0) - (parseFloat(tx.debit) || 0);
      });
      totalBal += b;
    });

    return {
      totalBalance: totalBal,
      walletCount: walletsList.length,
      txCount: txList.length,
      baseCurrency: baseCurr || state.settings.baseCurrency || 'PHP',
      lastSaved: Date.now()
    };
  }

  function initSaveVaultEngine() {
    if (!state.saveSlots || state.saveSlots.length === 0) {
      const primarySlot = {
        id: 'slot_primary',
        name: 'Primary Ledger',
        description: 'Main personal spending & savings ledger',
        icon: '🌟',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        summary: generateSlotSummary(state.wallets, state.transactions, state.settings.baseCurrency),
        payload: {
          wallets: JSON.parse(JSON.stringify(state.wallets)),
          debts: JSON.parse(JSON.stringify(state.debts || [])),
          bills: JSON.parse(JSON.stringify(state.bills || [])),
          transactions: JSON.parse(JSON.stringify(state.transactions)),
          categories: JSON.parse(JSON.stringify(state.categories)),
          settings: JSON.parse(JSON.stringify(state.settings)),
          theme: state.theme
        }
      };
      state.saveSlots = [primarySlot];
      state.activeSlotId = 'slot_primary';
    }

    updateActiveSlotBadge();
  }

  function updateActiveSlotBadge() {
    const active = state.saveSlots.find(s => s.id === state.activeSlotId) || state.saveSlots[0];
    const headerBadge = document.getElementById('activeSaveSlotBadge');
    const settingsBadge = document.getElementById('settingsActiveSaveSlotBadge');

    if (headerBadge && active) {
      headerBadge.textContent = `${active.icon} ${active.name}`;
      headerBadge.title = `Active Save Slot: ${active.name} (Updated: ${formatDateTime(active.updatedAt)})`;
    }
    if (settingsBadge && active) {
      settingsBadge.textContent = `${active.icon} ${active.name}`;
      settingsBadge.title = `Active Save Slot: ${active.name} (Updated: ${formatDateTime(active.updatedAt)})`;
    }
  }

  function renderSaveSlotsGrid() {
    const container = document.getElementById('saveSlotsContainer');
    const countBadge = document.getElementById('saveSlotsCountBadge');
    if (!container) return;

    if (countBadge) countBadge.textContent = `${state.saveSlots.length} ${state.saveSlots.length === 1 ? 'Slot' : 'Slots'}`;

    let html = '';
    state.saveSlots.forEach(slot => {
      const isActive = slot.id === state.activeSlotId;
      const sum = slot.summary || generateSlotSummary(slot.payload?.wallets || [], slot.payload?.transactions || [], slot.payload?.settings?.baseCurrency);
      const symbol = CURRENCIES[sum.baseCurrency]?.symbol || '₱';
      const balStr = (sum.totalBalance < 0 ? '-' : '') + symbol + Math.abs(sum.totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 });

      html += `
        <div class="save-slot-card ${isActive ? 'active-slot' : ''}" data-slot-id="${slot.id}">
          <div class="slot-card-header">
            <div class="slot-card-title-group">
              <span class="slot-icon-box">${slot.icon || '📁'}</span>
              <div class="slot-name-col">
                <span class="slot-name" title="${escapeHtml(slot.name)}">${escapeHtml(slot.name)}</span>
                <span class="slot-updated-text font-mono">${formatDateTime(slot.updatedAt || slot.createdAt)}</span>
              </div>
            </div>
            ${isActive ? '<span class="slot-badge-active">Active Slot</span>' : ''}
          </div>

          <p class="slot-desc-text" title="${escapeHtml(slot.description || '')}">
            ${escapeHtml(slot.description || 'No notes added for this save slot.')}
          </p>

          <div class="slot-metrics-row font-mono">
            <div class="slot-metric-item">
              <span class="slot-metric-label">Balance</span>
              <span class="slot-metric-val" style="color: ${sum.totalBalance >= 0 ? 'var(--text-primary)' : 'var(--debit-color)'}">${balStr}</span>
            </div>
            <div class="slot-metric-item">
              <span class="slot-metric-label">Wallets</span>
              <span class="slot-metric-val">${sum.walletCount}</span>
            </div>
            <div class="slot-metric-item">
              <span class="slot-metric-label">Entries</span>
              <span class="slot-metric-val">${sum.txCount}</span>
            </div>
          </div>

          <div class="slot-actions-row">
            <div class="slot-actions-left">
              ${!isActive ? `
                <button class="btn btn-primary btn-sm" onclick="window.app.loadSaveSlot('${slot.id}')" title="Switch to this save slot">
                  <span>Load</span>
                </button>
              ` : `
                <button class="btn btn-outline btn-sm" onclick="window.app.updateSaveSlot('${slot.id}')" title="Update & overwrite this save slot">
                  <span>Save</span>
                </button>
              `}
              <button class="btn btn-outline btn-sm" onclick="window.app.duplicateSaveSlot('${slot.id}')" title="Clone this save slot">
                <span>Copy</span>
              </button>
            </div>
            <div class="slot-actions-right">
              <button class="btn-icon" onclick="window.app.exportSaveSlotAsBarya('${slot.id}')" title="Export as .barya save file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="btn-icon btn-delete" onclick="window.app.deleteSaveSlot('${slot.id}')" title="Delete save slot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function syncActiveSlotPayload() {
    const activeSlot = state.saveSlots.find(s => s.id === state.activeSlotId);
    if (activeSlot) {
      activeSlot.updatedAt = Date.now();
      activeSlot.summary = generateSlotSummary(state.wallets, state.transactions, state.settings.baseCurrency);
      activeSlot.payload = {
        wallets: JSON.parse(JSON.stringify(state.wallets)),
        debts: JSON.parse(JSON.stringify(state.debts || [])),
        bills: JSON.parse(JSON.stringify(state.bills || [])),
        transactions: JSON.parse(JSON.stringify(state.transactions)),
        categories: JSON.parse(JSON.stringify(state.categories)),
        settings: JSON.parse(JSON.stringify(state.settings)),
        theme: state.theme
      };
      updateActiveSlotBadge();
    }
  }

  function createSaveSlot(name, icon, initMode, desc) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    let payloadWallets = [];
    let payloadTx = [];
    let payloadDebts = [];
    let payloadBills = [];
    let payloadCats = [...DEFAULT_CATEGORIES];
    let payloadSettings = { userName: state.settings.userName || '', baseCurrency: state.settings.baseCurrency || 'PHP' };

    if (initMode === 'copy_current') {
      payloadWallets = JSON.parse(JSON.stringify(state.wallets));
      payloadDebts = JSON.parse(JSON.stringify(state.debts || []));
      payloadBills = JSON.parse(JSON.stringify(state.bills || []));
      payloadTx = JSON.parse(JSON.stringify(state.transactions));
      payloadCats = JSON.parse(JSON.stringify(state.categories));
      payloadSettings = JSON.parse(JSON.stringify(state.settings));
    } else {
      payloadWallets = [
        {
          id: 'wallet_fresh_' + Date.now(),
          name: 'Personal Spending',
          type: 'spending',
          icon: '👛',
          initialBalance: 0.00,
          createdAt: Date.now()
        }
      ];
      payloadTx = [];
      payloadDebts = [];
      payloadBills = [];
    }

    const newSlotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newSlot = {
      id: newSlotId,
      name: cleanName,
      description: (desc || '').trim(),
      icon: icon || '🌟',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: generateSlotSummary(payloadWallets, payloadTx, payloadSettings.baseCurrency),
      payload: {
        wallets: payloadWallets,
        debts: payloadDebts,
        bills: payloadBills,
        transactions: payloadTx,
        categories: payloadCats,
        settings: payloadSettings,
        theme: state.theme
      }
    };

    syncActiveSlotPayload();
    state.saveSlots.unshift(newSlot);
    loadSaveSlot(newSlotId, false);
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Created & switched to Save Slot "${cleanName}" (${newSlot.icon})!`, 'success');
  }

  function loadSaveSlot(slotId, autoSaveCurrent = true) {
    const targetSlot = state.saveSlots.find(s => s.id === slotId);
    if (!targetSlot) return;

    if (autoSaveCurrent) syncActiveSlotPayload();

    state.activeSlotId = slotId;
    const p = targetSlot.payload || {};

    state.wallets = p.wallets && p.wallets.length > 0 ? JSON.parse(JSON.stringify(p.wallets)) : [...DEFAULT_WALLETS];
    state.debts = p.debts ? JSON.parse(JSON.stringify(p.debts)) : [];
    state.bills = p.bills ? JSON.parse(JSON.stringify(p.bills)) : [];
    state.transactions = p.transactions ? JSON.parse(JSON.stringify(p.transactions)) : [];
    state.categories = p.categories ? JSON.parse(JSON.stringify(p.categories)) : [...DEFAULT_CATEGORIES];
    state.settings = p.settings ? JSON.parse(JSON.stringify(p.settings)) : { userName: '', baseCurrency: 'PHP' };
    state.selectedWalletId = 'all';

    if (p.theme && window.BB_THEME) {
      state.theme = p.theme;
      localStorage.setItem(window.BB_DATA.STORAGE_KEY_THEME, p.theme);
      window.BB_THEME.applyTheme(p.theme);
      const sel = document.getElementById('settingsThemeSelect');
      if (sel) sel.value = p.theme;
    }

    const baseSelect = document.getElementById('baseCurrencySelect');
    const txSelect = document.getElementById('txCurrencySelect');
    const nameInput = document.getElementById('settingsUserNameInput');

    if (baseSelect) baseSelect.value = state.settings.baseCurrency || 'PHP';
    if (txSelect) txSelect.value = state.settings.baseCurrency || 'PHP';
    if (nameInput) nameInput.value = state.settings.userName || '';

    if (window.BB_CORE) {
      window.BB_CORE.saveData();
      window.BB_CORE.updateCategoryDatalists();
      window.BB_CORE.updateFxRateAndConversion();
    }
    if (window.BB_THEME) window.BB_THEME.updateTimeGreeting();
    populateWalletDropdowns();
    renderWalletsBar();
    recalculateLedgerBalances();
    if (window.BB_BILLS) {
      window.BB_BILLS.checkBillDueNotifications();
      window.BB_BILLS.renderBillsTable();
    }
    updateActiveSlotBadge();
    renderSaveSlotsGrid();

    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Loaded Save Slot: ${targetSlot.icon} ${targetSlot.name}!`, 'info');
  }

  function updateSaveSlot(slotId) {
    const slot = state.saveSlots.find(s => s.id === slotId);
    if (!slot) return;

    slot.updatedAt = Date.now();
    slot.summary = generateSlotSummary(state.wallets, state.transactions, state.settings.baseCurrency);
    slot.payload = {
      wallets: JSON.parse(JSON.stringify(state.wallets)),
      debts: JSON.parse(JSON.stringify(state.debts || [])),
      bills: JSON.parse(JSON.stringify(state.bills || [])),
      transactions: JSON.parse(JSON.stringify(state.transactions)),
      categories: JSON.parse(JSON.stringify(state.categories)),
      settings: JSON.parse(JSON.stringify(state.settings)),
      theme: state.theme
    };

    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderSaveSlotsGrid();
    updateActiveSlotBadge();
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Saved state to "${slot.name}"!`, 'success');
  }

  function duplicateSaveSlot(slotId) {
    const source = state.saveSlots.find(s => s.id === slotId);
    if (!source) return;

    const cloneId = 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const clone = {
      id: cloneId,
      name: `${source.name} (Copy)`,
      description: source.description || '',
      icon: source.icon || '📁',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: JSON.parse(JSON.stringify(source.summary)),
      payload: JSON.parse(JSON.stringify(source.payload))
    };

    state.saveSlots.unshift(clone);
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderSaveSlotsGrid();
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Cloned "${source.name}" into "${clone.name}"!`, 'success');
  }

  function deleteSaveSlot(slotId) {
    if (state.saveSlots.length <= 1) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('You must have at least one save slot in Bantay Barya.', 'error');
      return;
    }

    const target = state.saveSlots.find(s => s.id === slotId);
    if (!target) return;

    if (confirm(`Delete Save Slot "${target.name}"? This action cannot be undone.`)) {
      state.saveSlots = state.saveSlots.filter(s => s.id !== slotId);

      if (state.activeSlotId === slotId) {
        loadSaveSlot(state.saveSlots[0].id, false);
      } else {
        if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
        renderSaveSlotsGrid();
        updateActiveSlotBadge();
      }

      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Deleted Save Slot "${target.name}".`, 'info');
    }
  }

  function createQuickSnapshot() {
    const now = new Date();
    const timeString = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const snapId = 'slot_snap_' + Date.now();
    const snap = {
      id: snapId,
      name: `Snapshot (${timeString})`,
      description: `Instant snapshot created on ${now.toLocaleString()}`,
      icon: '📸',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: generateSlotSummary(state.wallets, state.transactions, state.settings.baseCurrency),
      payload: {
        wallets: JSON.parse(JSON.stringify(state.wallets)),
        transactions: JSON.parse(JSON.stringify(state.transactions)),
        categories: JSON.parse(JSON.stringify(state.categories)),
        settings: JSON.parse(JSON.stringify(state.settings)),
        theme: state.theme
      }
    };

    state.saveSlots.unshift(snap);
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderSaveSlotsGrid();
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Instant Snapshot created: 📸 ${snap.name}!`, 'success');
  }

  function exportSaveSlotAsBarya(slotId) {
    const slot = state.saveSlots.find(s => s.id === slotId) || state.saveSlots[0];
    if (!slot) return;

    const baryaPayload = {
      format: 'bantay_barya_save',
      fileVersion: '7.0',
      app: 'Bantay Barya',
      author: 'Jerome Gotangco (jeromesg@google.com)',
      website: 'https://antigravity.google/',
      exportedAt: new Date().toISOString(),
      slot: slot
    };

    const cleanTitle = slot.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanTitle}_${getRelativeDateString(0)}.barya`;

    const dataStr = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(JSON.stringify(baryaPayload, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Exported "${slot.name}" as .barya save file!`, 'success');
  }

  function importBaryaFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);

        let newSlot = null;

        if (parsed.format === 'bantay_barya_save' && parsed.slot) {
          newSlot = parsed.slot;
          newSlot.id = 'slot_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          newSlot.name = newSlot.name ? `${newSlot.name} (Imported)` : 'Imported Save';
          newSlot.updatedAt = Date.now();
        } else if (parsed.transactions && Array.isArray(parsed.transactions)) {
          const name = file.name.replace(/\.(barya|json)$/i, '') || 'Imported Ledger';
          const w = (parsed.wallets && parsed.wallets.length > 0) ? parsed.wallets : [...DEFAULT_WALLETS];
          const tx = parsed.transactions;
          const cats = parsed.categories || [...DEFAULT_CATEGORIES];
          const sett = parsed.settings || { userName: '', baseCurrency: parsed.baseCurrency || 'PHP' };

          newSlot = {
            id: 'slot_imp_' + Date.now(),
            name: name,
            description: `Imported from ${file.name}`,
            icon: '📥',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            summary: generateSlotSummary(w, tx, sett.baseCurrency),
            payload: {
              wallets: w,
              transactions: tx,
              categories: cats,
              settings: sett,
              theme: parsed.theme || 'auto_date'
            }
          };
        }

        if (newSlot) {
          state.saveSlots.unshift(newSlot);
          if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
          renderSaveSlotsGrid();
          loadSaveSlot(newSlot.id, true);
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Successfully imported .barya save: "${newSlot.name}"!`, 'success');
        } else {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Invalid .barya file format.', 'error');
        }
      } catch (err) {
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Error reading .barya file: ' + err.message, 'error');
      }

      const input = document.getElementById('importBaryaFileInput');
      if (input) input.value = '';
    };
    reader.readAsText(file);
  }

  function setupSaveVaultListeners() {
    const modal = document.getElementById('saveVaultModal');
    const openVault = () => {
      renderSaveSlotsGrid();
      modal?.classList.add('active');
    };

    document.getElementById('openSaveVaultBtn')?.addEventListener('click', openVault);

    const closeVault = () => modal?.classList.remove('active');
    document.getElementById('closeSaveVaultModalBtn')?.addEventListener('click', closeVault);
    document.getElementById('closeSaveVaultModalFooterBtn')?.addEventListener('click', closeVault);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeVault();
    });

    document.getElementById('quickSnapshotBtn')?.addEventListener('click', () => createQuickSnapshot());
    document.getElementById('exportActiveBaryaBtn')?.addEventListener('click', () => exportSaveSlotAsBarya(state.activeSlotId));

    const importInput = document.getElementById('importBaryaFileInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) importBaryaFile(e.target.files[0]);
      });
    }

    const newSaveSlotForm = document.getElementById('newSaveSlotForm');
    if (newSaveSlotForm) {
      newSaveSlotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createSaveSlot(
          document.getElementById('newSlotName').value,
          document.getElementById('newSlotIcon').value,
          document.getElementById('newSlotInitMode').value,
          document.getElementById('newSlotDesc').value
        );
        document.getElementById('newSlotName').value = '';
        document.getElementById('newSlotDesc').value = '';
      });
    }

    const dropzone = document.getElementById('baryaDropzone');
    if (dropzone) {
      dropzone.addEventListener('click', () => importInput?.click());

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) importBaryaFile(files[0]);
      });
    }
  }

  function setupExtensionGuideListeners() {
    const extModal = document.getElementById('extensionGuideModal');
    const openExtModal = () => {
      document.getElementById('saveVaultModal')?.classList.remove('active');
      extModal?.classList.add('active');
    };

    document.getElementById('openExtensionGuideBtn')?.addEventListener('click', openExtModal);

    const closeExtModal = () => extModal?.classList.remove('active');
    document.getElementById('closeExtensionGuideModalBtn')?.addEventListener('click', closeExtModal);
    document.getElementById('closeExtensionGuideModalFooterBtn')?.addEventListener('click', closeExtModal);
    extModal?.addEventListener('click', (e) => {
      if (e.target === extModal) closeExtModal();
    });
  }

  function setupReconciliationListeners() {
    const modal = document.getElementById('reconcileModal');
    const openReconcileModal = () => {
      populateWalletDropdowns();
      const wid = (state.selectedWalletId !== 'all' && state.selectedWalletId) ? state.selectedWalletId : (state.wallets[0]?.id || 'wallet_default');
      const select = document.getElementById('reconcileWalletSelect');
      if (select) select.value = wid;

      updateReconcileModalWalletState();
      modal?.classList.add('active');
      const actualInput = document.getElementById('reconcileActualInput');
      if (actualInput) {
        actualInput.focus();
        actualInput.select();
      }
    };

    document.getElementById('openReconcileModalBtn')?.addEventListener('click', openReconcileModal);
    document.getElementById('kpiReconcileTrigger')?.addEventListener('click', openReconcileModal);

    const closeReconcile = () => modal?.classList.remove('active');
    document.getElementById('closeReconcileModalBtn')?.addEventListener('click', closeReconcile);
    document.getElementById('cancelReconcileBtn')?.addEventListener('click', closeReconcile);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeReconcile();
    });

    document.getElementById('reconcileWalletSelect')?.addEventListener('change', updateReconcileModalWalletState);
    document.getElementById('reconcileActualInput')?.addEventListener('input', updateReconciliationDelta);

    document.getElementById('reconcileCalendarPickerBtn')?.addEventListener('click', () => {
      const recDate = document.getElementById('reconcileDate');
      if (recDate && typeof recDate.showPicker === 'function') recDate.showPicker();
      else if (recDate) recDate.focus();
    });

    const reconcileForm = document.getElementById('reconcileForm');
    if (reconcileForm) {
      reconcileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const targetWalletId = document.getElementById('reconcileWalletSelect').value;
        const targetWallet = getWallet(targetWalletId);
        const currentBal = getWalletCurrentBalance(targetWalletId);
        const actualBal = parseFloat(document.getElementById('reconcileActualInput').value);
        const recDate = document.getElementById('reconcileDate').value || getRelativeDateString(0);
        const recNotes = document.getElementById('reconcileNotes').value.trim() || 'Balance reconciliation';

        if (isNaN(actualBal)) {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Please enter a valid actual statement balance.', 'error');
          return;
        }

        const diff = Math.round((actualBal - currentBal) * 100) / 100;

        if (diff === 0) {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Wallet "${targetWallet?.name}" balance already matches actual statement balance.`, 'info');
          closeReconcile();
          return;
        }

        const isCredit = diff > 0;
        const amount = Math.abs(diff);

        const newTx = {
          id: 'tx_rec_' + Date.now(),
          walletId: targetWalletId,
          date: recDate,
          item: 'Balance Reconciliation',
          type: isCredit ? 'credit' : 'debit',
          inputCurrency: state.settings.baseCurrency,
          inputAmount: amount,
          exchangeRate: 1.0,
          credit: isCredit ? amount : 0,
          debit: isCredit ? 0 : amount,
          notes: `${recNotes} (${targetWallet?.name}: ${isCredit ? '+' : '-'}${formatCurrency(amount)})`,
          createdAt: Date.now()
        };

        state.transactions.push(newTx);
        recalculateLedgerBalances();
        closeReconcile();

        if (window.BB_CORE?.showToast) {
          window.BB_CORE.showToast(`Reconciled ${targetWallet?.name}! Posted ${isCredit ? '+' : '-'}${formatCurrency(amount)} adjustment.`, 'success');
        }
      });
    }
  }

  function updateReconcileModalWalletState() {
    const wid = document.getElementById('reconcileWalletSelect')?.value;
    const currentBal = getWalletCurrentBalance(wid);
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const baseSym = CURRENCIES[baseCurr]?.symbol || '₱';

    const pfx = document.getElementById('reconcileCurrencyPrefix');
    const curBalDisplay = document.getElementById('reconcileCurrentBalDisplay');
    const actualInput = document.getElementById('reconcileActualInput');
    const dateInput = document.getElementById('reconcileDate');
    const notesInput = document.getElementById('reconcileNotes');

    if (pfx) pfx.textContent = baseSym;
    if (curBalDisplay) curBalDisplay.textContent = formatCurrency(currentBal);
    if (actualInput) actualInput.value = currentBal.toFixed(2);
    if (dateInput) dateInput.value = getRelativeDateString(0);
    if (notesInput) notesInput.value = 'Monthly statement balance reconciliation';

    updateReconciliationDelta();
  }

  function updateReconciliationDelta() {
    const wid = document.getElementById('reconcileWalletSelect')?.value;
    const currentBal = getWalletCurrentBalance(wid);
    const actualBal = parseFloat(document.getElementById('reconcileActualInput')?.value);
    const diffDisplay = document.getElementById('reconcileDiffDisplay');
    const diffBox = document.getElementById('reconcileDiffBox');
    const diffTypeLabel = document.getElementById('reconcileDiffTypeLabel');

    if (isNaN(actualBal)) {
      if (diffDisplay) diffDisplay.textContent = '—';
      if (diffBox) diffBox.className = 'reconcile-diff-box';
      return;
    }

    const diff = Math.round((actualBal - currentBal) * 100) / 100;

    if (diff === 0) {
      if (diffDisplay) diffDisplay.textContent = '₱0.00 (In balance)';
      if (diffBox) diffBox.className = 'reconcile-diff-box';
      if (diffTypeLabel) diffTypeLabel.innerHTML = 'Classification: <strong>Balance Reconciliation</strong> (No change)';
    } else if (diff > 0) {
      if (diffDisplay) {
        diffDisplay.textContent = `+${formatCurrency(diff)} (Credit Adjustment)`;
        diffDisplay.style.color = 'var(--credit-color)';
      }
      if (diffBox) diffBox.className = 'reconcile-diff-box diff-positive';
      if (diffTypeLabel) diffTypeLabel.innerHTML = `Classification: <strong>Balance Reconciliation</strong> (+${formatCurrency(diff)} Credit)`;
    } else {
      if (diffDisplay) {
        diffDisplay.textContent = `-${formatCurrency(Math.abs(diff))} (Debit Adjustment)`;
        diffDisplay.style.color = 'var(--debit-color)';
      }
      if (diffBox) diffBox.className = 'reconcile-diff-box diff-negative';
      if (diffTypeLabel) diffTypeLabel.innerHTML = `Classification: <strong>Balance Reconciliation</strong> (-${formatCurrency(Math.abs(diff))} Debit)`;
    }
  }

  window.BB_WALLETS = {
    getWallet,
    getWalletName,
    getWalletTypeLabel,
    getWalletIcon,
    getWalletCurrentBalance,
    getFxRate,
    convertCurrency,
    fetchExchangeRate,
    getWalletBaseConvertedBalance,
    getTotalCombinedBalance,
    renderWalletsBar,
    selectWallet,
    populateWalletDropdowns,
    renderManageWalletsTable,
    createWallet,
    openEditWalletModal,
    promptDeleteWallet,
    reassignAndDeleteWallet,
    setupWalletListeners,
    calculateSpendingBuffer,
    updateSpendingBufferDisplay,
    recalculateLedgerBalances,
    generateSlotSummary,
    initSaveVaultEngine,
    updateActiveSlotBadge,
    renderSaveSlotsGrid,
    syncActiveSlotPayload,
    createSaveSlot,
    loadSaveSlot,
    updateSaveSlot,
    duplicateSaveSlot,
    deleteSaveSlot,
    createQuickSnapshot,
    exportSaveSlotAsBarya,
    importBaryaFile,
    setupSaveVaultListeners,
    setupExtensionGuideListeners,
    setupReconciliationListeners,
    updateReconcileModalWalletState,
    updateReconciliationDelta
  };
})(window);
