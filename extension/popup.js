/**
 * Bantay Barya - Browser Extension Popup Controller
 * Quick transaction logger, balance inspector & snapshot trigger.
 */

(function () {
  'use strict';

  const STORAGE_KEY_WALLETS = 'bantay_barya_wallets_v7';
  const STORAGE_KEY_DEBTS = 'bantay_barya_debts_v7';
  const STORAGE_KEY_TRANSACTIONS = 'bantay_barya_transactions_v7';
  const STORAGE_KEY_SAVE_SLOTS = 'bantay_barya_save_slots_v7';
  const STORAGE_KEY_ACTIVE_SLOT_ID = 'bantay_barya_active_slot_id_v7';
  const STORAGE_KEY_SETTINGS = 'bantay_barya_settings_v7';
  const STORAGE_KEY_CATEGORIES = 'bantay_barya_categories_v7';

  let localState = {
    wallets: [],
    debts: [],
    transactions: [],
    saveSlots: [],
    activeSlotId: 'slot_primary',
    settings: { userName: '', baseCurrency: 'PHP' },
    categories: []
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
    return map[curr] || '₱';
  }

  function formatMoney(amount) {
    const sym = getCurrencySymbol(localState.settings.baseCurrency);
    const num = parseFloat(amount) || 0;
    return (num < 0 ? '-' : '') + sym + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Storage Abstraction (Chrome Storage Local + LocalStorage fallback)
  async function loadData() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([
          STORAGE_KEY_WALLETS,
          STORAGE_KEY_DEBTS,
          STORAGE_KEY_TRANSACTIONS,
          STORAGE_KEY_SAVE_SLOTS,
          STORAGE_KEY_ACTIVE_SLOT_ID,
          STORAGE_KEY_SETTINGS,
          STORAGE_KEY_CATEGORIES
        ], (result) => {
          localState.wallets = result[STORAGE_KEY_WALLETS] || JSON.parse(localStorage.getItem(STORAGE_KEY_WALLETS) || '[]');
          localState.debts = result[STORAGE_KEY_DEBTS] || JSON.parse(localStorage.getItem(STORAGE_KEY_DEBTS) || '[]');
          localState.transactions = result[STORAGE_KEY_TRANSACTIONS] || JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
          localState.saveSlots = result[STORAGE_KEY_SAVE_SLOTS] || JSON.parse(localStorage.getItem(STORAGE_KEY_SAVE_SLOTS) || '[]');
          localState.activeSlotId = result[STORAGE_KEY_ACTIVE_SLOT_ID] || localStorage.getItem(STORAGE_KEY_ACTIVE_SLOT_ID) || 'slot_primary';
          localState.settings = result[STORAGE_KEY_SETTINGS] || JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{"baseCurrency":"PHP"}');
          localState.categories = result[STORAGE_KEY_CATEGORIES] || JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
          resolve();
        });
      } else {
        localState.wallets = JSON.parse(localStorage.getItem(STORAGE_KEY_WALLETS) || '[]');
        localState.debts = JSON.parse(localStorage.getItem(STORAGE_KEY_DEBTS) || '[]');
        localState.transactions = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
        localState.saveSlots = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVE_SLOTS) || '[]');
        localState.activeSlotId = localStorage.getItem(STORAGE_KEY_ACTIVE_SLOT_ID) || 'slot_primary';
        localState.settings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{"baseCurrency":"PHP"}');
        localState.categories = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
        resolve();
      }
    });
  }

  async function saveData() {
    return new Promise((resolve) => {
      // Sync active slot
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

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const payload = {};
        payload[STORAGE_KEY_WALLETS] = localState.wallets;
        payload[STORAGE_KEY_DEBTS] = localState.debts;
        payload[STORAGE_KEY_TRANSACTIONS] = localState.transactions;
        payload[STORAGE_KEY_SAVE_SLOTS] = localState.saveSlots;
        payload[STORAGE_KEY_ACTIVE_SLOT_ID] = localState.activeSlotId;
        payload[STORAGE_KEY_SETTINGS] = localState.settings;
        payload[STORAGE_KEY_CATEGORIES] = localState.categories;

        chrome.storage.local.set(payload, () => {
          localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(localState.wallets));
          localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(localState.debts));
          localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(localState.transactions));
          localStorage.setItem(STORAGE_KEY_SAVE_SLOTS, JSON.stringify(localState.saveSlots));
          localStorage.setItem(STORAGE_KEY_ACTIVE_SLOT_ID, localState.activeSlotId);
          resolve();
        });
      } else {
        localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(localState.wallets));
        localStorage.setItem(STORAGE_KEY_DEBTS, JSON.stringify(localState.debts));
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(localState.transactions));
        localStorage.setItem(STORAGE_KEY_SAVE_SLOTS, JSON.stringify(localState.saveSlots));
        localStorage.setItem(STORAGE_KEY_ACTIVE_SLOT_ID, localState.activeSlotId);
        resolve();
      }
    });
  }

  function getWalletBalance(walletId) {
    const w = localState.wallets.find(item => item.id === walletId);
    if (!w) return 0;
    let b = parseFloat(w.initialBalance) || 0;
    localState.transactions.filter(t => t.walletId === walletId).forEach(tx => {
      b += (parseFloat(tx.credit) || 0) - (parseFloat(tx.debit) || 0);
    });
    return b;
  }

  function calculateTotalBalance() {
    let tot = 0;
    if (localState.wallets.length === 0) {
      localState.wallets = [{ id: 'wallet_default', name: 'Personal Spending', icon: '👛', initialBalance: 0 }];
    }
    localState.wallets.forEach(w => {
      tot += getWalletBalance(w.id);
    });
    return tot;
  }

  function calculateGrandTotalSpendingBuffer() {
    const totalInitial = (localState.wallets || []).reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);
    const txs = localState.transactions || [];
    const totalCredits = txs.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0);
    const totalDebits = txs.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0);
    const currentNet = totalInitial + totalCredits - totalDebits;

    if (txs.length === 0 && totalInitial <= 0) return 0;
    if (currentNet <= 0 && txs.length === 0) return 0;

    const sorted = [...txs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const now = new Date();
    const defaultInitDate = sorted.length > 0 ? new Date(sorted[0].date + 'T00:00:00') : now;

    const queue = [];
    if (totalInitial > 0) queue.push({ date: defaultInitDate, remaining: totalInitial });

    let lastDebit = null;
    let lastInflow = null;

    sorted.forEach(tx => {
      const cr = parseFloat(tx.credit) || 0;
      const db = parseFloat(tx.debit) || 0;
      const d = new Date((tx.date || '') + 'T00:00:00');
      if (cr > 0) queue.push({ date: d, remaining: cr });
      if (db > 0) {
        let needed = db;
        lastDebit = d;
        while (needed > 0 && queue.length > 0) {
          lastInflow = queue[0].date;
          if (queue[0].remaining <= needed) {
            needed -= queue[0].remaining;
            queue.shift();
          } else {
            queue[0].remaining -= needed;
            needed = 0;
          }
        }
      }
    });

    if (!lastDebit) {
      if (queue.length === 0 || currentNet <= 0) return 0;
      const ref = queue[0].date;
      return Math.max(0, Math.floor((now - ref) / (1000 * 60 * 60 * 24)));
    }
    if (!lastInflow) return 0;
    return Math.max(0, Math.floor((lastDebit - lastInflow) / (1000 * 60 * 60 * 24)));
  }

  function updateUI() {
    const sym = getCurrencySymbol(localState.settings.baseCurrency);
    elements.currencySymbol.textContent = sym;
    elements.amountPrefix.textContent = sym;

    // Active Save Slot
    const active = localState.saveSlots.find(s => s.id === localState.activeSlotId) || localState.saveSlots[0];
    if (active) {
      elements.activeSlotPill.textContent = `${active.icon || '🌟'} ${active.name}`;
    }

    // Net Balance
    const total = calculateTotalBalance();
    elements.popupTotalBalance.textContent = formatMoney(total);
    elements.popupTotalBalance.style.color = total >= 0 ? 'var(--text-primary)' : 'var(--debit-color)';

    // Wallets Chips & Dropdown
    if (localState.wallets.length === 0) {
      localState.wallets = [{ id: 'wallet_default', name: 'Personal Spending', icon: '👛', initialBalance: 0 }];
    }

    elements.txWalletSelect.innerHTML = localState.wallets.map(w =>
      `<option value="${w.id}">${w.icon || '👛'} ${w.name}</option>`
    ).join('');

    elements.popupWalletsContainer.innerHTML = localState.wallets.map(w => {
      const bal = getWalletBalance(w.id);
      return `
        <div class="popup-wallet-chip" title="${w.name}">
          <span>${w.icon || '👛'}</span>
          <span>${w.name}:</span>
          <strong class="font-mono">${formatMoney(bal)}</strong>
        </div>
      `;
    }).join('');

    // Categories
    if (localState.categories && localState.categories.length > 0) {
      elements.catList.innerHTML = localState.categories.map(c => `<option value="${c}">`).join('');
    }

    // Spending Buffer Preview (Grand Total across all wallets)
    const bufferDays = calculateGrandTotalSpendingBuffer();
    elements.popupSpendingBuffer.textContent = `${bufferDays}d ${bufferDays >= 30 ? 'Healthy' : 'Alert'}`;
    elements.popupSpendingBuffer.style.color = bufferDays >= 30 ? 'var(--credit-color)' : 'var(--debit-color)';
    elements.popupSpendingBuffer.style.backgroundColor = bufferDays >= 30 ? 'var(--credit-bg)' : 'var(--debit-bg)';
  }

  function showToast(msg) {
    elements.popupToast.textContent = msg;
    elements.popupToast.style.display = 'block';
    setTimeout(() => {
      elements.popupToast.style.display = 'none';
    }, 2400);
  }

  async function init() {
    elements.txDate.value = getTodayString();
    await loadData();
    updateUI();

    // Submit transaction
    elements.quickTxForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const walletId = elements.txWalletSelect.value || localState.wallets[0]?.id;
      const date = elements.txDate.value || getTodayString();
      const item = elements.txItem.value.trim();
      const amount = parseFloat(elements.txAmount.value);
      const isCredit = elements.typeCredit.checked;
      const notes = elements.txNotes.value.trim();

      if (!item || isNaN(amount) || amount <= 0) {
        showToast('Please fill in classification and valid amount.');
        return;
      }

      const newTx = {
        id: 'tx_ext_' + Date.now(),
        walletId: walletId,
        date: date,
        item: item,
        type: isCredit ? 'credit' : 'debit',
        inputCurrency: localState.settings.baseCurrency || 'PHP',
        inputAmount: amount,
        exchangeRate: 1.0,
        credit: isCredit ? amount : 0,
        debit: isCredit ? 0 : amount,
        notes: notes ? `${notes} (via Extension)` : 'Logged via Extension',
        createdAt: Date.now()
      };

      localState.transactions.push(newTx);
      if (!localState.categories.includes(item)) {
        localState.categories.push(item);
      }

      await saveData();
      updateUI();

      elements.txAmount.value = '';
      elements.txItem.value = '';
      elements.txNotes.value = '';

      showToast(`Recorded ${isCredit ? '+' : '-'}${formatMoney(amount)} in ${localState.wallets.find(w => w.id === walletId)?.name}!`);
    });

    // Instant Snapshot
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
      showToast('📸 Instant snapshot saved to Vault!');
    });

    // Launch Full App
    elements.openAppBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: chrome.runtime.getURL('../index.html') });
      } else {
        window.open('../index.html', '_blank');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
