/**
 * Bantay Barya - Main Application Core & Controller
 * Features:
 *  - Save Vault & Multiple Saves (.barya proprietary format)
 *  - Multi-Wallet Architecture & Continuous Ledger Engine
 *  - Nature Themes (Sunflower, Snow, Sakura, Pumpkin)
 *  - Hero Analytics Carousel & Inspiration Insights
 *  - Liabilities Tracker & Debt Snowball Simulator
 *  - Bill Tracker & Payment Schedules
 *  - Balance Sheet (Statement of Financial Position)
 *  - Auto-Save Engine (5-Minute Interval & On-Demand)
 *  - 7-Digit PIN Security
 *  - Attribution: Designed and product-directed by Jerome Gotangco. Developed with Google Antigravity / Gemini.
 */
(function (window) {
  'use strict';

  const {
    CURRENCIES,
    DEFAULT_CATEGORIES,
    DEFAULT_WALLETS,
    STORAGE_KEY_SAVE_SLOTS,
    STORAGE_KEY_ACTIVE_SLOT_ID,
    STORAGE_KEY_WALLETS,
    STORAGE_KEY_DEBTS,
    STORAGE_KEY_BILLS,
    STORAGE_KEY_TRANSACTIONS,
    STORAGE_KEY_SETTINGS,
    STORAGE_KEY_CATEGORIES,
    STORAGE_KEY_DONT_SHOW_WELCOME,
    STORAGE_KEY_FX_CACHE,
    STORAGE_KEY_LAST_SAVED,
    STORAGE_KEY_ENCRYPTED_VAULT,
    STORAGE_KEY_MIGRATION_STAGING,
    STORAGE_KEY_THROTTLE,
    STORAGE_KEY_PIN,
    LEGACY_KEY_PIN_V6,
    LEGACY_KEY_TRANSACTIONS_V6,
    LEGACY_KEY_SETTINGS_V6,
    LEGACY_KEY_CATEGORIES_V6,
    getRelativeDateString,
    formatDateTime,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;
  let lastSavedTimestamp = Date.now();
  let autoSaveTimer = null;
  let relativeTimeTimer = null;
  let pendingOverwriteCallback = null;

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  function updateCategoryDatalists() {
    const listEl = document.getElementById('categorySuggestions');
    if (listEl) {
      listEl.innerHTML = state.categories
        .map(cat => `<option value="${escapeHtml(cat)}">`)
        .join('');
    }
  }

  function renderCategoryManagerTable() {
    const tableBody = document.getElementById('categoryTableBody');
    if (!tableBody) return;

    const counts = {};
    state.transactions.forEach(tx => {
      const cat = (tx.item || 'Unclassified').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    let html = '';
    state.categories.forEach(cat => {
      const usage = counts[cat] || 0;
      const usagePillClass = usage > 0 ? 'cat-usage-pill in-use' : 'cat-usage-pill';
      const isSystemCat = (cat === 'Balance Brought Forward' || cat === 'Balance Reconciliation');

      html += `
        <tr>
          <td>
            <strong class="category-name-label">${escapeHtml(cat)}</strong>
            ${isSystemCat ? '<span class="badge-tag" style="background-color: var(--accent-primary-subtle); color: var(--accent-primary); font-size: 0.65rem;">System</span>' : ''}
          </td>
          <td class="text-center">
            <span class="${usagePillClass}">${usage} ${usage === 1 ? 'entry' : 'entries'}</span>
          </td>
          <td class="text-right">
            <div class="row-actions" style="justify-content: flex-end;">
              <button class="btn-icon" title="Rename classification" onclick="window.app.promptRenameCategory('${escapeHtml(cat)}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" title="Delete classification" onclick="window.app.deleteCategory('${escapeHtml(cat)}')">
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

  function addCategory(name) {
    const clean = (name || '').trim();
    if (!clean) return;

    if (state.categories.some(c => c.toLowerCase() === clean.toLowerCase())) {
      showToast(`Category "${clean}" already exists.`, 'error');
      return;
    }

    state.categories.push(clean);
    saveData();
    updateCategoryDatalists();
    renderCategoryManagerTable();
    showToast(`Category "${clean}" created!`, 'success');
  }

  function renameCategory(oldName, newName) {
    const cleanNew = (newName || '').trim();
    if (!cleanNew || cleanNew === oldName) return;

    const index = state.categories.indexOf(oldName);
    if (index === -1) return;

    state.categories[index] = cleanNew;

    let updateCount = 0;
    state.transactions.forEach(tx => {
      if (tx.item === oldName) {
        tx.item = cleanNew;
        updateCount++;
      }
    });

    saveData();
    updateCategoryDatalists();
    renderCategoryManagerTable();
    if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
    showToast(`Renamed "${oldName}" to "${cleanNew}" (${updateCount} entries updated)`, 'success');
  }

  function deleteCategory(catName) {
    const txCount = state.transactions.filter(t => t.item === catName).length;

    if (txCount === 0) {
      if (confirm(`Delete unused classification "${catName}"?`)) {
        state.categories = state.categories.filter(c => c !== catName);
        saveData();
        updateCategoryDatalists();
        renderCategoryManagerTable();
        showToast(`Category "${catName}" removed.`, 'info');
      }
      return;
    }

    document.getElementById('reassignOldCategory').value = catName;
    document.getElementById('reassignOldCategoryName').textContent = `"${catName}"`;
    document.getElementById('reassignTxCount').textContent = txCount;

    const otherCategories = state.categories.filter(c => c !== catName);
    if (otherCategories.length === 0) {
      otherCategories.push('Miscellaneous');
      state.categories.push('Miscellaneous');
    }

    document.getElementById('reassignTargetCategorySelect').innerHTML = otherCategories
      .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join('');

    document.getElementById('reassignModal')?.classList.add('active');
  }

  function reassignAndDeleteCategory(oldName, targetName) {
    if (!oldName || !targetName || oldName === targetName) return;

    let movedCount = 0;
    state.transactions.forEach(tx => {
      if (tx.item === oldName) {
        tx.item = targetName;
        movedCount++;
      }
    });

    state.categories = state.categories.filter(c => c !== oldName);
    if (!state.categories.includes(targetName)) {
      state.categories.push(targetName);
    }

    saveData();
    updateCategoryDatalists();
    renderCategoryManagerTable();
    if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();

    document.getElementById('reassignModal')?.classList.remove('active');
    showToast(`Reassigned ${movedCount} transactions to "${targetName}" and removed "${oldName}".`, 'success');
  }

  function setupCategoryListeners() {
    const catModal = document.getElementById('categoryModal');
    const openCatModal = () => {
      renderCategoryManagerTable();
      catModal?.classList.add('active');
      document.getElementById('newCategoryInput')?.focus();
    };

    document.getElementById('openCategoryModalBtn')?.addEventListener('click', openCatModal);
    document.getElementById('quickManageCategoryBtn')?.addEventListener('click', openCatModal);

    const closeCatModal = () => catModal?.classList.remove('active');
    document.getElementById('closeCategoryModalBtn')?.addEventListener('click', closeCatModal);
    document.getElementById('closeCategoryModalFooterBtn')?.addEventListener('click', closeCatModal);
    catModal?.addEventListener('click', (e) => {
      if (e.target === catModal) closeCatModal();
    });

    document.getElementById('newCategoryForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('newCategoryInput');
      if (input) {
        addCategory(input.value);
        input.value = '';
      }
    });

    const reassignModal = document.getElementById('reassignModal');
    const closeReassign = () => reassignModal?.classList.remove('active');
    document.getElementById('closeReassignModalBtn')?.addEventListener('click', closeReassign);
    document.getElementById('cancelReassignBtn')?.addEventListener('click', closeReassign);
    reassignModal?.addEventListener('click', (e) => {
      if (e.target === reassignModal) closeReassign();
    });

    document.getElementById('reassignForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const oldName = document.getElementById('reassignOldCategory').value;
      const targetName = document.getElementById('reassignTargetCategorySelect').value;
      reassignAndDeleteCategory(oldName, targetName);
    });
  }

  async function updateFxRateAndConversion() {
    const txCurrSelect = document.getElementById('txCurrencySelect');
    const txDateInput = document.getElementById('txDate');
    const txAmountInput = document.getElementById('txAmount');
    const pfx = document.getElementById('amountPrefix');
    const banner = document.getElementById('fxRateBanner');
    const rateText = document.getElementById('fxRateText');
    const convDisplay = document.getElementById('fxConvertedDisplay');

    const inputCurrency = txCurrSelect ? txCurrSelect.value : 'PHP';
    const baseCurrency = state.settings.baseCurrency || 'PHP';
    const txDate = txDateInput ? txDateInput.value : getRelativeDateString(0);
    const inputAmount = parseFloat(txAmountInput ? txAmountInput.value : 0) || 0;

    const inputSymbol = CURRENCIES[inputCurrency]?.symbol || inputCurrency;
    if (pfx) pfx.textContent = inputSymbol;

    if (inputCurrency === baseCurrency) {
      if (banner) banner.style.display = 'none';
      state.currentInputFxRate = 1.0;
      updateProjectedBalance();
      return;
    }

    if (banner) banner.style.display = 'flex';
    if (rateText) rateText.textContent = `Fetching live exchange rate for ${inputCurrency}...`;

    const rate = window.BB_WALLETS
      ? await window.BB_WALLETS.fetchExchangeRate(inputCurrency, baseCurrency, txDate)
      : 1.0;
    state.currentInputFxRate = rate;

    const rateDisplay = rate >= 1 ? rate.toFixed(2) : rate.toFixed(4);
    if (rateText) rateText.textContent = `Live FX Rate (${txDate}): 1 ${inputCurrency} = ${rateDisplay} ${baseCurrency}`;

    const convertedBaseAmount = inputAmount * rate;
    if (convDisplay) convDisplay.textContent = formatCurrency(convertedBaseAmount);

    updateProjectedBalance();
  }

  function updateProjectedBalance() {
    const txWalletSelect = document.getElementById('txWalletSelect');
    const txAmountInput = document.getElementById('txAmount');
    const typeCreditRadio = document.getElementById('typeCredit');
    const projPreview = document.getElementById('projectedBalancePreview');

    const targetWalletId = txWalletSelect ? txWalletSelect.value : state.wallets[0]?.id;
    const currentWalletBal = window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(targetWalletId) : 0;
    const inputAmount = parseFloat(txAmountInput ? txAmountInput.value : 0) || 0;
    const isCredit = typeCreditRadio ? typeCreditRadio.checked : false;
    const rate = state.currentInputFxRate || 1.0;
    const baseAmount = inputAmount * rate;

    let projected = currentWalletBal;
    if (baseAmount > 0) {
      projected = isCredit ? currentWalletBal + baseAmount : currentWalletBal - baseAmount;
    }

    if (projPreview) {
      projPreview.textContent = formatCurrency(projected);
      projPreview.style.color = projected >= 0 ? 'var(--text-primary)' : 'var(--debit-color)';
    }
  }

  function setupFormListeners() {
    const txDateInput = document.getElementById('txDate');
    if (txDateInput) txDateInput.value = getRelativeDateString(0);

    document.getElementById('calendarPickerBtn')?.addEventListener('click', () => {
      const d = document.getElementById('txDate');
      if (d && typeof d.showPicker === 'function') d.showPicker();
      else if (d) d.focus();
    });

    document.getElementById('editCalendarPickerBtn')?.addEventListener('click', () => {
      const d = document.getElementById('editTxDate');
      if (d && typeof d.showPicker === 'function') d.showPicker();
      else if (d) d.focus();
    });

    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const offset = parseInt(chip.getAttribute('data-offset'), 10) || 0;
        const d = document.getElementById('txDate');
        if (d) d.value = getRelativeDateString(offset);
        updateFxRateAndConversion();
      });
    });

    document.getElementById('typeDebit')?.addEventListener('change', () => {
      const lbl = document.getElementById('amountLabel');
      if (lbl) lbl.innerHTML = `<span>Debit Amount</span> <span class="required-star">*</span>`;
      updateProjectedBalance();
    });

    document.getElementById('typeCredit')?.addEventListener('change', () => {
      const lbl = document.getElementById('amountLabel');
      if (lbl) lbl.innerHTML = `<span>Credit Amount</span> <span class="required-star">*</span>`;
      updateProjectedBalance();
    });

    document.getElementById('txWalletSelect')?.addEventListener('change', updateProjectedBalance);
    document.getElementById('txCurrencySelect')?.addEventListener('change', updateFxRateAndConversion);
    document.getElementById('txDate')?.addEventListener('change', updateFxRateAndConversion);

    document.getElementById('txAmount')?.addEventListener('input', () => {
      const amt = parseFloat(document.getElementById('txAmount').value) || 0;
      const rate = state.currentInputFxRate || 1.0;
      const convDisplay = document.getElementById('fxConvertedDisplay');
      if (convDisplay) convDisplay.textContent = formatCurrency(amt * rate);
      updateProjectedBalance();
    });

    document.getElementById('refreshFxBtn')?.addEventListener('click', async () => {
      const curr = document.getElementById('txCurrencySelect')?.value || 'PHP';
      const base = state.settings.baseCurrency || 'PHP';
      const date = document.getElementById('txDate')?.value || getRelativeDateString(0);
      const cacheKey = `fx_${curr}_${base}_${date}`;

      try {
        const rawStore = window.BB_STORAGE ? window.BB_STORAGE.getItemSync(STORAGE_KEY_FX_CACHE) : (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_FX_CACHE) : null);
        const store = JSON.parse(rawStore || '{}');
        delete store[cacheKey];
        if (window.BB_STORAGE) {
          window.BB_STORAGE.setItemSync(STORAGE_KEY_FX_CACHE, JSON.stringify(store));
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_FX_CACHE, JSON.stringify(store));
        }
      } catch (e) {}

      showToast('Refreshing live online exchange rate...', 'info');
      await updateFxRateAndConversion();
      showToast('Exchange rate updated!', 'success');
    });

    document.getElementById('clearFormBtn')?.addEventListener('click', () => {
      const form = document.getElementById('transactionForm');
      if (form) form.reset();
      const d = document.getElementById('txDate');
      if (d) d.value = getRelativeDateString(0);
      const curr = document.getElementById('txCurrencySelect');
      if (curr) curr.value = state.settings.baseCurrency || 'PHP';
      const debitRadio = document.getElementById('typeDebit');
      if (debitRadio) debitRadio.checked = true;
      if (state.selectedWalletId !== 'all') {
        const wSel = document.getElementById('txWalletSelect');
        if (wSel) wSel.value = state.selectedWalletId;
      }
      updateFxRateAndConversion();
    });

    document.getElementById('transactionForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const walletId = document.getElementById('txWalletSelect')?.value || state.wallets[0]?.id;
      const date = document.getElementById('txDate')?.value;
      const item = document.getElementById('txItem')?.value.trim();
      const inputCurrency = document.getElementById('txCurrencySelect')?.value || 'PHP';
      const inputAmount = parseFloat(document.getElementById('txAmount')?.value);
      const isCredit = document.getElementById('typeCredit')?.checked;
      const notes = document.getElementById('txNotes')?.value.trim();

      if (!walletId || !date || !item || isNaN(inputAmount) || inputAmount <= 0) {
        showToast('Please fill in all required fields with a valid amount.', 'error');
        return;
      }

      if (!state.categories.includes(item)) {
        state.categories.push(item);
        updateCategoryDatalists();
      }

      const baseCurrency = state.settings.baseCurrency || 'PHP';
      const rate = inputCurrency === baseCurrency
        ? 1.0
        : (window.BB_WALLETS ? await window.BB_WALLETS.fetchExchangeRate(inputCurrency, baseCurrency, date) : 1.0);

      const baseAmount = Math.round((inputAmount * rate) * 100) / 100;

      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        walletId: walletId,
        date: date,
        item: item,
        type: isCredit ? 'credit' : 'debit',
        inputCurrency: inputCurrency,
        inputAmount: inputAmount,
        exchangeRate: rate,
        credit: isCredit ? baseAmount : 0,
        debit: isCredit ? 0 : baseAmount,
        notes: notes,
        createdAt: Date.now()
      };

      state.transactions.push(newTx);
      if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();

      const targetWallet = window.BB_WALLETS ? window.BB_WALLETS.getWallet(walletId) : null;
      const origText = inputCurrency !== baseCurrency
        ? ` (${inputCurrency} ${inputAmount.toFixed(2)} @ ${rate.toFixed(2)})`
        : '';

      showToast(`Recorded "${item}" in ${targetWallet?.name}!${origText}`, 'success');

      document.getElementById('txAmount').value = '';
      document.getElementById('txNotes').value = '';
      document.getElementById('txItem').value = '';
      updateFxRateAndConversion();
      document.getElementById('txItem')?.focus();
    });
  }

  function updateKPIs() {
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const baseSymbol = CURRENCIES[baseCurr]?.symbol || '₱';

    const headerBaseTag = document.getElementById('headerBaseCurrencyTag');
    const newWalletPfx = document.getElementById('newWalletPrefix');
    const editWalletPfx = document.getElementById('editWalletPrefix');

    if (headerBaseTag) headerBaseTag.textContent = `Base: ${baseCurr} (${baseSymbol})`;
    if (newWalletPfx) newWalletPfx.textContent = baseSymbol;
    if (editWalletPfx) editWalletPfx.textContent = baseSymbol;

    let targetTx = state.transactions;
    let initialBal = 0;

    const balKpiLabel = document.getElementById('balanceKpiLabel');
    const walletsSecSub = document.getElementById('walletsSectionSubtitle');

    if (state.selectedWalletId !== 'all') {
      targetTx = targetTx.filter(t => t.walletId === state.selectedWalletId && !t.isArchived);
      const w = window.BB_WALLETS ? window.BB_WALLETS.getWallet(state.selectedWalletId) : null;
      initialBal = w ? (parseFloat(w.initialBalance) || 0) : 0;
      if (balKpiLabel) balKpiLabel.textContent = `${w?.name || 'Wallet'} Balance`;
      if (walletsSecSub) walletsSecSub.textContent = `Filtered to: ${w?.icon || '👛'} ${w?.name || 'Wallet'}`;
    } else {
      targetTx = targetTx.filter(t => !t.isArchived);
      initialBal = state.wallets.reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);
      if (balKpiLabel) balKpiLabel.textContent = `Total Net Balance (${state.wallets.length} Wallets)`;
      if (walletsSecSub) walletsSecSub.textContent = `Click any wallet chip to filter view (${state.wallets.length} active wallets)`;
    }

    let totalCredit = 0;
    let totalDebit = 0;
    let creditCount = 0;
    let debitCount = 0;

    targetTx.forEach((tx) => {
      // If viewing all wallets, transfers between own accounts are internal movements, not external income or expense
      if (state.selectedWalletId === 'all' && (tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in')) {
        return;
      }

      const cr = parseFloat(tx.credit) || 0;
      const db = parseFloat(tx.debit) || 0;
      if (cr > 0) {
        totalCredit += cr;
        creditCount++;
      }
      if (db > 0) {
        totalDebit += db;
        debitCount++;
      }
    });

    const currentBalance = state.selectedWalletId === 'all'
      ? (window.BB_WALLETS ? window.BB_WALLETS.getTotalCombinedBalance() : 0)
      : (window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(state.selectedWalletId) : 0);

    const netFlow = totalCredit - totalDebit;

    const curBalDisplay = document.getElementById('currentBalanceDisplay');
    const initBalSubtext = document.getElementById('initialBalanceSubtext');
    const balStatusBadge = document.getElementById('balanceStatusBadge');
    const totCreditDisplay = document.getElementById('totalCreditDisplay');
    const credCountDisplay = document.getElementById('creditCountDisplay');
    const totDebitDisplay = document.getElementById('totalDebitDisplay');
    const debCountDisplay = document.getElementById('debitCountDisplay');
    const netFlowDisp = document.getElementById('netFlowDisplay');
    const totalTxDisp = document.getElementById('totalTxCountDisplay');
    const savingsRateDisp = document.getElementById('savingsRateDisplay');

    if (curBalDisplay) curBalDisplay.textContent = formatCurrency(currentBalance);
    if (initBalSubtext) initBalSubtext.textContent = `BBF: ${formatCurrency(initialBal)}`;

    if (balStatusBadge) {
      if (currentBalance >= 0) {
        balStatusBadge.textContent = 'Healthy';
        balStatusBadge.className = 'kpi-badge badge-positive';
      } else {
        balStatusBadge.textContent = 'Deficit';
        balStatusBadge.className = 'kpi-badge badge-negative';
      }
    }

    if (totCreditDisplay) totCreditDisplay.textContent = formatCurrency(totalCredit);
    if (credCountDisplay) credCountDisplay.textContent = `${creditCount} ${creditCount === 1 ? 'deposit' : 'deposits'}`;

    if (totDebitDisplay) totDebitDisplay.textContent = formatCurrency(totalDebit);
    if (debCountDisplay) debCountDisplay.textContent = `${debitCount} ${debitCount === 1 ? 'expense' : 'expenses'}`;

    if (netFlowDisp) {
      netFlowDisp.textContent = (netFlow >= 0 ? '+' : '') + formatCurrency(netFlow);
      netFlowDisp.style.color = netFlow >= 0 ? 'var(--credit-color)' : 'var(--debit-color)';
    }
    if (totalTxDisp) totalTxDisp.textContent = `${targetTx.length} total entries`;

    if (savingsRateDisp) {
      if (totalCredit > 0) {
        const retainedRate = Math.max(0, Math.round(((totalCredit - totalDebit) / totalCredit) * 100));
        savingsRateDisp.textContent = `${retainedRate}% retained`;
      } else {
        savingsRateDisp.textContent = '0% retained';
      }
    }
  }

  function getFilteredTransactions() {
    let list = [...state.transactions];

    if (state.typeFilter === 'archived') {
      list = list.filter(tx => tx.isArchived);
    } else {
      list = list.filter(tx => !tx.isArchived);
    }

    if (state.selectedWalletId !== 'all') {
      list = list.filter(tx => tx.walletId === state.selectedWalletId);
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter((tx) => {
        const itemMatch = (tx.item || '').toLowerCase().includes(q);
        const notesMatch = (tx.notes || '').toLowerCase().includes(q);
        const currMatch = (tx.inputCurrency || '').toLowerCase().includes(q);
        const walletObj = window.BB_WALLETS ? window.BB_WALLETS.getWallet(tx.walletId) : null;
        const walletMatch = walletObj ? walletObj.name.toLowerCase().includes(q) : false;
        const amountMatch = (tx.credit ? tx.credit.toString() : tx.debit.toString()).includes(q);
        return itemMatch || notesMatch || currMatch || walletMatch || amountMatch;
      });
    }

    if (state.typeFilter === 'credit') {
      list = list.filter(tx => (parseFloat(tx.credit) || 0) > 0 && !tx.isTransfer);
    } else if (state.typeFilter === 'debit') {
      list = list.filter(tx => (parseFloat(tx.debit) || 0) > 0 && !tx.isTransfer);
    } else if (state.typeFilter === 'transfer') {
      list = list.filter(tx => tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in');
    }

    if (state.dateFilter !== 'all') {
      const now = new Date();
      list = list.filter((tx) => {
        if (!tx.date) return true;
        const txDate = new Date(tx.date);
        if (state.dateFilter === 'this_month') {
          return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
        } else if (state.dateFilter === 'last_30') {
          const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        } else if (state.dateFilter === 'this_year') {
          return txDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    list.sort((a, b) => {
      let valA, valB;
      switch (state.sortColumn) {
        case 'date':
          valA = a.date || '';
          valB = b.date || '';
          if (valA === valB) {
            valA = a.createdAt || 0;
            valB = b.createdAt || 0;
          }
          break;
        case 'wallet':
          valA = (window.BB_WALLETS?.getWallet(a.walletId)?.name || '').toLowerCase();
          valB = (window.BB_WALLETS?.getWallet(b.walletId)?.name || '').toLowerCase();
          break;
        case 'item':
          valA = (a.item || '').toLowerCase();
          valB = (b.item || '').toLowerCase();
          break;
        case 'credit':
          valA = parseFloat(a.credit) || 0;
          valB = parseFloat(b.credit) || 0;
          break;
        case 'debit':
          valA = parseFloat(a.debit) || 0;
          valB = parseFloat(b.debit) || 0;
          break;
        case 'balance':
          valA = parseFloat(state.selectedWalletId === 'all' ? a.runningBalance : a.walletRunningBalance) || 0;
          valB = parseFloat(state.selectedWalletId === 'all' ? b.runningBalance : b.walletRunningBalance) || 0;
          break;
        default:
          valA = a.date || '';
          valB = b.date || '';
      }

      if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  function renderLedgerTable() {
    const filtered = getFilteredTransactions();
    const totalCount = state.selectedWalletId === 'all'
      ? state.transactions.filter(t => !t.isArchived).length
      : state.transactions.filter(t => t.walletId === state.selectedWalletId && !t.isArchived).length;

    const countBadge = document.getElementById('ledgerCountBadge');
    const tableBody = document.getElementById('ledgerTableBody');
    const emptyContainer = document.getElementById('emptyStateContainer');

    if (countBadge) countBadge.textContent = `${filtered.length} of ${totalCount} Entries`;

    if (filtered.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (emptyContainer) emptyContainer.style.display = 'flex';
      return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';

    const baseCurr = state.settings.baseCurrency || 'PHP';
    let html = '';

    filtered.forEach((tx) => {
      const credit = parseFloat(tx.credit) || 0;
      const debit = parseFloat(tx.debit) || 0;
      const balance = state.selectedWalletId === 'all'
        ? (parseFloat(tx.runningBalance) || 0)
        : (parseFloat(tx.walletRunningBalance) || 0);

      const isCredit = credit > 0;
      let tagClass = isCredit ? 'tag-credit' : 'tag-debit';
      let tagLabel = isCredit ? 'Credit' : 'Debit';

      if (tx.isArchived) {
        tagClass = 'tag-archived';
        tagLabel = '📦 Archived';
      } else if (tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in') {
        tagClass = 'tag-transfer';
        tagLabel = tx.type === 'transfer_in' ? '⇄ Transfer In' : '⇄ Transfer Out';
      }

      const walletObj = window.BB_WALLETS ? window.BB_WALLETS.getWallet(tx.walletId) : null;
      const walletBadge = walletObj
        ? `<span class="wallet-badge-pill" title="Wallet: ${escapeHtml(walletObj.name)}">${escapeHtml(walletObj.icon || '👛')} ${escapeHtml(walletObj.name)}</span>`
        : (tx.archivedWalletName ? `<span class="wallet-badge-pill" title="Archived Wallet">📦 ${escapeHtml(tx.archivedWalletName)}</span>` : `<span class="wallet-badge-pill">👛 Main</span>`);

      let fxSubtext = '';
      if (tx.inputCurrency && tx.inputCurrency !== baseCurr && tx.inputAmount) {
        const sym = CURRENCIES[tx.inputCurrency]?.symbol || tx.inputCurrency;
        const rate = parseFloat(tx.exchangeRate) || 1.0;
        fxSubtext = `<span class="orig-currency-subtext">Orig: ${escapeHtml(sym)}${parseFloat(tx.inputAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} @ ${rate.toFixed(2)}</span>`;
      }

      html += `
        <tr data-id="${escapeHtml(tx.id)}" class="${tx.isArchived ? 'archived-row' : ''}">
          <td class="td-date font-mono">${escapeHtml(tx.date)}</td>
          <td class="td-wallet">${walletBadge}</td>
          <td class="td-item">
            <span class="item-badge">${escapeHtml(tx.item)}</span>
            <span class="badge-tag ${tagClass}">${tagLabel}</span>
          </td>
          <td class="td-num td-credit ${credit > 0 ? 'credit-text' : 'text-muted'}">
            ${credit > 0 ? '+' + formatCurrency(credit) : '—'}
            ${credit > 0 ? fxSubtext : ''}
          </td>
          <td class="td-num td-debit ${debit > 0 ? 'debit-text' : 'text-muted'}">
            ${debit > 0 ? '-' + formatCurrency(debit) : '—'}
            ${debit > 0 ? fxSubtext : ''}
          </td>
          <td class="td-num td-balance font-mono" style="font-weight: 600; color: ${balance >= 0 ? 'var(--text-primary)' : 'var(--debit-color)'}">
            ${formatCurrency(balance)}
          </td>
          <td class="td-notes">
            <div class="row-notes" title="${escapeHtml(tx.notes || '')}">
              ${escapeHtml(tx.notes || '—')}
            </div>
          </td>
          <td class="td-actions">
            <div class="row-actions">
              <button class="btn-icon btn-edit" title="Edit entry" onclick="window.app.openEditModal('${escapeHtml(tx.id)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" title="Delete entry" onclick="window.app.deleteTransaction('${escapeHtml(tx.id)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    if (tableBody) tableBody.innerHTML = html;
  }

  function setupLedgerListeners() {
    document.getElementById('walletFilterSelect')?.addEventListener('change', (e) => {
      if (window.BB_WALLETS) window.BB_WALLETS.selectWallet(e.target.value);
    });

    const searchInput = document.getElementById('ledgerSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (clearBtn) clearBtn.style.display = state.searchQuery ? 'block' : 'none';
        renderLedgerTable();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        clearBtn.style.display = 'none';
        renderLedgerTable();
      });
    }

    document.getElementById('typeFilterSelect')?.addEventListener('change', (e) => {
      state.typeFilter = e.target.value;
      renderLedgerTable();
    });

    document.getElementById('dateRangeFilterSelect')?.addEventListener('change', (e) => {
      state.dateFilter = e.target.value;
      renderLedgerTable();
    });

    const sortHeaders = document.querySelectorAll('#ledgerTable th[data-sort]');
    sortHeaders.forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (state.sortColumn === col) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = col;
          state.sortDirection = col === 'date' ? 'desc' : 'asc';
        }

        sortHeaders.forEach((h) => {
          const icon = h.querySelector('.sort-icon');
          if (h === th && icon) {
            icon.innerHTML = state.sortDirection === 'asc' ? '&#9650;' : '&#9660;';
            icon.style.opacity = '1';
          } else if (icon) {
            icon.innerHTML = '&#8597;';
            icon.style.opacity = '0.5';
          }
        });

        renderLedgerTable();
      });
    });
  }

  function setupAboutModalListeners() {
    const aboutModal = document.getElementById('aboutModal');
    const changelogModal = document.getElementById('changelogModal');
    const initBalModal = document.getElementById('initialBalanceModal');

    const openAbout = () => {
      if (changelogModal) changelogModal.classList.remove('active');
      if (initBalModal) initBalModal.classList.remove('active');
      if (aboutModal) aboutModal.classList.add('active');
    };

    const closeAbout = () => aboutModal?.classList.remove('active');

    const backToSettings = () => {
      closeAbout();
      closeChangelog();
      if (initBalModal) initBalModal.classList.add('active');
    };

    document.getElementById('openAboutModalBtn')?.addEventListener('click', openAbout);
    document.getElementById('closeAboutModalBtn')?.addEventListener('click', closeAbout);
    document.getElementById('closeAboutModalFooterBtn')?.addEventListener('click', closeAbout);
    document.getElementById('aboutBackToSettingsBtn')?.addEventListener('click', backToSettings);

    aboutModal?.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAbout();
    });

    const openChangelog = () => {
      closeAbout();
      if (initBalModal) initBalModal.classList.remove('active');
      if (changelogModal) changelogModal.classList.add('active');
    };

    const closeChangelog = () => changelogModal?.classList.remove('active');

    document.getElementById('aboutOpenChangelogBtn')?.addEventListener('click', openChangelog);
    document.getElementById('closeChangelogModalBtn')?.addEventListener('click', closeChangelog);
    document.getElementById('closeChangelogModalFooterBtn')?.addEventListener('click', closeChangelog);
    document.getElementById('changelogBackToSettingsBtn')?.addEventListener('click', backToSettings);

    document.getElementById('backToAboutBtn')?.addEventListener('click', () => {
      closeChangelog();
      openAbout();
    });

    changelogModal?.addEventListener('click', (e) => {
      if (e.target === changelogModal) closeChangelog();
    });
  }

  function openSettingsModal() {
    const modal = document.getElementById('initialBalanceModal');
    const nameInput = document.getElementById('settingsUserNameInput');
    const themeSelect = document.getElementById('settingsThemeSelect');
    const baseSelect = document.getElementById('baseCurrencySelect');

    if (nameInput) nameInput.value = state.settings.userName || '';
    if (themeSelect) themeSelect.value = state.theme || 'auto_date';
    if (baseSelect) baseSelect.value = state.settings.baseCurrency || 'PHP';
    if (window.BB_THEME?.updatePinSettingsUI) window.BB_THEME.updatePinSettingsUI();
    if (window.BB_WALLETS?.updateActiveSlotBadge) window.BB_WALLETS.updateActiveSlotBadge();
    updateLastSavedDisplay();
    modal?.classList.add('active');
  }

  function setupInitialBalanceListeners() {
    const modal = document.getElementById('initialBalanceModal');
    document.getElementById('openInitialBalanceBtn')?.addEventListener('click', openSettingsModal);

    const closeModal = () => modal?.classList.remove('active');
    document.getElementById('closeInitialBalanceModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelInitialBalanceBtn')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById('saveUserNameBtn')?.addEventListener('click', () => {
      const name = document.getElementById('settingsUserNameInput')?.value.trim();
      state.settings.userName = name;
      saveData();
      if (window.BB_THEME) window.BB_THEME.updateTimeGreeting();
      showToast(name ? `Hello, ${name}! Name saved.` : 'Name cleared.', 'success');
    });

    document.getElementById('settingsStartFreshBtn')?.addEventListener('click', () => {
      const reset = () => {
        closeModal();
        executeFreshStart('', 'PHP', 0);
      };
      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('start_fresh', reset);
      } else {
        reset();
      }
    });

    document.getElementById('settingsLoadSampleBtn')?.addEventListener('click', () => {
      const loadSample = () => {
        if (window.BB_REPORTS) window.BB_REPORTS.loadSampleData();
        closeModal();
      };
      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('load_sample', loadSample);
      } else {
        loadSample();
      }
    });

    document.getElementById('settingsOpenDriveModalBtn')?.addEventListener('click', () => {
      modal?.classList.remove('active');
      document.getElementById('driveModal')?.classList.add('active');
    });

    document.getElementById('settingsOpenInstallModalBtn')?.addEventListener('click', () => {
      modal?.classList.remove('active');
      document.getElementById('installModal')?.classList.add('active');
    });

    document.getElementById('settingsOpenSaveVaultBtn')?.addEventListener('click', () => {
      modal?.classList.remove('active');
      if (window.BB_WALLETS) window.BB_WALLETS.renderSaveSlotsGrid();
      document.getElementById('saveVaultModal')?.classList.add('active');
    });

    document.getElementById('settingsQuickSnapshotBtn')?.addEventListener('click', () => {
      if (window.BB_WALLETS) window.BB_WALLETS.createQuickSnapshot();
    });

    document.getElementById('settingsOpenAboutModalBtn')?.addEventListener('click', () => {
      modal?.classList.remove('active');
      document.getElementById('aboutModal')?.classList.add('active');
    });

    document.getElementById('settingsOpenChangelogBtn')?.addEventListener('click', () => {
      modal?.classList.remove('active');
      document.getElementById('changelogModal')?.classList.add('active');
    });

    document.getElementById('initialBalanceForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newBaseCurrency = document.getElementById('baseCurrencySelect')?.value;
      state.settings.baseCurrency = newBaseCurrency;
      const txCurrSelect = document.getElementById('txCurrencySelect');
      if (txCurrSelect) txCurrSelect.value = newBaseCurrency;
      updateFxRateAndConversion();
      if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
      showToast(`Base currency set to ${newBaseCurrency} (${CURRENCIES[newBaseCurrency]?.symbol || ''})`, 'success');
    });

    document.getElementById('settingsExportCsvBtn')?.addEventListener('click', () => window.BB_REPORTS?.exportLedgerCsv());
    document.getElementById('settingsCopySheetsBtn')?.addEventListener('click', () => window.BB_REPORTS?.copyForGoogleSheets());
  }

  function setupDriveListeners() {
    const driveModal = document.getElementById('driveModal');
    const closeDrive = () => driveModal?.classList.remove('active');
    document.getElementById('closeDriveModalBtn')?.addEventListener('click', closeDrive);
    document.getElementById('closeDriveModalFooterBtn')?.addEventListener('click', closeDrive);
    driveModal?.addEventListener('click', (e) => {
      if (e.target === driveModal) closeDrive();
    });

    document.getElementById('saveToDriveBtn')?.addEventListener('click', () => {
      if (window.BB_REPORTS) window.BB_REPORTS.exportLedgerJson('Bantay_Barya_MultiWallet_DriveBackup');
      showToast('Multi-wallet backup file generated! Save it into your Google Drive.', 'success');
    });

    const driveInput = document.getElementById('loadFromDriveInput');
    if (driveInput) driveInput.addEventListener('change', (e) => window.BB_REPORTS?.handleFileImport(e));
  }

  function setupEditModalListeners() {
    const editModal = document.getElementById('editTransactionModal');
    const closeModal = () => editModal?.classList.remove('active');
    document.getElementById('closeEditModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelEditBtn')?.addEventListener('click', closeModal);
    editModal?.addEventListener('click', (e) => {
      if (e.target === editModal) closeModal();
    });

    document.getElementById('editTypeDebit')?.addEventListener('change', () => {
      const lbl = document.getElementById('editAmountLabel');
      if (lbl) lbl.textContent = 'Debit Amount *';
    });

    document.getElementById('editTypeCredit')?.addEventListener('change', () => {
      const lbl = document.getElementById('editAmountLabel');
      if (lbl) lbl.textContent = 'Credit Amount *';
    });

    const updateEditFxPreview = async () => {
      const inputCurrency = document.getElementById('editTxCurrencySelect')?.value || 'PHP';
      const baseCurrency = state.settings.baseCurrency || 'PHP';
      const date = document.getElementById('editTxDate')?.value;
      const amount = parseFloat(document.getElementById('editTxAmount')?.value) || 0;

      const sym = CURRENCIES[inputCurrency]?.symbol || inputCurrency;
      const pfx = document.getElementById('editAmountPrefix');
      if (pfx) pfx.textContent = sym;

      const banner = document.getElementById('editFxRateBanner');
      if (inputCurrency === baseCurrency) {
        if (banner) banner.style.display = 'none';
        return;
      }

      if (banner) banner.style.display = 'block';
      const rate = window.BB_WALLETS
        ? await window.BB_WALLETS.fetchExchangeRate(inputCurrency, baseCurrency, date)
        : 1.0;
      const text = document.getElementById('editFxRateText');
      const conv = document.getElementById('editFxConvertedDisplay');
      if (text) text.textContent = `Live FX Rate (${date}): 1 ${inputCurrency} = ${rate.toFixed(2)} ${baseCurrency}`;
      if (conv) conv.textContent = formatCurrency(amount * rate);
    };

    document.getElementById('editTxCurrencySelect')?.addEventListener('change', updateEditFxPreview);
    document.getElementById('editTxDate')?.addEventListener('change', updateEditFxPreview);
    document.getElementById('editTxAmount')?.addEventListener('input', updateEditFxPreview);

    document.getElementById('editTransactionForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editTxId').value;
      const targetIndex = state.transactions.findIndex(tx => tx.id === id);
      if (targetIndex === -1) return;

      const walletId = document.getElementById('editTxWalletSelect').value || state.wallets[0]?.id;
      const date = document.getElementById('editTxDate').value;
      const item = document.getElementById('editTxItem').value.trim();
      const inputCurrency = document.getElementById('editTxCurrencySelect').value;
      const inputAmount = parseFloat(document.getElementById('editTxAmount').value);
      const isCredit = document.getElementById('editTypeCredit').checked;
      const notes = document.getElementById('editTxNotes').value.trim();

      if (!walletId || !date || !item || isNaN(inputAmount) || inputAmount <= 0) {
        showToast('Please provide valid details.', 'error');
        return;
      }

      if (!state.categories.includes(item)) {
        state.categories.push(item);
        updateCategoryDatalists();
      }

      const baseCurrency = state.settings.baseCurrency || 'PHP';
      const rate = inputCurrency === baseCurrency
        ? 1.0
        : (window.BB_WALLETS ? await window.BB_WALLETS.fetchExchangeRate(inputCurrency, baseCurrency, date) : 1.0);

      const baseAmount = Math.round((inputAmount * rate) * 100) / 100;

      state.transactions[targetIndex].walletId = walletId;
      state.transactions[targetIndex].date = date;
      state.transactions[targetIndex].item = item;
      state.transactions[targetIndex].type = isCredit ? 'credit' : 'debit';
      state.transactions[targetIndex].inputCurrency = inputCurrency;
      state.transactions[targetIndex].inputAmount = inputAmount;
      state.transactions[targetIndex].exchangeRate = rate;
      state.transactions[targetIndex].credit = isCredit ? baseAmount : 0;
      state.transactions[targetIndex].debit = isCredit ? 0 : baseAmount;
      state.transactions[targetIndex].notes = notes;

      if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
      closeModal();
      showToast(`Transaction "${item}" updated!`, 'success');
    });
  }

  function openEditModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    if (window.BB_WALLETS) window.BB_WALLETS.populateWalletDropdowns();

    document.getElementById('editTxId').value = tx.id;
    document.getElementById('editTxWalletSelect').value = tx.walletId || state.wallets[0]?.id;
    document.getElementById('editTxDate').value = tx.date;
    document.getElementById('editTxItem').value = tx.item;
    document.getElementById('editTxNotes').value = tx.notes || '';

    const inputCurrency = tx.inputCurrency || state.settings.baseCurrency || 'PHP';
    document.getElementById('editTxCurrencySelect').value = inputCurrency;
    const pfx = document.getElementById('editAmountPrefix');
    if (pfx) pfx.textContent = CURRENCIES[inputCurrency]?.symbol || inputCurrency;

    const isCredit = (parseFloat(tx.credit) || 0) > 0;
    const amountVal = tx.inputAmount ? tx.inputAmount : (isCredit ? tx.credit : tx.debit);

    if (isCredit) {
      document.getElementById('editTypeCredit').checked = true;
      document.getElementById('editTxAmount').value = parseFloat(amountVal).toFixed(2);
      const lbl = document.getElementById('editAmountLabel');
      if (lbl) lbl.textContent = 'Credit Amount *';
    } else {
      document.getElementById('editTypeDebit').checked = true;
      document.getElementById('editTxAmount').value = parseFloat(amountVal).toFixed(2);
      const lbl = document.getElementById('editAmountLabel');
      if (lbl) lbl.textContent = 'Debit Amount *';
    }

    const banner = document.getElementById('editFxRateBanner');
    if (inputCurrency !== state.settings.baseCurrency) {
      if (banner) banner.style.display = 'block';
      const rate = parseFloat(tx.exchangeRate) || 1.0;
      const text = document.getElementById('editFxRateText');
      const conv = document.getElementById('editFxConvertedDisplay');
      if (text) text.textContent = `Exchange Rate: 1 ${inputCurrency} = ${rate.toFixed(2)} ${state.settings.baseCurrency}`;
      if (conv) conv.textContent = formatCurrency((isCredit ? tx.credit : tx.debit));
    } else {
      if (banner) banner.style.display = 'none';
    }

    document.getElementById('editTransactionModal')?.classList.add('active');
  }

  function deleteTransaction(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    if (confirm(`Delete transaction "${tx.item}" on ${tx.date}?`)) {
      state.transactions = state.transactions.filter(t => t.id !== id);
      if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
      showToast('Transaction removed from continuous ledger.', 'info');
    }
  }

  function promptRenameCategory(oldName) {
    const newName = prompt(`Enter new name for category "${oldName}":`, oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
      renameCategory(oldName, newName.trim());
    }
  }

  function hasActiveSavedLedger() {
    const hasTx = Boolean(state.transactions && state.transactions.length > 0);
    const hasWalletsWithBalance = Boolean(state.wallets && state.wallets.some(w => {
      const init = Math.abs(parseFloat(w.initialBalance) || 0);
      const curr = Math.abs(parseFloat(w.currentBalance) || 0);
      return init > 0.001 || curr > 0.001;
    }));
    const hasMultipleWallets = Boolean(state.wallets && state.wallets.length > 1);
    const hasDebts = Boolean(state.debts && state.debts.length > 0);
    const hasBills = Boolean(state.bills && state.bills.length > 0);
    const hasMultipleSlots = Boolean(state.saveSlots && state.saveSlots.length > 1);

    return Boolean(hasTx || hasWalletsWithBalance || hasMultipleWallets || hasDebts || hasBills || hasMultipleSlots);
  }

  function getLastSavedLedgerSummary() {
    const activeSlot = (state.saveSlots && state.saveSlots.find(s => s.id === state.activeSlotId)) || state.saveSlots?.[0];
    const name = activeSlot?.name || 'Primary Ledger';
    const icon = activeSlot?.icon || '🌟';
    const desc = activeSlot?.description || 'Main continuous multi-wallet personal finance ledger';
    const baseCurr = state.settings?.baseCurrency || 'PHP';

    let totalBal = 0;
    if (window.BB_WALLETS) {
      totalBal = window.BB_WALLETS.getTotalCombinedBalance();
    } else if (state.wallets && state.wallets.length > 0) {
      state.wallets.forEach(w => {
        const bal = w.currentBalance !== undefined ? (parseFloat(w.currentBalance) || 0) : (parseFloat(w.initialBalance) || 0);
        totalBal += bal;
      });
    }

    const walletCount = state.wallets ? state.wallets.length : 0;
    const txCount = state.transactions ? state.transactions.length : 0;
    const hasData = hasActiveSavedLedger();
    const savedTime = lastSavedTimestamp || activeSlot?.updatedAt || Date.now();

    return {
      name,
      icon,
      desc,
      baseCurrency: baseCurr,
      totalBalance: totalBal,
      walletCount,
      txCount,
      hasData,
      lastSaved: savedTime
    };
  }

  function getRelativeTimeString(ts) {
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 15) return 'Saved just now';
    if (diffSec < 60) return `Saved ${diffSec}s ago`;
    if (diffSec < 3600) return `Saved ${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `Saved ${Math.floor(diffSec / 3600)}h ago`;
    return `Saved on ${new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  function updateWelcomeSavedLedgerDisplay() {
    const summary = getLastSavedLedgerSummary();
    const pill = document.getElementById('welcomeSavedStatusPill');
    const pillText = document.getElementById('welcomeSavedStatusText');
    const timeDisplay = document.getElementById('welcomeSavedTimeDisplay');
    const iconEl = document.getElementById('welcomeSavedIcon');
    const nameEl = document.getElementById('welcomeSavedName');
    const descEl = document.getElementById('welcomeSavedDesc');
    const balanceEl = document.getElementById('welcomeSavedBalance');
    const walletsCountEl = document.getElementById('welcomeSavedWalletsCount');
    const txCountEl = document.getElementById('welcomeSavedTxCount');
    const loadBtn = document.getElementById('welcomeLoadSavedBtn');

    if (iconEl) iconEl.textContent = summary.icon;
    if (nameEl) nameEl.textContent = summary.name;
    if (descEl) descEl.textContent = summary.desc;

    if (summary.hasData) {
      if (pill) pill.className = 'welcome-saved-pill';
      if (pillText) pillText.textContent = 'Active Saved Ledger';
      if (timeDisplay) timeDisplay.textContent = `Last saved: ${getRelativeTimeString(summary.lastSaved)} (${formatDateTime(summary.lastSaved)})`;
      if (balanceEl) balanceEl.textContent = formatCurrency(summary.totalBalance, summary.baseCurrency);
      if (walletsCountEl) walletsCountEl.textContent = `${summary.walletCount} ${summary.walletCount === 1 ? 'Wallet' : 'Wallets'}`;
      if (txCountEl) txCountEl.textContent = `${summary.txCount} ${summary.txCount === 1 ? 'Entry' : 'Entries'}`;
      if (loadBtn) {
        loadBtn.innerHTML = `<span>▶️ Load Latest Saved Ledger (${formatCurrency(summary.totalBalance, summary.baseCurrency)})</span>`;
      }
    } else {
      if (pill) pill.className = 'welcome-saved-pill empty';
      if (pillText) pillText.textContent = 'No Saved Ledger Data Yet';
      if (timeDisplay) timeDisplay.textContent = 'No prior saved ledger found';
      if (balanceEl) balanceEl.textContent = formatCurrency(0, summary.baseCurrency);
      if (walletsCountEl) walletsCountEl.textContent = '1 Wallet';
      if (txCountEl) txCountEl.textContent = '0 Entries';
      if (loadBtn) {
        loadBtn.innerHTML = `<span>▶️ Open Empty Ledger</span>`;
      }
    }
  }

  function openOverwriteWarningModal(actionName, onConfirmCallback) {
    const modal = document.getElementById('overwriteWarningModal');
    if (!modal) {
      if (onConfirmCallback) onConfirmCallback();
      return;
    }

    const summary = getLastSavedLedgerSummary();
    const msgEl = document.getElementById('overwriteWarningMessage');
    const timeEl = document.getElementById('overwriteCurrentSavedTime');
    const nameEl = document.getElementById('overwriteCurrentName');
    const balEl = document.getElementById('overwriteCurrentBalance');
    const walletsEl = document.getElementById('overwriteCurrentWallets');
    const entriesEl = document.getElementById('overwriteCurrentEntries');
    const confirmBtn = document.getElementById('confirmOverwriteProceedBtn');

    if (msgEl) {
      let actionDesc = 'proceed with this action';
      if (actionName === 'start_fresh') actionDesc = 'start a fresh clean ledger';
      else if (actionName === 'load_sample') actionDesc = 'load sample demo data';
      else if (actionName === 'restore_backup') actionDesc = 'restore a backup file';
      msgEl.innerHTML = `You have an <strong>active saved ledger</strong> with <strong>${summary.txCount} transactions</strong> across <strong>${summary.walletCount} wallets</strong> (Total: <strong>${formatCurrency(summary.totalBalance, summary.baseCurrency)}</strong>). If you ${actionDesc}, your existing ledger will be overwritten and replaced.`;
    }

    if (timeEl) timeEl.textContent = `Last saved: ${getRelativeTimeString(summary.lastSaved)} (${formatDateTime(summary.lastSaved)})`;
    if (nameEl) nameEl.textContent = summary.name;
    if (balEl) balEl.textContent = formatCurrency(summary.totalBalance, summary.baseCurrency);
    if (walletsEl) walletsEl.textContent = `${summary.walletCount} ${summary.walletCount === 1 ? 'Wallet' : 'Wallets'}`;
    if (entriesEl) entriesEl.textContent = `${summary.txCount} ${summary.txCount === 1 ? 'Entry' : 'Entries'}`;

    if (confirmBtn) {
      let btnLabel = 'Proceed & Overwrite';
      if (actionName === 'start_fresh') btnLabel = '⚠️ Reset & Start Fresh';
      else if (actionName === 'load_sample') btnLabel = '⚠️ Overwrite & Load Demo';
      else if (actionName === 'restore_backup') btnLabel = '⚠️ Overwrite & Restore Backup';
      confirmBtn.innerHTML = `<span>${btnLabel}</span>`;
    }

    pendingOverwriteCallback = onConfirmCallback;
    modal.classList.add('active');
  }

  function setupOverwriteWarningListeners() {
    const modal = document.getElementById('overwriteWarningModal');
    const closeBtn = document.getElementById('closeOverwriteWarningBtn');
    const cancelBtn = document.getElementById('cancelOverwriteWarningBtn');
    const confirmBtn = document.getElementById('confirmOverwriteProceedBtn');
    const backupFirstBtn = document.getElementById('overwriteBackupFirstBtn');

    const closeWarning = () => {
      pendingOverwriteCallback = null;
      modal?.classList.remove('active');
    };

    closeBtn?.addEventListener('click', closeWarning);
    cancelBtn?.addEventListener('click', closeWarning);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeWarning();
    });

    backupFirstBtn?.addEventListener('click', () => {
      if (window.BB_WALLETS) {
        window.BB_WALLETS.exportActiveSaveSlotAsBarya();
      } else if (window.BB_REPORTS) {
        window.BB_REPORTS.exportLedgerJson();
      }
      showToast('Downloaded .barya backup file! Your data is safe.', 'success');
    });

    confirmBtn?.addEventListener('click', () => {
      const cb = pendingOverwriteCallback;
      closeWarning();
      if (typeof cb === 'function') {
        cb();
      }
    });
  }

  function executeFreshStart(name, newCurr, newBal) {
    const welcomeModal = document.getElementById('welcomeModal');
    state.settings.userName = name;
    state.settings.baseCurrency = newCurr;

    state.transactions = [];
    state.bills = [];
    state.debts = [];

    state.wallets = [
      {
        id: 'wallet_default',
        name: 'Personal Spending',
        type: 'spending',
        currency: newCurr,
        icon: '👛',
        initialBalance: newBal,
        createdAt: Date.now()
      }
    ];

    state.selectedWalletId = 'all';

    const baseSelect = document.getElementById('baseCurrencySelect');
    const txSelect = document.getElementById('txCurrencySelect');
    const nameInput = document.getElementById('settingsUserNameInput');

    if (baseSelect) baseSelect.value = newCurr;
    if (txSelect) txSelect.value = newCurr;
    if (nameInput) nameInput.value = name;

    saveWelcomePreference();
    saveData();
    if (window.BB_WALLETS) {
      window.BB_WALLETS.syncActiveSlotPayload();
      window.BB_WALLETS.populateWalletDropdowns();
      window.BB_WALLETS.renderWalletsBar();
      window.BB_WALLETS.recalculateLedgerBalances();
      window.BB_WALLETS.updateActiveSlotBadge();
      window.BB_WALLETS.renderSaveSlotsGrid();
    }
    if (window.BB_THEME) window.BB_THEME.updateTimeGreeting();
    if (window.BB_BILLS) {
      window.BB_BILLS.checkBillDueNotifications();
      window.BB_BILLS.renderBillsTable();
    }
    if (window.BB_DEBTS) {
      window.BB_DEBTS.renderDebtsTable();
    }
    welcomeModal?.classList.remove('active');
    showToast(`Welcome ${name ? name : 'to Bantay Barya'}! Initialized clean multi-wallet with ${formatCurrency(newBal)}.`, 'success');
  }

  function setupWelcomeModalListeners() {
    const welcomeModal = document.getElementById('welcomeModal');

    document.getElementById('welcomeCurrencySelect')?.addEventListener('change', (e) => {
      const sym = CURRENCIES[e.target.value]?.symbol || '₱';
      const pfx = document.getElementById('welcomePrefix');
      if (pfx) pfx.textContent = sym;
    });

    document.getElementById('welcomeLoadSavedBtn')?.addEventListener('click', () => {
      const summary = getLastSavedLedgerSummary();
      saveWelcomePreference();
      welcomeModal?.classList.remove('active');
      if (summary.hasData) {
        showToast(`Loaded latest saved ledger: ${summary.name} (Total: ${formatCurrency(summary.totalBalance, summary.baseCurrency)})`, 'success');
      } else {
        showToast('Opened ledger. Start by recording a transaction or creating a wallet!', 'info');
      }
    });

    document.getElementById('welcomeFreshForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('welcomeNameInput')?.value.trim();
      const newCurr = document.getElementById('welcomeCurrencySelect')?.value || 'PHP';
      const newBal = parseFloat(document.getElementById('welcomeInitialBalance')?.value) || 0;

      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('start_fresh', () => executeFreshStart(name, newCurr, newBal));
      } else {
        executeFreshStart(name, newCurr, newBal);
      }
    });

    document.getElementById('welcomeLoadSampleBtn')?.addEventListener('click', () => {
      const loadSample = () => {
        if (window.BB_REPORTS) window.BB_REPORTS.loadSampleData();
        saveWelcomePreference();
        welcomeModal?.classList.remove('active');
      };

      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('load_sample', loadSample);
      } else {
        loadSample();
      }
    });

    document.getElementById('welcomeImportInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const doImport = () => {
        if (window.BB_REPORTS) window.BB_REPORTS.handleFileImport({ target: { files: [file] } }, true);
        saveWelcomePreference();
        welcomeModal?.classList.remove('active');
      };

      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('restore_backup', doImport);
      } else {
        doImport();
      }
    });

    document.getElementById('welcomeOpenDriveGuideBtn')?.addEventListener('click', () => {
      welcomeModal?.classList.remove('active');
      document.getElementById('driveModal')?.classList.add('active');
    });

    const closeWelcome = () => {
      saveWelcomePreference();
      welcomeModal?.classList.remove('active');
    };

    document.getElementById('closeWelcomeModalBtn')?.addEventListener('click', closeWelcome);
    document.getElementById('welcomeDoneBtn')?.addEventListener('click', closeWelcome);
    welcomeModal?.addEventListener('click', (e) => {
      if (e.target === welcomeModal) closeWelcome();
    });

    document.getElementById('emptyLoadSampleBtn')?.addEventListener('click', () => {
      if (hasActiveSavedLedger()) {
        openOverwriteWarningModal('load_sample', () => {
          if (window.BB_REPORTS) window.BB_REPORTS.loadSampleData();
        });
      } else {
        if (window.BB_REPORTS) window.BB_REPORTS.loadSampleData();
      }
    });

    document.getElementById('emptyLoadBackupBtn')?.addEventListener('click', () => {
      updateWelcomeSavedLedgerDisplay();
      welcomeModal?.classList.add('active');
    });
    document.getElementById('emptySetBalanceBtn')?.addEventListener('click', () => document.getElementById('walletsModal')?.classList.add('active'));
  }

  function initWelcomeModal() {
    const welcomeModal = document.getElementById('welcomeModal');
    const rawDontShow = window.BB_STORAGE ? window.BB_STORAGE.getItemSync(STORAGE_KEY_DONT_SHOW_WELCOME) : (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_DONT_SHOW_WELCOME) : null);
    const dontShow = rawDontShow === 'true';

    updateWelcomeSavedLedgerDisplay();

    if (!dontShow && welcomeModal && !state._isVaultLocked) {
      updateWelcomeSavedLedgerDisplay();
      welcomeModal.classList.add('active');
    }
  }

  function saveWelcomePreference() {
    const isChecked = document.getElementById('dontShowWelcomeCheckbox')?.checked;
    if (isChecked) {
      if (window.BB_STORAGE) window.BB_STORAGE.setItemSync(STORAGE_KEY_DONT_SHOW_WELCOME, 'true');
      else if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY_DONT_SHOW_WELCOME, 'true');
    } else {
      if (window.BB_STORAGE) window.BB_STORAGE.removeItemSync(STORAGE_KEY_DONT_SHOW_WELCOME);
      else if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY_DONT_SHOW_WELCOME);
    }
  }

  function updateLastSavedDisplay() {
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - lastSavedTimestamp) / 1000));

    let relativeText = 'Saved just now';
    if (diffSec < 15) relativeText = 'Saved just now';
    else if (diffSec < 60) relativeText = `Saved ${diffSec}s ago`;
    else if (diffSec < 3600) relativeText = `Saved ${Math.floor(diffSec / 60)}m ago`;
    else relativeText = `Saved ${Math.floor(diffSec / 3600)}h ago`;

    const fullTimeStr = new Date(lastSavedTimestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const headerSavedDisplay = document.getElementById('headerLastSavedDisplay');
    const headerAutoSaveBtn = document.getElementById('headerAutoSaveBtn');
    const vaultLastSaved = document.getElementById('vaultLastSavedText');
    const vaultBadge = document.getElementById('vaultAutoSaveBadge');
    const settingsLastSaved = document.getElementById('settingsLastSavedDisplay');

    if (headerSavedDisplay) headerSavedDisplay.textContent = relativeText;
    if (headerAutoSaveBtn) headerAutoSaveBtn.title = `Last saved at ${fullTimeStr} (Auto-saves every 5 minutes). Click to save now!`;
    if (vaultLastSaved) vaultLastSaved.textContent = `Auto-saved: ${relativeText}`;
    if (vaultBadge) vaultBadge.title = `Last saved at ${fullTimeStr} • Auto-saves every 5 minutes`;
    if (settingsLastSaved) settingsLastSaved.textContent = `${relativeText} (${fullTimeStr})`;
  }

  function triggerAutoSave(silent = true) {
    const dot = document.getElementById('headerAutoSaveDot');
    if (dot) dot.classList.add('saving');

    saveData();

    setTimeout(() => {
      if (dot) dot.classList.remove('saving');
    }, 600);

    if (!silent) showToast('Saved state successfully!', 'success');
  }

  function initAutoSaveEngine() {
    stopAutoSaveEngine();

    autoSaveTimer = setInterval(() => triggerAutoSave(true), 5 * 60 * 1000);

    relativeTimeTimer = setInterval(() => {
      updateLastSavedDisplay();
      if (document.getElementById('welcomeModal')?.classList.contains('active')) {
        updateWelcomeSavedLedgerDisplay();
      }
    }, 10000);

    updateLastSavedDisplay();
  }

  function stopAutoSaveEngine() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (relativeTimeTimer) {
      clearInterval(relativeTimeTimer);
      relativeTimeTimer = null;
    }
  }

  async function saveData() {
    if (state._isVaultLocked) {
      return;
    }

    if (window.BB_WALLETS) window.BB_WALLETS.syncActiveSlotPayload();
    lastSavedTimestamp = Date.now();

    const currentPayload = {
      wallets: state.wallets,
      debts: state.debts,
      bills: state.bills,
      transactions: state.transactions,
      settings: state.settings,
      categories: state.categories,
      saveSlots: state.saveSlots,
      activeSlotId: state.activeSlotId
    };

    const isEncrypted = window.BB_STORAGE ? (await window.BB_STORAGE.hasEncryptedVaultAsync()) : false;
    if ((isEncrypted || state._vaultDerivedKey) && window.BB_CRYPTO && state._vaultDerivedKey) {
      try {
        const envelope = await window.BB_CRYPTO.encryptPayload(currentPayload, state._vaultDerivedKey, {
          saltBytes: state._vaultSaltBytes,
          iterations: state._vaultIterations
        });
        await window.BB_STORAGE.setItem(STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(envelope));
        await window.BB_STORAGE.setItem(STORAGE_KEY_LAST_SAVED, lastSavedTimestamp.toString());
        await window.BB_STORAGE.clearPlaintextLedger();
      } catch (err) {
        console.error('Error saving encrypted vault:', err);
      }
    } else {
      const batch = {
        [STORAGE_KEY_SAVE_SLOTS]: JSON.stringify(state.saveSlots),
        [STORAGE_KEY_ACTIVE_SLOT_ID]: state.activeSlotId,
        [STORAGE_KEY_WALLETS]: JSON.stringify(state.wallets),
        [STORAGE_KEY_DEBTS]: JSON.stringify(state.debts),
        [STORAGE_KEY_BILLS]: JSON.stringify(state.bills),
        [STORAGE_KEY_TRANSACTIONS]: JSON.stringify(state.transactions),
        [STORAGE_KEY_SETTINGS]: JSON.stringify(state.settings),
        [STORAGE_KEY_CATEGORIES]: JSON.stringify(state.categories),
        [STORAGE_KEY_LAST_SAVED]: lastSavedTimestamp.toString()
      };
      if (window.BB_STORAGE) {
        await window.BB_STORAGE.setBatch(batch);
      } else {
        for (const k of Object.keys(batch)) localStorage.setItem(k, batch[k]);
      }
    }

    updateLastSavedDisplay();
    updateWelcomeSavedLedgerDisplay();
  }

  async function loadPlaintextDataDirectlyAsync() {
    const storageAdapter = window.BB_STORAGE;
    const getItem = async (k) => storageAdapter ? (await storageAdapter.getItem(k)) : (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null);

    const savedSlots = await getItem(STORAGE_KEY_SAVE_SLOTS);
    const savedActiveSlotId = await getItem(STORAGE_KEY_ACTIVE_SLOT_ID);
    const savedWallets = await getItem(STORAGE_KEY_WALLETS);
    const savedDebts = await getItem(STORAGE_KEY_DEBTS);
    const savedBills = await getItem(STORAGE_KEY_BILLS);
    const savedTx = (await getItem(STORAGE_KEY_TRANSACTIONS)) || (await getItem(LEGACY_KEY_TRANSACTIONS_V6));
    const savedSet = (await getItem(STORAGE_KEY_SETTINGS)) || (await getItem(LEGACY_KEY_SETTINGS_V6));
    const savedCats = (await getItem(STORAGE_KEY_CATEGORIES)) || (await getItem(LEGACY_KEY_CATEGORIES_V6));
    const savedLastTime = await getItem(STORAGE_KEY_LAST_SAVED);

    if (savedLastTime) {
      lastSavedTimestamp = parseInt(savedLastTime, 10) || Date.now();
    }

    if (savedSet) {
      try {
        state.settings = typeof savedSet === 'string' ? JSON.parse(savedSet) : savedSet;
      } catch (e) {
        state.settings = { userName: '', baseCurrency: 'PHP' };
      }
      if (!state.settings.userName) state.settings.userName = '';
    } else {
      state.settings = { userName: '', baseCurrency: 'PHP' };
    }

    if (savedWallets) {
      try {
        state.wallets = typeof savedWallets === 'string' ? JSON.parse(savedWallets) : savedWallets;
      } catch (e) {
        state.wallets = [...DEFAULT_WALLETS];
      }
    } else {
      const legacyInitialBal = savedSet ? (parseFloat(typeof savedSet === 'string' ? JSON.parse(savedSet).initialBalance : savedSet.initialBalance) || 0) : 0;
      state.wallets = [
        {
          id: 'wallet_default',
          name: 'Personal Spending',
          type: 'spending',
          icon: '👛',
          initialBalance: legacyInitialBal,
          createdAt: 1
        }
      ];
    }

    if (savedDebts) {
      try {
        state.debts = typeof savedDebts === 'string' ? JSON.parse(savedDebts) : savedDebts;
      } catch (err) {
        state.debts = [];
      }
    } else {
      state.debts = [];
    }

    if (savedBills) {
      try {
        state.bills = typeof savedBills === 'string' ? JSON.parse(savedBills) : savedBills;
      } catch (err) {
        state.bills = [];
      }
    } else {
      state.bills = [];
    }

    if (savedCats) {
      try {
        state.categories = typeof savedCats === 'string' ? JSON.parse(savedCats) : savedCats;
      } catch (e) {
        state.categories = [...DEFAULT_CATEGORIES];
      }
      if (!state.categories.includes('Balance Brought Forward')) {
        state.categories.unshift('Balance Brought Forward');
      }
      if (!state.categories.includes('Balance Reconciliation')) {
        state.categories.splice(1, 0, 'Balance Reconciliation');
      }
    } else {
      state.categories = [...DEFAULT_CATEGORIES];
    }

    if (savedTx) {
      try {
        state.transactions = typeof savedTx === 'string' ? JSON.parse(savedTx) : savedTx;
      } catch (e) {
        state.transactions = [];
      }
      state.transactions.forEach(t => {
        if (!t.walletId) t.walletId = state.wallets[0]?.id || 'wallet_default';
      });
    } else {
      state.transactions = [];
    }

    if (savedSlots) {
      try {
        state.saveSlots = typeof savedSlots === 'string' ? JSON.parse(savedSlots) : savedSlots;
      } catch (e) {
        state.saveSlots = [];
      }
      state.activeSlotId = savedActiveSlotId || state.saveSlots[0]?.id || 'slot_primary';
    } else if (window.BB_WALLETS) {
      window.BB_WALLETS.initSaveVaultEngine();
    }
  }

  async function loadData() {
    try {
      const storageAdapter = window.BB_STORAGE;
      const isEncrypted = storageAdapter ? (await storageAdapter.hasEncryptedVaultAsync()) : false;
      const hasLegacyPin = storageAdapter ? (await storageAdapter.hasLegacyPlaintextPinAsync()) : false;

      if (isEncrypted || hasLegacyPin) {
        state._isVaultLocked = true;
        stopAutoSaveEngine();
        return;
      }

      state._isVaultLocked = false;
      await loadPlaintextDataDirectlyAsync();
    } catch (e) {
      console.error('Error loading Bantay Barya multi-wallet data:', e);
      state.wallets = [...DEFAULT_WALLETS];
      state.debts = [];
      state.bills = [];
      state.transactions = [];
      state.categories = [...DEFAULT_CATEGORIES];
      if (window.BB_WALLETS) window.BB_WALLETS.initSaveVaultEngine();
    }
  }

  function initializeUnlockedApplication() {
    if (window.BB_THEME) {
      window.BB_THEME.initThemeEngine?.();
      window.BB_THEME.updatePinSettingsUI?.();
      window.BB_THEME.updateTimeGreeting?.();
      window.BB_THEME.renderAllHeroCharts?.();
    }
    if (window.BB_WALLETS) {
      window.BB_WALLETS.initSaveVaultEngine?.();
      window.BB_WALLETS.populateWalletDropdowns?.();
      window.BB_WALLETS.renderWalletsBar?.();
      window.BB_WALLETS.renderManageWalletsTable?.();
      window.BB_WALLETS.recalculateLedgerBalances?.();
      window.BB_WALLETS.updateSpendingBufferDisplay?.();
    }
    if (window.BB_DEBTS) {
      window.BB_DEBTS.renderDebtsTable?.();
    }
    if (window.BB_BILLS) {
      window.BB_BILLS.checkBillDueNotifications?.();
      window.BB_BILLS.renderBillsTable?.();
    }
    updateCategoryDatalists();
    renderLedgerTable();
    updateKPIs();
    updateProjectedBalance();
    updateWelcomeSavedLedgerDisplay();
    updateLastSavedDisplay();
    updateFxRateAndConversion();
    initWelcomeModal();

    initAutoSaveEngine();
  }

  function refreshAppAfterUnlock() {
    initializeUnlockedApplication();
  }

  async function unlockAppWithPin(pin) {
    const storageAdapter = window.BB_STORAGE;
    const cryptoMod = window.BB_CRYPTO;
    const validatorMod = window.BB_VALIDATOR;

    if (!cryptoMod) throw new Error('Crypto module not available.');

    const isEncrypted = storageAdapter ? (await storageAdapter.hasEncryptedVaultAsync()) : false;
    const hasLegacyPin = storageAdapter ? (await storageAdapter.hasLegacyPlaintextPinAsync()) : false;

    if (isEncrypted) {
      let rawEnvelope = await storageAdapter.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
      let isLegacyKey = false;
      if (!rawEnvelope) {
        rawEnvelope = await storageAdapter.getItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
        isLegacyKey = true;
      }
      const envelope = typeof rawEnvelope === 'string' ? JSON.parse(rawEnvelope) : rawEnvelope;

      let saltBytes;
      if (typeof atob === 'function') {
        const bin = atob(envelope.kdf.salt);
        saltBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) saltBytes[i] = bin.charCodeAt(i);
      } else {
        saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
      }

      const derivedKey = await cryptoMod.deriveKeyFromPin(pin, saltBytes, envelope.kdf.iterations);
      const decrypted = await cryptoMod.decryptPayload(envelope, derivedKey);

      // If unlocked from legacy key, migrate to canonical key
      if (isLegacyKey) {
        await storageAdapter.setItem(STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(envelope));
        await storageAdapter.removeItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      }

      const validated = validatorMod ? validatorMod.validateAndNormalizeLedger(decrypted) : decrypted;

      state.wallets = validated.wallets;
      state.transactions = validated.transactions;
      state.debts = validated.debts;
      state.bills = validated.bills;
      state.categories = validated.categories;
      state.settings = validated.settings;
      state.saveSlots = validated.saveSlots;
      state.activeSlotId = validated.activeSlotId || state.saveSlots[0]?.id || 'slot_primary';

      state._vaultDerivedKey = derivedKey;
      state._vaultSaltBytes = saltBytes;
      state._vaultIterations = envelope.kdf.iterations;
      state._isVaultLocked = false;

      await storageAdapter.clearPlaintextLedger();
      refreshAppAfterUnlock();
      return true;
    } else if (hasLegacyPin) {
      const legacyPin = await storageAdapter.getLegacyPlaintextPinAsync();
      if (pin !== legacyPin) {
        throw new Error('Incorrect PIN.');
      }

      // Recoverable Write-Read-Decrypt-Promote-Delete Protocol
      await loadPlaintextDataDirectlyAsync();

      const currentPayload = {
        wallets: state.wallets,
        debts: state.debts,
        bills: state.bills,
        transactions: state.transactions,
        settings: state.settings,
        categories: state.categories,
        saveSlots: state.saveSlots,
        activeSlotId: state.activeSlotId
      };

      // 1. Write staged envelope
      const stagedEnvelope = await cryptoMod.encryptPayload(currentPayload, pin);
      await storageAdapter.setItem(STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(stagedEnvelope));

      // 2. Read back from staging
      const readBackRaw = await storageAdapter.getItem(STORAGE_KEY_MIGRATION_STAGING);
      const readBackEnvelope = typeof readBackRaw === 'string' ? JSON.parse(readBackRaw) : readBackRaw;

      // 3. Decrypt & authenticate staged envelope
      let saltBytes;
      if (typeof atob === 'function') {
        const bin = atob(readBackEnvelope.kdf.salt);
        saltBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) saltBytes[i] = bin.charCodeAt(i);
      } else {
        saltBytes = new Uint8Array(Buffer.from(readBackEnvelope.kdf.salt, 'base64'));
      }
      const derivedKey = await cryptoMod.deriveKeyFromPin(pin, saltBytes, readBackEnvelope.kdf.iterations);
      const verifiedStaged = await cryptoMod.decryptPayload(readBackEnvelope, derivedKey);
      if (!verifiedStaged || !Array.isArray(verifiedStaged.wallets)) {
        throw new Error('Migration integrity verification failed on staged envelope.');
      }

      // 4. Promote to canonical vault
      await storageAdapter.setItem(STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(stagedEnvelope));

      // 4b. Read back canonical vault through authoritative backend & decrypt successfully (Requirement 4)
      const canonicalRaw = await storageAdapter.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
      if (!canonicalRaw || canonicalRaw.length < 20) {
        throw new Error('Authoritative canonical vault readback verification failed.');
      }
      const canonicalEnvelope = typeof canonicalRaw === 'string' ? JSON.parse(canonicalRaw) : canonicalRaw;
      const verifiedCanonical = await cryptoMod.decryptPayload(canonicalEnvelope, derivedKey);
      if (!verifiedCanonical || !Array.isArray(verifiedCanonical.wallets)) {
        throw new Error('Authoritative canonical vault decryption verification failed.');
      }

      // 5. Delete staging and plaintext keys
      await storageAdapter.removeItem(STORAGE_KEY_MIGRATION_STAGING);
      await storageAdapter.clearPlaintextLedger();

      state._vaultDerivedKey = derivedKey;
      state._vaultSaltBytes = saltBytes;
      state._vaultIterations = stagedEnvelope.kdf.iterations;
      state._isVaultLocked = false;

      refreshAppAfterUnlock();
      return true;
    } else {
      throw new Error('No vault or legacy PIN to unlock.');
    }
  }

  async function enablePinProtection(newPin, oldPin = null) {
    const storageAdapter = window.BB_STORAGE;
    const cryptoMod = window.BB_CRYPTO;

    if (!cryptoMod) throw new Error('Crypto module not available.');

    const isEncrypted = storageAdapter ? (await storageAdapter.hasEncryptedVaultAsync()) : false;

    if (isEncrypted && !state._vaultDerivedKey) {
      if (!oldPin) throw new Error('Current PIN required to change PIN.');
      let rawEnvelope = await storageAdapter.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
      if (!rawEnvelope) rawEnvelope = await storageAdapter.getItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      const envelope = typeof rawEnvelope === 'string' ? JSON.parse(rawEnvelope) : rawEnvelope;
      let saltBytes;
      if (typeof atob === 'function') {
        const bin = atob(envelope.kdf.salt);
        saltBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) saltBytes[i] = bin.charCodeAt(i);
      } else {
        saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
      }
      const oldKey = await cryptoMod.deriveKeyFromPin(oldPin, saltBytes, envelope.kdf.iterations);
      await cryptoMod.decryptPayload(envelope, oldKey);
    }

    const currentPayload = {
      wallets: state.wallets,
      debts: state.debts,
      bills: state.bills,
      transactions: state.transactions,
      settings: state.settings,
      categories: state.categories,
      saveSlots: state.saveSlots,
      activeSlotId: state.activeSlotId
    };

    // 1. Stage
    const stagedEnvelope = await cryptoMod.encryptPayload(currentPayload, newPin);
    await storageAdapter.setItem(STORAGE_KEY_MIGRATION_STAGING, JSON.stringify(stagedEnvelope));

    // 2. Read back staged & verify
    const readBackRaw = await storageAdapter.getItem(STORAGE_KEY_MIGRATION_STAGING);
    const readBackEnvelope = typeof readBackRaw === 'string' ? JSON.parse(readBackRaw) : readBackRaw;

    let saltBytes;
    if (typeof atob === 'function') {
      const bin = atob(readBackEnvelope.kdf.salt);
      saltBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) saltBytes[i] = bin.charCodeAt(i);
    } else {
      saltBytes = new Uint8Array(Buffer.from(readBackEnvelope.kdf.salt, 'base64'));
    }
    const newDerivedKey = await cryptoMod.deriveKeyFromPin(newPin, saltBytes, readBackEnvelope.kdf.iterations);
    const verifiedStaged = await cryptoMod.decryptPayload(readBackEnvelope, newDerivedKey);
    if (!verifiedStaged || !Array.isArray(verifiedStaged.wallets)) {
      throw new Error('Encryption staging verification failed.');
    }

    // 3. Promote to canonical vault
    await storageAdapter.setItem(STORAGE_KEY_ENCRYPTED_VAULT, JSON.stringify(stagedEnvelope));

    // 4. Read back canonical vault through authoritative backend & decrypt successfully (Requirement 4)
    const canonicalRaw = await storageAdapter.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
    if (!canonicalRaw || canonicalRaw.length < 20) {
      throw new Error('Authoritative canonical vault readback verification failed.');
    }
    const canonicalEnvelope = typeof canonicalRaw === 'string' ? JSON.parse(canonicalRaw) : canonicalRaw;
    const verifiedCanonical = await cryptoMod.decryptPayload(canonicalEnvelope, newDerivedKey);
    if (!verifiedCanonical || !Array.isArray(verifiedCanonical.wallets)) {
      throw new Error('Authoritative canonical vault decryption verification failed.');
    }

    // 5. Delete staging and plaintext keys
    await storageAdapter.removeItem(STORAGE_KEY_MIGRATION_STAGING);
    await storageAdapter.clearPlaintextLedger();

    state._vaultDerivedKey = newDerivedKey;
    state._vaultSaltBytes = saltBytes;
    state._vaultIterations = stagedEnvelope.kdf.iterations;
    state._isVaultLocked = false;
  }

  async function removePinProtection(pin) {
    const storageAdapter = window.BB_STORAGE;
    const cryptoMod = window.BB_CRYPTO;

    if (!cryptoMod) throw new Error('Crypto module not available.');

    const isEncrypted = storageAdapter ? (await storageAdapter.hasEncryptedVaultAsync()) : false;
    const hasLegacyPin = storageAdapter ? (await storageAdapter.hasLegacyPlaintextPinAsync()) : false;

    if (isEncrypted) {
      let rawEnvelope = await storageAdapter.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
      if (!rawEnvelope) rawEnvelope = await storageAdapter.getItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      const envelope = typeof rawEnvelope === 'string' ? JSON.parse(rawEnvelope) : rawEnvelope;
      let saltBytes;
      if (typeof atob === 'function') {
        const bin = atob(envelope.kdf.salt);
        saltBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) saltBytes[i] = bin.charCodeAt(i);
      } else {
        saltBytes = new Uint8Array(Buffer.from(envelope.kdf.salt, 'base64'));
      }
      const key = await cryptoMod.deriveKeyFromPin(pin, saltBytes, envelope.kdf.iterations);
      const decrypted = await cryptoMod.decryptPayload(envelope, key);

      const batch = {
        [STORAGE_KEY_SAVE_SLOTS]: JSON.stringify(decrypted.saveSlots || []),
        [STORAGE_KEY_ACTIVE_SLOT_ID]: decrypted.activeSlotId || 'slot_primary',
        [STORAGE_KEY_WALLETS]: JSON.stringify(decrypted.wallets || []),
        [STORAGE_KEY_DEBTS]: JSON.stringify(decrypted.debts || []),
        [STORAGE_KEY_BILLS]: JSON.stringify(decrypted.bills || []),
        [STORAGE_KEY_TRANSACTIONS]: JSON.stringify(decrypted.transactions || []),
        [STORAGE_KEY_SETTINGS]: JSON.stringify(decrypted.settings || {}),
        [STORAGE_KEY_CATEGORIES]: JSON.stringify(decrypted.categories || []),
        [STORAGE_KEY_LAST_SAVED]: Date.now().toString()
      };
      await storageAdapter.setBatch(batch);
      await storageAdapter.removeItem(STORAGE_KEY_ENCRYPTED_VAULT);
      await storageAdapter.removeItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      await storageAdapter.removeItem(STORAGE_KEY_MIGRATION_STAGING);
      await storageAdapter.removeItem(STORAGE_KEY_PIN);
      await storageAdapter.removeItem(LEGACY_KEY_PIN_V6);

      state._vaultDerivedKey = null;
      state._isVaultLocked = false;
    } else if (hasLegacyPin) {
      const legacyPin = await storageAdapter.getLegacyPlaintextPinAsync();
      if (pin !== legacyPin) throw new Error('Incorrect PIN.');
      await storageAdapter.removeItem(STORAGE_KEY_PIN);
      await storageAdapter.removeItem(LEGACY_KEY_PIN_V6);
      state._isVaultLocked = false;
    }
  }

  function setupMobileNavListeners() {
    document.getElementById('mobileNavAddBtn')?.addEventListener('click', () => {
      const formEl = document.getElementById('txForm');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('txAmount')?.focus();
    });

    document.getElementById('mobileNavWalletsBtn')?.addEventListener('click', () => {
      if (window.BB_WALLETS) window.BB_WALLETS.renderManageWalletsTable();
      document.getElementById('walletsModal')?.classList.add('active');
    });

    document.getElementById('mobileNavBillsBtn')?.addEventListener('click', () => {
      if (window.BB_BILLS) window.BB_BILLS.renderBillsTable();
      document.getElementById('billsModal')?.classList.add('active');
    });

    document.getElementById('mobileNavDebtsBtn')?.addEventListener('click', () => {
      if (window.BB_DEBTS) window.BB_DEBTS.switchDebtTab(state.activeDebtTab || 'my_debts');
      document.getElementById('debtsModal')?.classList.add('active');
    });

    document.getElementById('mobileNavReportsBtn')?.addEventListener('click', () => {
      document.getElementById('reportModal')?.classList.add('active');
      if (window.BB_REPORTS) window.BB_REPORTS.renderExpenseReport();
    });

    document.getElementById('mobileNavSettingsBtn')?.addEventListener('click', openSettingsModal);

    window.addEventListener('resize', () => window.BB_THEME?.detectDeviceType());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => window.BB_THEME?.detectDeviceType(), 150);
    });
  }

  let _staticListenersInstalled = false;

  function setupStaticListenersOnce() {
    if (_staticListenersInstalled) return;
    _staticListenersInstalled = true;

    setupCategoryListeners();
    setupFormListeners();
    setupLedgerListeners();
    setupAboutModalListeners();
    setupInitialBalanceListeners();
    setupDriveListeners();
    setupEditModalListeners();
    setupOverwriteWarningListeners();
    setupMobileNavListeners();
    setupWelcomeModalListeners();

    document.getElementById('headerAutoSaveBtn')?.addEventListener('click', () => triggerAutoSave(false));
    document.getElementById('settingsSaveNowBtn')?.addEventListener('click', () => triggerAutoSave(false));

    if (window.BB_THEME) {
      window.BB_THEME.setupGreetingQuoteListeners?.();
      window.BB_THEME.setupHeroCarouselListeners?.();
    }
    if (window.BB_WALLETS) {
      window.BB_WALLETS.setupWalletListeners?.();
      window.BB_WALLETS.setupSaveVaultListeners?.();
      window.BB_WALLETS.setupExtensionGuideListeners?.();
      window.BB_WALLETS.setupReconciliationListeners?.();
    }
    if (window.BB_DEBTS) {
      window.BB_DEBTS.setupDebtsListeners?.();
    }
    if (window.BB_BILLS) {
      window.BB_BILLS.setupBillsListeners?.();
    }
    if (window.BB_REPORTS) {
      window.BB_REPORTS.setupReportListeners?.();
      window.BB_REPORTS.setupGuideModalListeners?.();
      window.BB_REPORTS.setupExportImportListeners?.();
    }
  }

  async function init() {
    if (window.BB_THEME) {
      window.BB_THEME.detectDeviceType();
      window.BB_THEME.initPwaAndShortcuts();
    }

    setupStaticListenersOnce();

    await loadData();

    if (window.BB_THEME) {
      window.BB_THEME.initPinSecurity();
    }

    if (!state._isVaultLocked) {
      initializeUnlockedApplication();
    }
  }

  window.BB_CORE = {
    showToast,
    updateCategoryDatalists,
    updateKPIs,
    renderLedgerTable,
    updateProjectedBalance,
    updateFxRateAndConversion,
    saveData,
    loadData,
    hasActiveSavedLedger,
    getLastSavedLedgerSummary,
    updateWelcomeSavedLedgerDisplay,
    openOverwriteWarningModal,
    unlockAppWithPin,
    enablePinProtection,
    removePinProtection,
    lockApp: () => window.BB_THEME?.lockApp?.(),
    setupStaticListenersOnce,
    initializeUnlockedApplication,
    initAutoSaveEngine,
    stopAutoSaveEngine,
    getAutoSaveTimer: () => autoSaveTimer,
    getRelativeTimeTimer: () => relativeTimeTimer
  };

  window.app = {
    openEditModal,
    deleteTransaction,
    deleteCategory,
    promptRenameCategory,
    openSettingsModal,
    openEditWalletModal: (id) => window.BB_WALLETS?.openEditWalletModal(id),
    promptDeleteWallet: (id) => window.BB_WALLETS?.promptDeleteWallet(id),
    openEditDebtModal: (id) => window.BB_DEBTS?.openEditDebtModal(id),
    deleteDebt: (id) => window.BB_DEBTS?.deleteDebt(id),
    openLogPaymentModal: (id) => window.BB_DEBTS?.openLogPaymentModal(id),
    openEditBillModal: (id) => window.BB_BILLS?.openEditBillModal(id),
    openMarkBillPaidModal: (id) => window.BB_BILLS?.openMarkBillPaidModal(id),
    toggleBillStatus: (id) => window.BB_BILLS?.toggleBillStatus(id),
    deleteBill: (id) => window.BB_BILLS?.deleteBill(id),
    triggerAutoSave,
    initAutoSaveEngine,
    stopAutoSaveEngine,
    setupStaticListenersOnce,
    initializeUnlockedApplication,
    openGuideModal: (tab) => window.BB_REPORTS?.openGuideModal(tab),
    openAboutModal: () => {
      document.getElementById('changelogModal')?.classList.remove('active');
      document.getElementById('aboutModal')?.classList.add('active');
    },
    openChangelogModal: () => {
      document.getElementById('aboutModal')?.classList.remove('active');
      document.getElementById('changelogModal')?.classList.add('active');
    },
    loadSaveSlot: (id) => window.BB_WALLETS?.loadSaveSlot(id),
    updateSaveSlot: (id) => window.BB_WALLETS?.updateSaveSlot(id),
    duplicateSaveSlot: (id) => window.BB_WALLETS?.duplicateSaveSlot(id),
    deleteSaveSlot: (id) => window.BB_WALLETS?.deleteSaveSlot(id),
    exportSaveSlotAsBarya: (id) => window.BB_WALLETS?.exportSaveSlotAsBarya(id),
    importBaryaFile: (file) => window.BB_WALLETS?.importBaryaFile(file),
    createQuickSnapshot: () => window.BB_WALLETS?.createQuickSnapshot(),
    lockApp: () => window.BB_THEME?.lockApp?.(),
    state,
    elements: {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
