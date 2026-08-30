/**
 * Bantay Barya - Browser Extension Popup Controller
 * Quick transaction logger, balance inspector & snapshot trigger.
 * Fully multi-currency aware with safe DOM construction and unified storage adapter.
 */

(function () {
  'use strict';

  const storage = (typeof globalThis !== 'undefined' && globalThis.BB_STORAGE) || {
    async getItem(key) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
          chrome.storage.local.get(key, res => resolve(res ? res[key] : null));
        });
      }
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    },
    async setBatch(map) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => chrome.storage.local.set(map, resolve));
      }
      if (typeof localStorage !== 'undefined') {
        for (const k of Object.keys(map)) localStorage.setItem(k, JSON.stringify(map[k]));
      }
    },
    async hasEncryptedVaultAsync() {
      const v1 = await this.getItem('bb_encrypted_vault_v1');
      if (v1 && v1.length > 20) return true;
      const v2 = await this.getItem('bantay_barya_encrypted_vault_v7');
      return !!(v2 && v2.length > 20);
    },
    hasEncryptedVault() {
      if (typeof localStorage !== 'undefined') {
        const v1 = localStorage.getItem('bb_encrypted_vault_v1');
        const v2 = localStorage.getItem('bantay_barya_encrypted_vault_v7');
        return !!((v1 && v1.length > 20) || (v2 && v2.length > 20));
      }
      return false;
    }
  };

  const currencyMath = (typeof globalThis !== 'undefined' && globalThis.BB_CURRENCY) || {
    roundMoney: (val) => Math.round(Number(val) * 100) / 100,
    getFxRate: (from, to) => from === to ? 1.0 : (to === 'PHP' && from === 'USD' ? 58.50 : 1.0),
    convertCurrency: (amount, from, to) => Math.round(Number(amount) * (from === to ? 1.0 : (to === 'PHP' && from === 'USD' ? 58.50 : 1.0)) * 100) / 100,
    getWalletBalance: (w, txs) => Number(w.initialBalance || 0),
    getTotalBaseBalance: (wallets, txs) => wallets.reduce((acc, w) => acc + Number(w.initialBalance || 0), 0),
    calculateSpendingBuffer: () => ({ days: 0, hasSpends: false, hasFunds: false })
  };

  const STORAGE_KEY_WALLETS = 'bb_wallets';
  const STORAGE_KEY_DEBTS = 'bb_debts';
  const STORAGE_KEY_TRANSACTIONS = 'bb_transactions';
  const STORAGE_KEY_SAVE_SLOTS = 'bb_save_slots';
  const STORAGE_KEY_ACTIVE_SLOT_ID = 'bb_active_slot_id';
  const STORAGE_KEY_SETTINGS = 'bb_settings';
  const STORAGE_KEY_CATEGORIES = 'bb_categories';
  const STORAGE_KEY_ENCRYPTED_VAULT = 'bb_encrypted_vault_v1';

  let localState = {
    wallets: [],
    debts: [],
    transactions: [],
    saveSlots: [],
    activeSlotId: 'slot_primary',
    settings: { userName: '', baseCurrency: 'PHP' },
    categories: [],
    isVaultLocked: false
  };

  const elements = {
    activeSlotPill: document.getElementById('activeSlotPill'),
    popupTotalBalance: document.getElementById('popupTotalBalance'),
    popupSpendingBuffer: document.getElementById('popupSpendingBuffer'),
    popupWalletsContainer: document.getElementById('popupWalletsContainer'),
    openAppBtn: document.getElementById('openAppBtn'),
    quickTxForm: document.getElementById('quickTxForm'),
    typeDebit: document.getElementById('typeDebit'),
    typeCredit: document.getElementById('typeCredit'),
    txWalletSelect: document.getElementById('txWalletSelect'),
    txDate: document.getElementById('txDate'),
    txItem: document.getElementById('txItem'),
    catList: document.getElementById('catList'),
    txAmount: document.getElementById('txAmount'),
    txNotes: document.getElementById('txNotes'),
    currencySymbol: document.getElementById('currencySymbol'),
    amountPrefix: document.getElementById('amountPrefix'),
    quickSnapshotBtn: document.getElementById('quickSnapshotBtn'),
    popupToast: document.getElementById('popupToast')
  };

  function getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  function getCurrencySymbol(curr) {
    const map = { PHP: '₱', USD: '$', EUR: '€', JPY: '¥', GBP: '£', SGD: 'S$', AUD: 'A$', CAD: 'C$' };
    return map[curr] || curr || '₱';
  }

  function formatMoney(amount, curr = localState.settings.baseCurrency) {
    const sym = getCurrencySymbol(curr);
    const num = parseFloat(amount) || 0;
    return (num < 0 ? '-' : '') + sym + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function showLockedVaultState() {
    localState.isVaultLocked = true;
    const banner = document.querySelector('.quick-kpi-banner');
    if (banner) banner.style.display = 'none';
    if (elements.popupWalletsContainer) elements.popupWalletsContainer.style.display = 'none';
    if (elements.quickTxForm) elements.quickTxForm.style.display = 'none';
    if (elements.quickSnapshotBtn) elements.quickSnapshotBtn.style.display = 'none';

    let lockEl = document.getElementById('popupLockedNotice');
    if (!lockEl) {
      lockEl = document.createElement('div');
      lockEl.id = 'popupLockedNotice';
      lockEl.className = 'popup-locked-notice';
      lockEl.style.cssText = 'padding: 32px 16px; text-align: center;';

      const icon = document.createElement('div');
      icon.textContent = '🔒';
      icon.style.cssText = 'font-size: 32px; margin-bottom: 12px;';
      lockEl.appendChild(icon);

      const title = document.createElement('h2');
      title.textContent = 'Vault is PIN-Locked';
      title.style.cssText = 'font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);';
      lockEl.appendChild(title);

      const desc = document.createElement('p');
      desc.textContent = 'Your ledger is protected with encryption. Open the main Bantay Barya application to unlock and record transactions.';
      desc.style.cssText = 'font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;';
      lockEl.appendChild(desc);

      const openBtn = document.createElement('button');
      openBtn.className = 'btn btn-primary btn-block';
      openBtn.textContent = 'Open Bantay Barya';
      openBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
        } else {
          window.open('../index.html', '_blank');
        }
      });
      lockEl.appendChild(openBtn);

      const container = document.querySelector('.popup-container');
      if (container) {
        container.insertBefore(lockEl, document.querySelector('.popup-footer'));
      }
    } else {
      lockEl.style.display = 'block';
    }
  }

  async function loadData() {
    try {
      const storageAdapter = (typeof globalThis !== 'undefined' && globalThis.BB_STORAGE) || storage;
      const isEncrypted = await (storageAdapter.hasEncryptedVaultAsync ? storageAdapter.hasEncryptedVaultAsync() : Promise.resolve(storageAdapter.hasEncryptedVault()));
      const hasLegacyPin = await (storageAdapter.hasLegacyPlaintextPinAsync ? storageAdapter.hasLegacyPlaintextPinAsync() : Promise.resolve(storageAdapter.hasLegacyPlaintextPin?.()));

      if (isEncrypted || hasLegacyPin) {
        showLockedVaultState();
        return;
      }

      const rawWallets = await storage.getItem(STORAGE_KEY_WALLETS);
      const rawDebts = await storage.getItem(STORAGE_KEY_DEBTS);
      const rawTx = await storage.getItem(STORAGE_KEY_TRANSACTIONS);
      const rawSlots = await storage.getItem(STORAGE_KEY_SAVE_SLOTS);
      const rawActiveSlot = await storage.getItem(STORAGE_KEY_ACTIVE_SLOT_ID);
      const rawSettings = await storage.getItem(STORAGE_KEY_SETTINGS);
      const rawCats = await storage.getItem(STORAGE_KEY_CATEGORIES);

      localState.wallets = rawWallets ? (typeof rawWallets === 'string' ? JSON.parse(rawWallets) : rawWallets) : [];
      localState.debts = rawDebts ? (typeof rawDebts === 'string' ? JSON.parse(rawDebts) : rawDebts) : [];
      localState.transactions = rawTx ? (typeof rawTx === 'string' ? JSON.parse(rawTx) : rawTx) : [];
      localState.saveSlots = rawSlots ? (typeof rawSlots === 'string' ? JSON.parse(rawSlots) : rawSlots) : [];
      localState.activeSlotId = rawActiveSlot || 'slot_primary';
      localState.settings = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : { userName: '', baseCurrency: 'PHP' };
      localState.categories = rawCats ? (typeof rawCats === 'string' ? JSON.parse(rawCats) : rawCats) : [];
    } catch (err) {
      console.error('Error loading extension data:', err);
    }
  }

  async function saveData() {
    if (localState.isVaultLocked) {
      console.warn('Popup write blocked: Encrypted vault is locked.');
      return;
    }

    const storageAdapter = (typeof globalThis !== 'undefined' && globalThis.BB_STORAGE) || storage;
    const isEncrypted = await (storageAdapter.hasEncryptedVaultAsync ? storageAdapter.hasEncryptedVaultAsync() : Promise.resolve(storageAdapter.hasEncryptedVault()));
    if (isEncrypted) {
      console.warn('Popup write blocked: Encrypted vault exists. Write operations must be performed in main app.');
      return;
    }

    const activeSlot = localState.saveSlots.find(s => s.id === localState.activeSlotId);
    if (activeSlot) {
      activeSlot.updatedAt = Date.now();
      activeSlot.payload = {
        wallets: localState.wallets,
        debts: localState.debts,
        transactions: localState.transactions,
        categories: localState.categories,
        settings: localState.settings
      };
    }

    const payload = {};
    payload[STORAGE_KEY_WALLETS] = localState.wallets;
    payload[STORAGE_KEY_DEBTS] = localState.debts;
    payload[STORAGE_KEY_TRANSACTIONS] = localState.transactions;
    payload[STORAGE_KEY_SAVE_SLOTS] = localState.saveSlots;
    payload[STORAGE_KEY_ACTIVE_SLOT_ID] = localState.activeSlotId;
    payload[STORAGE_KEY_SETTINGS] = localState.settings;
    payload[STORAGE_KEY_CATEGORIES] = localState.categories;

    await storage.setBatch(payload);
  }

  function getSelectedWallet() {
    const wid = elements.txWalletSelect ? elements.txWalletSelect.value : null;
    return localState.wallets.find(w => w.id === wid) || localState.wallets[0];
  }

  function updateCurrencyLabels() {
    const selWallet = getSelectedWallet();
    const wCurr = selWallet?.currency || localState.settings.baseCurrency || 'PHP';
    const sym = getCurrencySymbol(wCurr);
    if (elements.currencySymbol) elements.currencySymbol.textContent = sym;
    if (elements.amountPrefix) elements.amountPrefix.textContent = sym;
  }

  function renderUI() {
    const baseCurr = localState.settings.baseCurrency || 'PHP';

    // 1. Active Save Slot Pill (Safe textContent)
    const active = localState.saveSlots.find(s => s.id === localState.activeSlotId) || localState.saveSlots[0];
    if (elements.activeSlotPill) {
      elements.activeSlotPill.textContent = active ? `${active.icon || '🌟'} ${active.name}` : '🌟 Primary';
    }

    // 2. Net Balance (Converted to Base Currency)
    if (localState.wallets.length === 0) {
      localState.wallets = [{ id: 'wallet_default', name: 'Personal Spending', icon: '👛', initialBalance: 0, currency: baseCurr }];
    }

    const totalBaseBalance = currencyMath.getTotalBaseBalance(localState.wallets, localState.transactions, baseCurr);
    if (elements.popupTotalBalance) {
      elements.popupTotalBalance.textContent = formatMoney(totalBaseBalance, baseCurr);
      elements.popupTotalBalance.style.color = totalBaseBalance >= 0 ? 'var(--text-primary)' : 'var(--debit-color)';
    }

    // 3. Spending Buffer (Multi-Currency FIFO Runway)
    const bufferResult = currencyMath.calculateSpendingBuffer(localState.wallets, localState.transactions, baseCurr, 'all');
    const bufferDays = bufferResult.days;
    if (elements.popupSpendingBuffer) {
      elements.popupSpendingBuffer.textContent = `${bufferDays}d ${bufferDays >= 30 ? 'Healthy' : (bufferDays > 0 ? 'Alert' : 'No Buffer')}`;
      elements.popupSpendingBuffer.style.color = bufferDays >= 30 ? 'var(--credit-color)' : (bufferDays > 0 ? 'var(--debit-color)' : 'var(--text-muted)');
      elements.popupSpendingBuffer.style.backgroundColor = bufferDays >= 30 ? 'var(--credit-bg)' : (bufferDays > 0 ? 'var(--debit-bg)' : 'var(--bg-surface-subtle)');
    }

    // 4. Wallets Select Dropdown (Safe DOM construction)
    if (elements.txWalletSelect) {
      const currentSelectedVal = elements.txWalletSelect.value;
      while (elements.txWalletSelect.firstChild) {
        elements.txWalletSelect.removeChild(elements.txWalletSelect.firstChild);
      }

      localState.wallets.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        const wCurr = w.currency || baseCurr;
        const currTag = wCurr !== baseCurr ? ` (${wCurr})` : '';
        opt.textContent = `${w.icon || '👛'} ${w.name}${currTag}`;
        elements.txWalletSelect.appendChild(opt);
      });

      if (currentSelectedVal && localState.wallets.some(w => w.id === currentSelectedVal)) {
        elements.txWalletSelect.value = currentSelectedVal;
      }
    }

    // 5. Wallets Quick Chips (Safe DOM construction)
    if (elements.popupWalletsContainer) {
      while (elements.popupWalletsContainer.firstChild) {
        elements.popupWalletsContainer.removeChild(elements.popupWalletsContainer.firstChild);
      }

      localState.wallets.forEach(w => {
        const wCurr = w.currency || baseCurr;
        const nativeBal = currencyMath.getWalletBalance(w, localState.transactions, baseCurr);

        const chipDiv = document.createElement('div');
        chipDiv.className = 'popup-wallet-chip';
        chipDiv.setAttribute('title', `${w.name} (${wCurr})`);

        const iconSpan = document.createElement('span');
        iconSpan.textContent = w.icon || '👛';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${w.name}:`;

        const balStrong = document.createElement('strong');
        balStrong.className = 'font-mono';
        balStrong.textContent = formatMoney(nativeBal, wCurr);
        if (nativeBal < 0) balStrong.style.color = 'var(--debit-color)';

        chipDiv.appendChild(iconSpan);
        chipDiv.appendChild(nameSpan);
        chipDiv.appendChild(balStrong);

        if (wCurr !== baseCurr) {
          const convBal = currencyMath.convertCurrency(nativeBal, wCurr, baseCurr);
          const convSpan = document.createElement('span');
          convSpan.style.fontSize = '0.68rem';
          convSpan.style.color = 'var(--text-muted)';
          convSpan.style.fontFamily = 'var(--font-mono)';
          convSpan.textContent = `≈ ${formatMoney(convBal, baseCurr)}`;
          chipDiv.appendChild(convSpan);
        }

        elements.popupWalletsContainer.appendChild(chipDiv);
      });
    }

    // 6. Categories Datalist (Safe DOM construction)
    if (elements.catList) {
      while (elements.catList.firstChild) {
        elements.catList.removeChild(elements.catList.firstChild);
      }
      (localState.categories || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        elements.catList.appendChild(opt);
      });
    }

    updateCurrencyLabels();
  }

  function showToast(msg) {
    if (!elements.popupToast) return;
    elements.popupToast.textContent = msg;
    elements.popupToast.style.display = 'block';
    setTimeout(() => {
      elements.popupToast.style.display = 'none';
    }, 2400);
  }

  async function init() {
    if (elements.txDate) elements.txDate.value = getTodayString();
    await loadData();
    renderUI();

    if (elements.txWalletSelect) {
      elements.txWalletSelect.addEventListener('change', updateCurrencyLabels);
    }

    // Submit transaction
    if (elements.quickTxForm) {
      elements.quickTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const walletId = elements.txWalletSelect?.value || localState.wallets[0]?.id;
        const targetWallet = localState.wallets.find(w => w.id === walletId) || localState.wallets[0];
        const baseCurr = localState.settings.baseCurrency || 'PHP';
        const wCurr = targetWallet?.currency || baseCurr;

        const date = elements.txDate?.value || getTodayString();
        const item = (elements.txItem?.value || '').trim();
        const amount = parseFloat(elements.txAmount?.value);
        const isCredit = Boolean(elements.typeCredit?.checked);
        const notes = (elements.txNotes?.value || '').trim();

        if (!item || isNaN(amount) || amount <= 0) {
          showToast('Please fill in classification and valid amount.');
          return;
        }

        // Multi-currency handling
        let credit = 0;
        let debit = 0;
        let exchangeRate = 1.0;

        if (wCurr === baseCurr) {
          credit = isCredit ? amount : 0;
          debit = isCredit ? 0 : amount;
          exchangeRate = 1.0;
        } else {
          exchangeRate = currencyMath.getFxRate(wCurr, baseCurr);
          const baseEquivalent = currencyMath.convertCurrency(amount, wCurr, baseCurr);
          credit = isCredit ? baseEquivalent : 0;
          debit = isCredit ? 0 : baseEquivalent;
        }

        const newTx = {
          id: 'tx_ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          walletId: walletId,
          date: date,
          item: item,
          type: isCredit ? 'credit' : 'debit',
          inputCurrency: wCurr,
          inputAmount: amount,
          exchangeRate: exchangeRate,
          credit: credit,
          debit: debit,
          notes: notes ? `${notes} (via Extension)` : 'Logged via Extension',
          createdAt: Date.now()
        };

        localState.transactions.push(newTx);
        if (!localState.categories.includes(item)) {
          localState.categories.push(item);
        }

        await saveData();
        renderUI();

        if (elements.txAmount) elements.txAmount.value = '';
        if (elements.txItem) elements.txItem.value = '';
        if (elements.txNotes) elements.txNotes.value = '';

        showToast(`Recorded ${isCredit ? '+' : '-'}${formatMoney(amount, wCurr)} in ${targetWallet?.name || 'Wallet'}!`);
      });
    }

    // Instant Snapshot
    if (elements.quickSnapshotBtn) {
      elements.quickSnapshotBtn.addEventListener('click', async () => {
        const now = new Date();
        const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
          now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const snap = {
          id: 'slot_snap_' + Date.now(),
          name: `Snapshot (${timeStr})`,
          description: `Snapshot from browser extension on ${now.toLocaleString()}`,
          icon: '📸',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payload: {
            wallets: localState.wallets,
            transactions: localState.transactions,
            categories: localState.categories,
            settings: localState.settings
          }
        };

        localState.saveSlots.unshift(snap);
        await saveData();
        renderUI();
        showToast('📸 Instant snapshot saved to Vault!');
      });
    }

    // Launch Full App
    if (elements.openAppBtn) {
      elements.openAppBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: chrome.runtime.getURL('../index.html') });
        } else {
          window.open('../index.html', '_blank');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
