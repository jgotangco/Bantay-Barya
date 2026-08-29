/**
 * Bantay Barya - Constants, Currencies, Sample Data & Formatting Helpers
 */
(function (window) {
  'use strict';

  const STORAGE_KEY_SAVE_SLOTS = 'bb_save_slots_v7';
  const STORAGE_KEY_ACTIVE_SLOT_ID = 'bb_active_slot_id_v7';
  const STORAGE_KEY_WALLETS = 'bb_wallets_v7';
  const STORAGE_KEY_CATEGORIES = 'bb_categories_v7';
  const STORAGE_KEY_TRANSACTIONS = 'bb_transactions_v7';
  const STORAGE_KEY_SETTINGS = 'bb_settings_v7';
  const STORAGE_KEY_DEBTS = 'bb_debts_v7';
  const STORAGE_KEY_BILLS = 'bb_bills_v7';
  const STORAGE_KEY_SEEN_ONBOARDING = 'bb_seen_onboarding_v7';
  const STORAGE_KEY_PIN_HASH = 'bb_pin_hash_v7';
  const STORAGE_KEY_PIN_ENABLED = 'bb_pin_enabled_v7';
  const STORAGE_KEY_CUSTOM_RATES = 'bb_custom_fx_rates_v7';
  const STORAGE_KEY_LAST_SAVED = 'bb_last_saved_timestamp_v7';

  const CURRENCIES = {
    PHP: { symbol: '₱', name: 'Philippine Peso', code: 'PHP', flag: '🇵🇭' },
    USD: { symbol: '$', name: 'US Dollar', code: 'USD', flag: '🇺🇸' },
    EUR: { symbol: '€', name: 'Euro', code: 'EUR', flag: '🇪🇺' },
    JPY: { symbol: '¥', name: 'Japanese Yen', code: 'JPY', flag: '🇯🇵' },
    GBP: { symbol: '£', name: 'British Pound', code: 'GBP', flag: '🇬🇧' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar', code: 'SGD', flag: '🇸🇬' },
    AUD: { symbol: 'A$', name: 'Australian Dollar', code: 'AUD', flag: '🇦🇺' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD', flag: '🇨🇦' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', code: 'HKD', flag: '🇭🇰' },
    CNY: { symbol: '¥', name: 'Chinese Yuan', code: 'CNY', flag: '🇨🇳' },
    KRW: { symbol: '₩', name: 'South Korean Won', code: 'KRW', flag: 'KRW' },
    THB: { symbol: '฿', name: 'Thai Baht', code: 'THB', flag: '🇹🇭' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', code: 'AED', flag: '🇦🇪' }
  };

  const DEFAULT_CATEGORIES = [
    'Salary & Income', 'Freelance & Projects', 'Food & Groceries', 'Dining & Coffee',
    'Rent & Housing', 'Electricity (Meralco)', 'Water & Utilities', 'Internet & Mobile',
    'Transportation & Fuel', 'Shopping & Clothing', 'Health & Medical', 'Entertainment & Leisure',
    'Debt Repayment', 'Insurance & Savings', 'Education & Books', 'Gifts & Charity', 'Miscellaneous'
  ];

  const DEFAULT_WALLETS = [
    {
      id: 'wallet_primary',
      name: 'Personal Spending',
      currency: 'PHP',
      type: 'cash',
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

  const SAMPLE_BILLS = [
    {
      id: 'bill_sample_meralco',
      name: 'Meralco Electric Bill',
      amount: 6850.00,
      dueDay: 15,
      frequency: 'monthly',
      category: 'Electricity (Meralco)',
      walletId: 'wallet_primary',
      isAutoDebit: false,
      notes: 'Customer Account No: 1042-8891-03',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    },
    {
      id: 'bill_sample_pldt',
      name: 'PLDT Home Fiber Internet',
      amount: 2099.00,
      dueDay: 20,
      frequency: 'monthly',
      category: 'Internet & Mobile',
      walletId: 'wallet_primary',
      isAutoDebit: true,
      notes: 'Plan 200Mbps UNLI Fiber',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    },
    {
      id: 'bill_sample_water',
      name: 'Maynilad Water',
      amount: 820.00,
      dueDay: 8,
      frequency: 'monthly',
      category: 'Water & Utilities',
      walletId: 'wallet_primary',
      isAutoDebit: false,
      notes: 'Contract Account: 99120412',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    },
    {
      id: 'bill_sample_netflix',
      name: 'Netflix Premium 4K',
      amount: 549.00,
      dueDay: 28,
      frequency: 'monthly',
      category: 'Entertainment & Leisure',
      walletId: 'wallet_primary',
      isAutoDebit: true,
      notes: 'Family Subscription Plan',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    }
  ];

  function getRelativeDateString(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatCurrency(amount, currencyCode = 'PHP') {
    const num = parseFloat(amount) || 0;
    const curr = CURRENCIES[currencyCode] || CURRENCIES.PHP;
    const formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${curr.symbol}${formattedNum}`;
  }

  function formatForeignCurrency(amount, currencyCode) {
    const num = parseFloat(amount) || 0;
    const curr = CURRENCIES[currencyCode] || { symbol: currencyCode + ' ', code: currencyCode };
    const formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${curr.symbol}${formattedNum}`;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.BB_DATA = {
    STORAGE_KEY_SAVE_SLOTS,
    STORAGE_KEY_ACTIVE_SLOT_ID,
    STORAGE_KEY_WALLETS,
    STORAGE_KEY_CATEGORIES,
    STORAGE_KEY_TRANSACTIONS,
    STORAGE_KEY_SETTINGS,
    STORAGE_KEY_DEBTS,
    STORAGE_KEY_BILLS,
    STORAGE_KEY_SEEN_ONBOARDING,
    STORAGE_KEY_PIN_HASH,
    STORAGE_KEY_PIN_ENABLED,
    STORAGE_KEY_CUSTOM_RATES,
    STORAGE_KEY_LAST_SAVED,
    CURRENCIES,
    DEFAULT_CATEGORIES,
    DEFAULT_WALLETS,
    SAMPLE_DEBTS,
    SAMPLE_BILLS,
    FALLBACK_USD_RATES,
    THEME_PALETTES,
    getRelativeDateString,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  };

  window.BB_STATE = {
    saveSlots: [],
    activeSlotId: 'slot_default',
    wallets: [],
    activeWalletId: null,
    categories: [],
    transactions: [],
    debts: [],
    bills: [],
    selectedSimDebtIds: [],
    snowballStrategy: 'snowball',
    extraMonthlyPayment: 0,
    lumpSumAdvancePayment: 0,
    activeDebtTab: 'my_debts',
    activeReportTab: 'expense',
    reportWalletFilter: 'all',
    reportTimeframe: 'all',
    reportChartType: 'doughnut',
    settings: {
      baseCurrency: 'PHP',
      theme: 'deep_teal',
      dateFormat: 'YYYY-MM-DD',
      autoSaveInterval: 5,
      soundEffects: false,
      hapticFeedback: false,
      pinLockEnabled: false,
      showSpendingBuffer: true,
      lastSaved: null
    },
    fxRates: { ...FALLBACK_USD_RATES },
    fxLastFetched: null,
    heroCarouselIndex: 0,
    heroCarouselTimer: null
  };
})(window);
