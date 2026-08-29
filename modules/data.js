/**
 * Bantay Barya - Constants, Currencies, Sample Data & Formatting Helpers
 */
(function (window) {
  'use strict';

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
      id: 'wallet_bpi',
      name: 'BPI Checking',
      currency: 'PHP',
      type: 'bank',
      icon: '🏦',
      initialBalance: 45000.00,
      createdAt: Date.now() - 3600000
    },
    {
      id: 'wallet_gcash',
      name: 'GCash Wallet',
      currency: 'PHP',
      type: 'ewallet',
      icon: '📱',
      initialBalance: 8500.00,
      createdAt: Date.now() - 2400000
    },
    {
      id: 'wallet_cash',
      name: 'Cash on Hand',
      currency: 'PHP',
      type: 'cash',
      icon: '💵',
      initialBalance: 3200.00,
      createdAt: Date.now() - 1200000
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
      id: 'debt_sample_autoloan',
      name: 'Toyota Vios Auto Loan',
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
      id: 'debt_sample_creditcard',
      name: 'BDO Gold Mastercard',
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
    USD: 1.0,
    PHP: 58.50,
    EUR: 0.92,
    JPY: 154.50,
    GBP: 0.79,
    SGD: 1.35,
    AUD: 1.52,
    CAD: 1.36,
    HKD: 7.82,
    CNY: 7.24,
    KRW: 1375.0,
    THB: 36.80,
    AED: 3.67
  };

  const THEME_PALETTES = {
    deep_teal: {
      name: 'Deep Teal',
      primary: '#0f766e',
      primaryLight: '#ccfbf1',
      primaryDark: '#115e59',
      accent: '#0d9488',
      bgGradient: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
      heroBg: 'linear-gradient(135deg, #134e4a 0%, #042f2e 100%)',
      chartTheme: ['#0f766e', '#14b8a6', '#5eead4', '#2dd4bf', '#042f2e', '#0d9488']
    },
    emerald_slate: {
      name: 'Emerald Slate',
      primary: '#059669',
      primaryLight: '#d1fae5',
      primaryDark: '#065f46',
      accent: '#10b981',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
      heroBg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
      chartTheme: ['#059669', '#10b981', '#6ee7b7', '#34d399', '#022c22', '#047857']
    },
    navy_blue: {
      name: 'Navy Blue',
      primary: '#1d4ed8',
      primaryLight: '#dbeafe',
      primaryDark: '#1e40af',
      accent: '#3b82f6',
      bgGradient: 'linear-gradient(135deg, #1d4ed8 0%, #172554 100%)',
      heroBg: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      chartTheme: ['#1d4ed8', '#3b82f6', '#93c5fd', '#60a5fa', '#0f172a', '#1e40af']
    },
    royal_purple: {
      name: 'Royal Purple',
      primary: '#7c3aed',
      primaryLight: '#ede9fe',
      primaryDark: '#5b21b6',
      accent: '#8b5cf6',
      bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #3b0764 100%)',
      heroBg: 'linear-gradient(135deg, #581c87 0%, #1e1b4b 100%)',
      chartTheme: ['#7c3aed', '#8b5cf6', '#c4b5fd', '#a78bfa', '#1e1b4b', '#6d28d9']
    },
    sunset_amber: {
      name: 'Sunset Amber',
      primary: '#d97706',
      primaryLight: '#fef3c7',
      primaryDark: '#92400e',
      accent: '#f59e0b',
      bgGradient: 'linear-gradient(135deg, #d97706 0%, #451a03 100%)',
      heroBg: 'linear-gradient(135deg, #78350f 0%, #291205 100%)',
      chartTheme: ['#d97706', '#f59e0b', '#fcd34d', '#fbbf24', '#291205', '#b45309']
    },
    crimson_ruby: {
      name: 'Crimson Ruby',
      primary: '#e11d48',
      primaryLight: '#ffe4e6',
      primaryDark: '#9f1239',
      accent: '#f43f5e',
      bgGradient: 'linear-gradient(135deg, #e11d48 0%, #4c0519 100%)',
      heroBg: 'linear-gradient(135deg, #881337 0%, #1c0209 100%)',
      chartTheme: ['#e11d48', '#f43f5e', '#fda4af', '#fb7185', '#1c0209', '#be123c']
    },
    charcoal_onyx: {
      name: 'Charcoal Onyx',
      primary: '#334155',
      primaryLight: '#f1f5f9',
      primaryDark: '#0f172a',
      accent: '#475569',
      bgGradient: 'linear-gradient(135deg, #334155 0%, #020617 100%)',
      heroBg: 'linear-gradient(135deg, #1e293b 0%, #020617 100%)',
      chartTheme: ['#334155', '#64748b', '#cbd5e1', '#94a3b8', '#020617', '#475569']
    },
    sunflower: {
      name: 'Sunflower (Auto/Seasonal)',
      primary: '#0f766e',
      primaryLight: '#ccfbf1',
      primaryDark: '#115e59',
      accent: '#0d9488',
      bgGradient: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
      heroBg: 'linear-gradient(135deg, #134e4a 0%, #042f2e 100%)',
      chartTheme: ['#0f766e', '#14b8a6', '#5eead4', '#2dd4bf', '#042f2e', '#0d9488']
    }
  };

  const INSPIRATION_ITEMS = [
    {
      category: 'Ipon Tip (Savings Tip)',
      icon: '💡',
      text: 'Apply the 50-30-20 rule to your take-home pay: 50% for Needs, 30% for Wants, and at least 20% dedicated to Savings, Emergency Fund & Debt Payoff.',
      author: 'Bangko Sentral ng Pilipinas (BSP) Financial Literacy'
    },
    {
      category: 'Emergency Fund',
      icon: '🛡️',
      text: 'Prioritize building 3 to 6 months worth of essential living expenses in high-yield digital banks before exploring aggressive equity investments.',
      author: 'Personal Finance Philippines'
    },
    {
      category: 'Debt Strategy',
      icon: '❄️',
      text: 'The Debt Snowball method provides quick psychological wins by paying off the smallest balance first, boosting your motivation to stay debt-free.',
      author: 'Debt Elimination Principle'
    },
    {
      category: 'Avalanche Strategy',
      icon: '🏔️',
      text: 'The Debt Avalanche saves you the most money mathematically by aggressively eliminating debts with the highest monthly interest rate first.',
      author: 'Financial Optimization'
    },
    {
      category: 'Smart Spending',
      icon: '👛',
      text: 'Before making any unplanned purchase above ₱1,500, practice the 48-Hour Rule: wait two full days to see if it is a genuine need or an impulsive want.',
      author: 'Mindful Money Management'
    },
    {
      category: 'Multi-Wallet Tip',
      icon: '🎯',
      text: 'Use dedicated digital bank wallets for specific goals (e.g. Tax buffer, Travel fund, Annual insurance). Keep your daily spending wallet separate.',
      author: 'Bantay Barya Pro Tip'
    }
  ];

  const HERO_SLIDES = [
    {
      badge: '📈 Visual Health',
      title: 'Real-Time Financial Radar',
      desc: 'Interactive 30-day cashflow trajectories, expense category proportions, and net liquidity breakdown.'
    },
    {
      badge: '🛡️ Emergency Runway',
      title: 'FIFO Spending Buffer (Age of Money)',
      desc: 'Calculates how many days your cash buffer can sustain you without needing new incoming income.'
    },
    {
      badge: '🏔️ Utang Strategy',
      title: 'Snowball & Avalanche Engine',
      desc: 'Simulate exact monthly payoff timelines, total interest saved, and milestone eliminations.'
    },
    {
      badge: '🔔 Bill Due Reminders',
      title: 'Proactive Payment Schedules',
      desc: 'Never miss a due date with automated advance calculation and instant transaction posting.'
    }
  ];

  const SAMPLE_BILLS = [
    {
      id: 'bill_meralco_sample',
      name: 'Meralco Electric Bill',
      category: 'Utilities',
      amount: 3850.00,
      currency: 'PHP',
      walletId: 'wallet_bpi',
      dueDate: getRelativeDateString(5),
      anchorDay: 5,
      isRecurring: true,
      frequency: 'monthly',
      notifyDaysBefore: 3,
      status: 'unpaid',
      lastPaidDate: null,
      autoPostTx: true,
      notes: 'Monthly electric power consumption',
      createdAt: Date.now() - 120000
    },
    {
      id: 'bill_pldt_sample',
      name: 'PLDT Fiber Internet',
      category: 'Telecom & Internet',
      amount: 1699.00,
      currency: 'PHP',
      walletId: 'wallet_gcash',
      dueDate: getRelativeDateString(12),
      anchorDay: 12,
      isRecurring: true,
      frequency: 'monthly',
      notifyDaysBefore: 2,
      status: 'unpaid',
      lastPaidDate: null,
      autoPostTx: true,
      notes: 'Fiber 200Mbps Home Plan',
      createdAt: Date.now() - 100000
    },
    {
      id: 'bill_spotify_sample',
      name: 'Spotify Premium Family',
      category: 'Subscriptions',
      amount: 549.00,
      currency: 'PHP',
      walletId: 'wallet_bpi',
      dueDate: getRelativeDateString(18),
      anchorDay: 18,
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
    detectedPlatform: 'desktop'
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
