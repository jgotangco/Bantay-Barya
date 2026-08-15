/**
 * Bantay Barya - Extension Service Worker (Manifest V3)
 * Handles context menu actions, background sync & global shortcuts.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Bantay Barya Extension installed successfully!');

  // Create context menu for quick selection logging
  chrome.contextMenus.create({
    id: 'bantay_barya_log_selection',
    title: 'Log "%s" to Bantay Barya',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bantay_barya_log_selection') {
    const selectedText = info.selectionText || '';
    const cleanNumber = selectedText.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleanNumber);

    if (!isNaN(amount) && amount > 0) {
      chrome.storage.local.get(['bantay_barya_transactions_v7', 'bantay_barya_wallets_v7', 'bantay_barya_settings_v7'], (result) => {
        const wallets = result['bantay_barya_wallets_v7'] || [{ id: 'wallet_default', name: 'Personal Spending' }];
        const txs = result['bantay_barya_transactions_v7'] || [];
        const settings = result['bantay_barya_settings_v7'] || { baseCurrency: 'PHP' };

        const newTx = {
          id: 'tx_ctx_' + Date.now(),
          walletId: wallets[0].id,
          date: new Date().toISOString().split('T')[0],
          item: 'Online Purchase',
          type: 'debit',
          inputCurrency: settings.baseCurrency || 'PHP',
          inputAmount: amount,
          exchangeRate: 1.0,
          credit: 0,
          debit: amount,
          notes: `Logged from ${tab.title || 'webpage'}`,
          createdAt: Date.now()
        };

        txs.push(newTx);
        chrome.storage.local.set({ 'bantay_barya_transactions_v7': txs }, () => {
          console.log('Logged transaction from context menu:', newTx);
        });
      });
    }
  }
});
