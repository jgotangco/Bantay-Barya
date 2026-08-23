/**
 * Bantay Barya - Multi-Wallet Engine, Save Vault (.barya), FX Conversion, FIFO Spending Buffer & Reconciliation
 */
(function (window) {
  'use strict';

  const {
    CURRENCIES,
    DEFAULT_WALLETS,
    DEFAULT_CATEGORIES,
    STORAGE_KEY_WALLETS,
    STORAGE_KEY_SAVE_SLOTS,
    STORAGE_KEY_ACTIVE_SLOT_ID,
    STORAGE_KEY_LAST_SAVED,
    formatCurrency,
    formatForeignCurrency,
    getRelativeDateString,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;

  function exportSaveSlotAsBarya(slotId) {
    const slot = state.saveSlots.find(s => s.id === slotId) || state.saveSlots[0];
    if (!slot) return;

    const baryaPayload = {
      format: 'bantay_barya_save',
      fileVersion: '7.0',
      app: 'Bantay Barya',
      author: 'Jerome Gotangco (https://github.com/jgotangco)',
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

    if (window.BB_CORE?.showToast) {
      window.BB_CORE.showToast(`Exported "${slot.name}" as portable .barya archive!`, 'success');
    }
  }

  window.BB_WALLETS = {
    ...window.BB_WALLETS,
    exportSaveSlotAsBarya
  };
})(window);
