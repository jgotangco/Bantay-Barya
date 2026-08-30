/**
 * Bantay Barya - Data Constants, Presets, Dictionaries & Initial State
 */
(function (window) {
  'use strict';

  const CURRENCIES = {
    PHP: { symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
    USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
    JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
    GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
    AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰' },
    CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
    KRW: { symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },
    THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' }
  };

  const DEFAULT_CATEGORIES = [
    'Balance Brought Forward',
    'Balance Reconciliation',
    'Groceries',
    'Dining & Food',
    'Utilities & Bills',
    'Office & Workspace',
    'Software & Subscriptions',
    'Transportation & Fuel',
    'Healthcare & Wellness',
    'Rent & Housing',
    'Client Retainer',
    'Salary & Wages',
    'Consulting Fee',
    'Investment Return',
    'Entertainment',
    'Travel & Lodging',
    'Equipment & Hardware',
    'Miscellaneous'
  ];

  const DEFAULT_WALLETS = [
    {
      id: 'wallet_default',
      name: 'Personal Spending',
      type: 'spending',
      currency: 'PHP',
      icon: '👛',
      initialBalance: 0.00,
      createdAt: Date.now()
    }
  ];

  const SAMPLE_DEBTS = [
    {
      id: 'debt_sample_mortgage',
      name: 'BPI Home Mortgage',
      type: 'mortgage',
      icon: '🏠',
      balance: 1850000.00,
      originalPrincipal: 1850000.00,
      interestMethod: 'diminishing',
      monthlyRate: 0.5625,
      apr: 6.75,
      minPayment: 16500.00,
      dueDate: 'Every 15th',
      notes: '20-year fixed rate mortgage (0.5625%/mo diminishing | 6.75% nominal p.a.)',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    },
    {
      id: 'debt_sample_auto',
      name: 'Toyota Car Loan',
      type: 'auto',
      icon: '🚗',
      balance: 380000.00,
      originalPrincipal: 380000.00,
      interestMethod: 'flat',
      monthlyRate: 0.7083,
      apr: 8.50,
      minPayment: 9800.00,
      dueDate: 'Every 5th',
      notes: '5-year auto loan (0.7083%/mo flat add-on | ~8.50% nominal p.a.)',
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
    },
    {
      id: 'debt_sample_cc',
      name: 'BDO Mastercard',
      type: 'credit_card',
      icon: '💳',
      balance: 45000.00,
      originalPrincipal: 45000.00,
      interestMethod: 'diminishing',
      monthlyRate: 3.00,
      apr: 36.00,
      minPayment: 3500.00,
      dueDate: 'Every 22nd',
      notes: 'BSP standard credit card rate (3.0% / mo diminishing | 36.0% nominal p.a.)',
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
    }
  ];

  const FALLBACK_USD_RATES = {
    PHP: 58.50, USD: 1.0, EUR: 0.92, JPY: 155.0, GBP: 0.79,
    SGD: 1.35, AUD: 1.52, CAD: 1.37, HKD: 7.82, CNY: 7.24,
    KRW: 1375.0, THB: 36.5, AED: 3.67
  };

  const THEME_PALETTES = {
    deep_teal: ['#7be3a8', '#1a7a8e', '#38bdf8', '#ff7b92', '#f59e0b', '#a78bfa', '#0d5e6e', '#34d399', '#f43f5e', '#60a5fa'],
    sunflower: ['#f59e0b', '#0284c7', '#ea580c', '#eab308', '#06b6d4', '#10b981', '#f97316', '#3b82f6', '#d97706', '#ec4899'],
    snow: ['#38bdf8', '#0284c7', '#1e3a8a', '#60a5fa', '#93c5fd', '#3b82f6', '#06b6d4', '#818cf8', '#64748b', '#f43f5e'],
    sakura: ['#ec4899', '#f472b6', '#db2777', '#fbcfe8', '#be185d', '#fda4af', '#fb7185', '#e11d48', '#f43f5e', '#9d174d'],
    pumpkin: ['#ea580c', '#d97706', '#c2410c', '#f59e0b', '#b45309', '#7c2d12', '#f97316', '#ca8a04', '#84cc16', '#e11d48'],
    summer: ['#f59e0b', '#0284c7', '#ea580c', '#eab308', '#06b6d4', '#10b981', '#f97316', '#3b82f6', '#d97706', '#ec4899'],
    winter: ['#38bdf8', '#0284c7', '#1e3a8a', '#60a5fa', '#93c5fd', '#3b82f6', '#06b6d4', '#818cf8', '#64748b', '#f43f5e'],
    spring: ['#ec4899', '#f472b6', '#db2777', '#fbcfe8', '#be185d', '#fda4af', '#fb7185', '#e11d48', '#f43f5e', '#9d174d'],
    fall: ['#ea580c', '#d97706', '#c2410c', '#f59e0b', '#b45309', '#7c2d12', '#f97316', '#ca8a04', '#84cc16', '#e11d48'],
    default: ['#7be3a8', '#1a7a8e', '#38bdf8', '#ff7b92', '#f59e0b', '#a78bfa', '#0d5e6e', '#34d399', '#f43f5e', '#60a5fa']
  };

  const INSPIRATION_ITEMS = [
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "Beware of little expenses; a small leak will sink a great ship.",
      author: "Benjamin Franklin"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Use the Save Vault (💾) to create multiple budgets, what-if simulations, or quick snapshots of your ledgers.",
      author: "Save Vault & .barya Files"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Create multiple wallets (e.g. Personal Spending, Savings, Current Account, Cash) to organize and isolate your cash flows.",
      author: "Multi-Wallet Management"
    },
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "Do not save what is left after spending, but spend what is left after saving.",
      author: "Warren Buffett"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Aim for a Spending Buffer of 30+ days. When it turns Green, you are spending money received over a month ago!",
      author: "Spending Buffer Habit"
    },
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "A budget is telling your money where to go instead of wondering where it went.",
      author: "Dave Ramsey"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Install the Bantay Barya browser extension to log expenses directly while shopping or paying bills online.",
      author: "Browser Extension"
    },
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "Spending money to show people how much money you have is the fastest way to have less money.",
      author: "Morgan Housel"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Tap the 🤝 Reconcile button on any wallet to balance its ledger against your bank or card statement in one tap.",
      author: "Reconciliation Workflow"
    },
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "Wealth is what you don't see. It's the cars not purchased, the diamonds not bought, the watches not worn.",
      author: "Morgan Housel"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "If you delete a wallet, Bantay Barya lets you safely reassign all existing transactions and balances to another wallet.",
      author: "Safe Wallet Deletion"
    },
    {
      type: 'quote',
      tag: '💡 Financial Wisdom',
      text: "Never spend your money before you have earned it.",
      author: "Thomas Jefferson"
    },
    {
      type: 'tip',
      tag: '✨ Bantay Barya Tip',
      text: "Keep your multi-wallet data secure by enabling the 7-digit PIN in Settings.",
      author: "PIN Protection"
    }
  ];

  const HERO_SLIDES = [
    {
      id: 0,
      icon: '🥧',
      title: 'Expenses This Month',
      subtitle: 'Category share breakdown'
    },
    {
      id: 1,
      icon: '📈',
      title: 'Spending Buffer Trend',
      subtitle: 'Buffer tracking vs 30-day target'
    },
    {
      id: 2,
      icon: '📊',
      title: 'Inflows vs Outflows',
      subtitle: 'Cash flow for last 3 months'
    },
    {
      id: 3,
      icon: '⚖️',
      title: '3-Month Assets vs Liabilities',
      subtitle: 'Assets, Liabilities & Real Net Worth'
    }
  ];

  const SAMPLE_BILLS = [
    {
      id: 'bill_meralco_demo',
      name: 'Meralco Electricity',
      category: 'Utilities',
      amount: 3450.00,
      currency: 'PHP',
      walletId: 'wallet_bpi',
      dueDate: getRelativeDateString(2),
      isRecurring: true,
      frequency: 'monthly',
      notifyDaysBefore: 3,
      status: 'unpaid',
      lastPaidDate: null,
      autoPostTx: true,
      notes: 'CAN: 1029384756 (Due in 2 days)',
      createdAt: Date.now() - 100000
    },
    {
      id: 'bill_pldt_demo',
      name: 'PLDT Home Fiber',
      category: 'Telecom & Internet',
      amount: 1899.00,
      currency: 'PHP',
      walletId: 'wallet_bpi',
      dueDate: getRelativeDateString(12),
      isRecurring: true,
      frequency: 'monthly',
      notifyDaysBefore: 3,
      status: 'unpaid',
      lastPaidDate: null,
      autoPostTx: true,
      notes: 'Account # 028475938',
      createdAt: Date.now() - 90000
    },
    {
      id: 'bill_netflix_demo',
      name: 'Netflix Premium 4K',
      category: 'Subscriptions',
      amount: 549.00,
      currency: 'PHP',
      walletId: 'wallet_bpi',
      dueDate: getRelativeDateString(18),
      isRecurring: true,
      frequency: 'monthly',
      notifyDaysBefore: 1,
      status: 'unpaid',
      lastPaidDate: null,
      autoPostTx: true,
      notes: 'Monthly streaming plan',
      createdAt: Date.now() - 80000
    }
  ];

  const STORAGE_KEY_SAVE_SLOTS = 'bantay_barya_save_slots_v7';
  const STORAGE_KEY_ACTIVE_SLOT_ID = 'bantay_barya_active_slot_id_v7';
  const STORAGE_KEY_WALLETS = 'bantay_barya_wallets_v7';
  const STORAGE_KEY_DEBTS = 'bantay_barya_debts_v7';
  const STORAGE_KEY_BILLS = 'bantay_barya_bills_v7';
  const STORAGE_KEY_TRANSACTIONS = 'bantay_barya_transactions_v7';
  const STORAGE_KEY_SETTINGS = 'bantay_barya_settings_v7';
  const STORAGE_KEY_CATEGORIES = 'bantay_barya_categories_v7';
  const STORAGE_KEY_THEME = 'bantay_barya_theme_v7';
  const STORAGE_KEY_FX_CACHE = 'bantay_barya_fx_cache_v7';
  const STORAGE_KEY_DONT_SHOW_WELCOME = 'bantay_barya_dont_show_welcome_v7';
  const STORAGE_KEY_PIN = 'bantay_barya_pin_v7';
  const STORAGE_KEY_LAST_SAVED = 'bantay_barya_last_saved_v7';
  const STORAGE_KEY_ENCRYPTED_VAULT = 'bb_encrypted_vault_v1';
  const LEGACY_KEY_ENCRYPTED_VAULT_V7 = 'bantay_barya_encrypted_vault_v7';
  const STORAGE_KEY_MIGRATION_STAGING = 'bb_migration_staging_v1';
  const STORAGE_KEY_THROTTLE = 'bb_throttle_v1';

  const LEGACY_KEY_TRANSACTIONS_V6 = 'bantay_barya_transactions_v6';
  const LEGACY_KEY_SETTINGS_V6 = 'bantay_barya_settings_v6';
  const LEGACY_KEY_CATEGORIES_V6 = 'bantay_barya_categories_v6';
  const LEGACY_KEY_THEME_V6 = 'bantay_barya_theme_v6';
  const LEGACY_KEY_PIN_V6 = 'bantay_barya_pin_v6';

  function getRelativeDateString(offsetDays = 0, baseDate = new Date()) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatCurrency(val, baseCurr = (window.BB_STATE?.settings?.baseCurrency || 'PHP')) {
    const num = parseFloat(val) || 0;
    const sym = CURRENCIES[baseCurr]?.symbol || '₱';
    return (num < 0 ? '-' : '') + sym + Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatForeignCurrency(amount, currencyCode) {
    const sym = CURRENCIES[currencyCode]?.symbol || currencyCode;
    const num = parseFloat(amount) || 0;
    return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const state = {
    saveSlots: [],
    activeSlotId: 'slot_primary',
    wallets: [...DEFAULT_WALLETS],
    debts: [],
    bills: [],
    selectedWalletId: 'all',
    transactions: [],
    categories: [...DEFAULT_CATEGORIES],
    settings: {
      userName: '',
      baseCurrency: 'PHP'
    },
    theme: 'auto_date',
    effectiveTheme: 'sunflower',
    currentInspirationIndex: 0,
    currentHeroSlide: 0,
    searchQuery: '',
    typeFilter: 'all',
    dateFilter: 'all',
    sortColumn: 'date',
    sortDirection: 'desc',
    billSearchQuery: '',
    billStatusFilter: 'all',
    billCategoryFilter: 'all',
    reportTimeframe: 'all',
    reportWalletFilter: 'all',
    reportChartType: 'pie',
    activeReportTab: 'expense',
    activeDebtTab: 'my_debts',
    snowballStrategy: 'snowball',
    selectedSimDebtIds: [],
    extraMonthlyPayment: 0,
    lumpSumAdvancePayment: 0,
    currentInputFxRate: 1.0,
    detectedPlatform: 'desktop',
    _vaultDerivedKey: null,
    _vaultSaltBytes: null,
    _vaultIterations: null,
    _isVaultLocked: false
  };

  window.BB_DATA = {
    CURRENCIES,
    DEFAULT_CATEGORIES,
    DEFAULT_WALLETS,
    SAMPLE_DEBTS,
    FALLBACK_USD_RATES,
    THEME_PALETTES,
    INSPIRATION_ITEMS,
    HERO_SLIDES,
    SAMPLE_BILLS,
    STORAGE_KEY_SAVE_SLOTS,
    STORAGE_KEY_ACTIVE_SLOT_ID,
    STORAGE_KEY_WALLETS,
    STORAGE_KEY_DEBTS,
    STORAGE_KEY_BILLS,
    STORAGE_KEY_TRANSACTIONS,
    STORAGE_KEY_SETTINGS,
    STORAGE_KEY_CATEGORIES,
    STORAGE_KEY_THEME,
    STORAGE_KEY_FX_CACHE,
    STORAGE_KEY_DONT_SHOW_WELCOME,
    STORAGE_KEY_PIN,
    STORAGE_KEY_LAST_SAVED,
    STORAGE_KEY_ENCRYPTED_VAULT,
    LEGACY_KEY_ENCRYPTED_VAULT_V7,
    STORAGE_KEY_MIGRATION_STAGING,
    STORAGE_KEY_THROTTLE,
    LEGACY_KEY_TRANSACTIONS_V6,
    LEGACY_KEY_SETTINGS_V6,
    LEGACY_KEY_CATEGORIES_V6,
    LEGACY_KEY_THEME_V6,
    LEGACY_KEY_PIN_V6,
    getRelativeDateString,
    formatDateTime,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  };

  window.BB_STATE = state;
})(window);
