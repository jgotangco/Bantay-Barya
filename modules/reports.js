/**
 * Bantay Barya - Financial Reports, Balance Sheet & Data Export/Import
 */
(function (window) {
  'use strict';

  const {
    CURRENCIES,
    DEFAULT_WALLETS,
    DEFAULT_CATEGORIES,
    SAMPLE_DEBTS,
    SAMPLE_BILLS,
    getRelativeDateString,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;
  let chartInstance = null;

  const REPORT_MULTI_COLORS = [
    '#2563eb', '#e11d48', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#06b6d4', '#ea580c', '#14b8a6', '#6366f1', '#84cc16', '#a855f7',
    '#0284c7', '#d97706', '#059669', '#dc2626', '#4f46e5', '#7c3aed',
    '#0891b2', '#ca8a04', '#db2777', '#16a34a', '#f97316', '#9333ea'
  ];

  function setupReportListeners() {
    const reportModal = document.getElementById('reportModal');
    document.getElementById('openReportBtn')?.addEventListener('click', () => {
      if (window.BB_WALLETS) window.BB_WALLETS.populateWalletDropdowns();
      reportModal?.classList.add('active');
      switchReportTab(state.activeReportTab || 'expense');
    });

    const closeReport = () => reportModal?.classList.remove('active');
    document.getElementById('closeReportModalBtn')?.addEventListener('click', closeReport);
    document.getElementById('closeReportModalFooterBtn')?.addEventListener('click', closeReport);
    reportModal?.addEventListener('click', (e) => {
      if (e.target === reportModal) closeReport();
    });

    document.getElementById('tabBtnExpenseReport')?.addEventListener('click', () => switchReportTab('expense'));
    document.getElementById('tabBtnBalanceSheet')?.addEventListener('click', () => switchReportTab('balance_sheet'));

    document.getElementById('reportWalletSelect')?.addEventListener('change', (e) => {
      state.reportWalletFilter = e.target.value;
      renderExpenseReport();
    });

    document.getElementById('reportTimeframeSelect')?.addEventListener('change', (e) => {
      state.reportTimeframe = e.target.value;
      renderExpenseReport();
    });

    document.getElementById('chartTypePieBtn')?.addEventListener('click', () => setChartType('pie'));
    document.getElementById('chartTypeDoughnutBtn')?.addEventListener('click', () => setChartType('doughnut'));
    document.getElementById('chartTypeBarBtn')?.addEventListener('click', () => setChartType('bar'));

    document.getElementById('printReportBtn')?.addEventListener('click', () => {
      switchReportTab('balance_sheet');
      renderBalanceSheet();
      setTimeout(() => {
        window.print();
      }, 100);
    });
  }

  function switchReportTab(tabName) {
    state.activeReportTab = tabName;
    const tabBtnExp = document.getElementById('tabBtnExpenseReport');
    const tabBtnBs = document.getElementById('tabBtnBalanceSheet');
    const viewExp = document.getElementById('reportTabExpenseView');
    const viewBs = document.getElementById('reportTabBalanceSheetView');
    const printText = document.getElementById('printReportBtnText');

    if (tabName === 'expense') {
      if (tabBtnExp) tabBtnExp.classList.add('active');
      if (tabBtnBs) tabBtnBs.classList.remove('active');
      if (viewExp) viewExp.style.display = 'flex';
      if (viewBs) viewBs.style.display = 'none';
      if (printText) printText.textContent = 'Print Balance Sheet';
      renderExpenseReport();
    } else {
      if (tabBtnExp) tabBtnExp.classList.remove('active');
      if (tabBtnBs) tabBtnBs.classList.add('active');
      if (viewExp) viewExp.style.display = 'none';
      if (viewBs) viewBs.style.display = 'block';
      if (printText) printText.textContent = 'Print Balance Sheet';
      renderBalanceSheet();
    }
  }

  function setChartType(type) {
    state.reportChartType = type;
    const pieBtn = document.getElementById('chartTypePieBtn');
    const doughBtn = document.getElementById('chartTypeDoughnutBtn');
    const barBtn = document.getElementById('chartTypeBarBtn');

    [pieBtn, doughBtn, barBtn].forEach(b => b?.classList.remove('active'));
    if (type === 'pie') pieBtn?.classList.add('active');
    if (type === 'doughnut') doughBtn?.classList.add('active');
    if (type === 'bar') barBtn?.classList.add('active');
    renderExpenseReport();
  }

  function renderExpenseReport() {
    const now = new Date();
    let expenseTx = state.transactions.filter(tx => (parseFloat(tx.debit) || 0) > 0);

    const rWallet = state.reportWalletFilter || 'all';
    if (rWallet !== 'all') {
      expenseTx = expenseTx.filter(tx => tx.walletId === rWallet);
    }

    if (state.reportTimeframe !== 'all') {
      expenseTx = expenseTx.filter((tx) => {
        if (!tx.date) return true;
        const txDate = new Date(tx.date);
        if (state.reportTimeframe === 'this_month') {
          return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
        } else if (state.reportTimeframe === 'last_30') {
          const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        } else if (state.reportTimeframe === 'this_year') {
          return txDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    const categoryTotals = {};
    const categoryCounts = {};
    let totalDebitExpense = 0;

    expenseTx.forEach((tx) => {
      const rawCategory = (tx.item || 'Unclassified').trim();
      const cat = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
      const debitVal = parseFloat(tx.debit) || 0;

      categoryTotals[cat] = (categoryTotals[cat] || 0) + debitVal;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      totalDebitExpense += debitVal;
    });

    const reportTotalDebit = document.getElementById('reportTotalDebit');
    const reportCategoryCount = document.getElementById('reportCategoryCount');
    const canvas = document.getElementById('expensePieChart');
    const empty = document.getElementById('chartEmptyState');
    const tableBody = document.getElementById('breakdownTableBody');

    if (reportTotalDebit) reportTotalDebit.textContent = formatCurrency(totalDebitExpense);
    const distinctCategories = Object.keys(categoryTotals);
    if (reportCategoryCount) reportCategoryCount.textContent = distinctCategories.length;

    if (distinctCategories.length === 0 || totalDebitExpense === 0) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      if (canvas) canvas.style.display = 'none';
      if (empty) empty.style.display = 'block';
      if (tableBody) {
        tableBody.innerHTML = `
          <tr><td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-muted);">No debit expense transactions recorded for this period.</td></tr>
        `;
      }
      return;
    }

    if (canvas) canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const sortedCategories = distinctCategories
      .map(cat => ({
        name: cat,
        total: categoryTotals[cat],
        count: categoryCounts[cat],
        percent: ((categoryTotals[cat] / totalDebitExpense) * 100)
      }))
      .sort((a, b) => b.total - a.total);

    let tableHtml = '';
    sortedCategories.forEach((item, index) => {
      const color = REPORT_MULTI_COLORS[index % REPORT_MULTI_COLORS.length];
      tableHtml += `
        <tr>
          <td>
            <span class="category-dot" style="background-color: ${color}"></span>
            <strong>${escapeHtml(item.name)}</strong>
          </td>
          <td class="text-right font-mono debit-text">${formatCurrency(item.total)}</td>
          <td class="text-right font-mono">${item.percent.toFixed(1)}%</td>
          <td class="text-center font-mono">${item.count}</td>
        </tr>
      `;
    });
    if (tableBody) tableBody.innerHTML = tableHtml;

    renderChartJs(sortedCategories, totalDebitExpense);
  }

  function renderChartJs(dataItems, totalExpense) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const canvas = document.getElementById('expensePieChart');
    if (!canvas) return;

    const labels = dataItems.map(d => d.name);
    const values = dataItems.map(d => d.total);
    const colors = dataItems.map((_, i) => REPORT_MULTI_COLORS[i % REPORT_MULTI_COLORS.length]);

    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isDark = activeTheme !== 'light' && activeTheme !== 'sakura' && activeTheme !== 'sunflower';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const baseSymbol = CURRENCIES[state.settings.baseCurrency]?.symbol || '₱';

    const ctx = canvas.getContext('2d');

    const config = {
      type: state.reportChartType === 'bar' ? 'bar' : (state.reportChartType === 'doughnut' ? 'doughnut' : 'pie'),
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: isDark ? '#111827' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            position: state.reportChartType === 'bar' ? 'none' : 'bottom',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                const val = context.raw || 0;
                const percentage = ((val / totalExpense) * 100).toFixed(1);
                return ` ${context.label}: ${baseSymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    if (state.reportChartType === 'bar') {
      config.options.plugins.legend.display = false;
      config.options.scales = {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (v) => baseSymbol + v
          }
        }
      };
    }

    chartInstance = new Chart(ctx, config);
  }

  function updateChartThemeColors() {
    if (!chartInstance) return;
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isDark = activeTheme !== 'light' && activeTheme !== 'sakura' && activeTheme !== 'sunflower';
    const textColor = isDark ? '#f8fafc' : '#0f172a';

    if (chartInstance.options.plugins.legend) {
      chartInstance.options.plugins.legend.labels.color = textColor;
    }
    if (chartInstance.options.scales) {
      if (chartInstance.options.scales.x) chartInstance.options.scales.x.ticks.color = textColor;
      if (chartInstance.options.scales.y) chartInstance.options.scales.y.ticks.color = textColor;
    }
    chartInstance.update();
  }

  function renderBalanceSheet() {
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const baseSymbol = CURRENCIES[baseCurr]?.symbol || '₱';
    const userName = state.settings.userName ? state.settings.userName : 'Personal Financial Ledger';

    const bsUser = document.getElementById('bsUserNameDisplay');
    const bsDate = document.getElementById('bsAsOfDateDisplay');
    const bsCurr = document.getElementById('bsCurrencyDisplay');

    if (bsUser) bsUser.textContent = `Entity: ${userName}`;
    if (bsDate) {
      const now = new Date();
      bsDate.textContent = `As of: ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
    if (bsCurr) bsCurr.textContent = `Currency: Base ${baseCurr} (${baseSymbol})`;

    let totalAssets = 0;
    let assetsHtml = '';

    const assetCategories = [
      { id: 'liquid', title: 'Liquid Cash, E-Wallets & Operating Accounts', types: ['ewallet', 'spending', 'cash', 'current'] },
      { id: 'savings', title: 'High-Yield Savings & Reserves', types: ['savings'] },
      { id: 'fixed_income', title: 'Time Deposits & Fixed Income (Bonds/RTB)', types: ['time_deposit', 'bond'] },
      { id: 'investments', title: 'Equities & Investment Portfolios', types: ['investment'] },
      { id: 'crypto', title: 'Cryptocurrency & Digital Assets', types: ['crypto'] },
      { id: 'real_estate', title: 'Real Estate & Capital Assets', types: ['real_estate', 'other'] }
    ];

    assetCategories.forEach(cat => {
      const matchingWallets = state.wallets.filter(w => cat.types.includes(w.type) && (window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(w.id) >= 0 : true));
      if (matchingWallets.length > 0) {
        let catSubtotal = 0;
        let rowsHtml = '';

        matchingWallets.forEach(w => {
          const bal = window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(w.id) : 0;
          const convertedBal = window.BB_WALLETS ? window.BB_WALLETS.getWalletBaseConvertedBalance(w.id) : bal;
          const wCurr = w.currency || baseCurr;
          catSubtotal += convertedBal;
          totalAssets += convertedBal;

          const isForeign = wCurr !== baseCurr;
          const fxRateNote = isForeign
            ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${formatForeignCurrency(bal, wCurr)} @ ${window.BB_WALLETS.getFxRate(wCurr, baseCurr).toFixed(2)} / ${wCurr}</div>`
            : '';

          rowsHtml += `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <span>${w.icon || (window.BB_WALLETS ? window.BB_WALLETS.getWalletIcon(w.type) : '👛')}</span>
                  <div>
                    <strong>${escapeHtml(w.name)}</strong>
                    ${fxRateNote}
                  </div>
                </div>
              </td>
              <td><span class="asset-type-badge ${w.type}">${window.BB_WALLETS ? window.BB_WALLETS.getWalletTypeLabel(w.type) : 'Asset'}</span></td>
              <td class="text-right font-mono" style="font-weight: 600;">${formatCurrency(convertedBal)}</td>
            </tr>
          `;
        });

        assetsHtml += `
          <tr class="statement-category-header-row" style="background-color: var(--bg-surface-subtle); border-top: 1px solid var(--border-color);">
            <td colspan="2" style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">
              ${cat.title}
            </td>
            <td class="text-right font-mono" style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">
              ${formatCurrency(catSubtotal)}
            </td>
          </tr>
          ${rowsHtml}
        `;
      }
    });

    if (!assetsHtml) {
      assetsHtml = `<tr><td colspan="3" class="text-center text-muted" style="padding: 1rem;">No asset accounts with positive balances.</td></tr>`;
    }

    const bsAssetsTableBody = document.getElementById('bsAssetsTableBody');
    const bsTotalAssets = document.getElementById('bsTotalAssets');
    if (bsAssetsTableBody) bsAssetsTableBody.innerHTML = assetsHtml;
    if (bsTotalAssets) bsTotalAssets.innerHTML = `<strong>${formatCurrency(totalAssets)}</strong>`;

    let totalLiabilities = 0;
    let liabilitiesHtml = '';

    state.wallets.forEach(w => {
      const bal = window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(w.id) : 0;
      if (bal < 0) {
        const debt = Math.abs(window.BB_WALLETS.getWalletBaseConvertedBalance(w.id));
        totalLiabilities += debt;
        liabilitiesHtml += `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <span>${w.icon || '💳'}</span>
                <strong>${escapeHtml(w.name)} (Account Overdraft)</strong>
              </div>
            </td>
            <td class="text-right font-mono debit-text">${formatCurrency(debt)}</td>
          </tr>
        `;
      }
    });

    state.debts.forEach(d => {
      const bal = parseFloat(d.balance) || 0;
      if (bal > 0) {
        totalLiabilities += bal;
        const icon = d.icon || (window.BB_DEBTS ? window.BB_DEBTS.getDebtIcon(d.type) : '💳');
        const typeLabel = window.BB_DEBTS ? window.BB_DEBTS.getDebtTypeLabel(d.type) : 'Debt';
        const eir = parseFloat(d.apr) || 0;
        const monthlyRate = d.monthlyRate !== undefined ? parseFloat(d.monthlyRate) : (eir / 12);

        liabilitiesHtml += `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <span>${icon}</span>
                <div>
                  <strong>${escapeHtml(d.name)}</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 4px;">(${typeLabel}, ${monthlyRate.toFixed(2)}%/mo | ${eir.toFixed(2)}% EIR)</span>
                </div>
              </div>
            </td>
            <td class="text-right font-mono debit-text" style="font-weight: 600;">${formatCurrency(bal)}</td>
          </tr>
        `;
      }
    });

    if (!liabilitiesHtml) {
      liabilitiesHtml = `
        <tr>
          <td><span style="color: var(--credit-color); font-weight: 600;">✓ 100% Debt-Free / No Outstanding Liabilities</span></td>
          <td class="text-right font-mono text-muted">${formatCurrency(0)}</td>
        </tr>
      `;
    }

    const bsLiabTableBody = document.getElementById('bsLiabilitiesTableBody');
    const bsTotalLiab = document.getElementById('bsTotalLiabilities');
    if (bsLiabTableBody) bsLiabTableBody.innerHTML = liabilitiesHtml;
    if (bsTotalLiab) bsTotalLiab.textContent = formatCurrency(totalLiabilities);

    const startingCapital = state.wallets.reduce((acc, w) => acc + (window.BB_WALLETS ? window.BB_WALLETS.convertCurrency(parseFloat(w.initialBalance) || 0, w.currency || baseCurr, baseCurr) : 0), 0);
    const totalCredits = state.transactions.reduce((acc, tx) => acc + (parseFloat(tx.credit) || 0), 0);
    const totalDebits = state.transactions.reduce((acc, tx) => acc + (parseFloat(tx.debit) || 0), 0);
    const netSurplus = totalCredits - totalDebits;

    const reconcileTxs = state.transactions.filter(t => (t.item || '').toLowerCase().includes('reconcil'));
    const netReconciliation = reconcileTxs.reduce((acc, tx) => acc + (parseFloat(tx.credit) || 0) - (parseFloat(tx.debit) || 0), 0);

    const totalNetPosition = totalAssets - totalLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + totalNetPosition;

    const bsStartCap = document.getElementById('bsStartingCapital');
    const bsSurplus = document.getElementById('bsNetSurplus');
    const bsReconcile = document.getElementById('bsReconcileAdjustments');
    const bsNetPos = document.getElementById('bsTotalNetPosition');
    const bsTotalLiabEquity = document.getElementById('bsTotalLiabilitiesAndEquity');
    const bsBalanceCheck = document.getElementById('bsBalanceCheckBadge');

    if (bsStartCap) bsStartCap.textContent = formatCurrency(startingCapital);
    if (bsSurplus) {
      bsSurplus.textContent = (netSurplus >= 0 ? '+' : '') + formatCurrency(netSurplus);
      bsSurplus.style.color = netSurplus >= 0 ? 'var(--credit-color)' : 'var(--debit-color)';
    }

    if (bsReconcile) bsReconcile.textContent = (netReconciliation >= 0 ? '+' : '') + formatCurrency(netReconciliation);
    if (bsNetPos) {
      bsNetPos.innerHTML = `<strong>${formatCurrency(totalNetPosition)}</strong>`;
      bsNetPos.style.color = totalNetPosition >= 0 ? 'var(--accent-primary)' : 'var(--debit-color)';
    }
    if (bsTotalLiabEquity) {
      bsTotalLiabEquity.innerHTML = `<strong>${formatCurrency(totalLiabilitiesAndEquity)}</strong>`;
    }

    if (bsBalanceCheck) {
      const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);
      if (diff < 0.01) {
        bsBalanceCheck.textContent = '✓ Fundamental Accounting Equation Balanced: Assets = Liabilities + Real Net Worth';
        bsBalanceCheck.style.color = 'var(--credit-color)';
      } else {
        bsBalanceCheck.textContent = '⚠️ Discrepancy detected in balance equation.';
        bsBalanceCheck.style.color = 'var(--debit-color)';
      }
    }
  }

  function openGuideModal(initialTab = 'ph_context') {
    switchGuideTab(initialTab);
    document.getElementById('guideModal')?.classList.add('active');
  }

  function switchGuideTab(tabName) {
    const btnPh = document.getElementById('guideTabBtnPhContext');
    const btnTut = document.getElementById('guideTabBtnTutorial');
    const btnPrac = document.getElementById('guideTabBtnPractices');

    const contentPh = document.getElementById('guideTabContentPhContext');
    const contentTut = document.getElementById('guideTabContentTutorial');
    const contentPrac = document.getElementById('guideTabContentPractices');

    [btnPh, btnTut, btnPrac].forEach(b => b?.classList.remove('active'));
    if (contentPh) contentPh.style.display = 'none';
    if (contentTut) contentTut.style.display = 'none';
    if (contentPrac) contentPrac.style.display = 'none';

    if (tabName === 'tutorial') {
      if (btnTut) btnTut.classList.add('active');
      if (contentTut) contentTut.style.display = 'flex';
    } else if (tabName === 'practices') {
      if (btnPrac) btnPrac.classList.add('active');
      if (contentPrac) contentPrac.style.display = 'flex';
    } else {
      if (btnPh) btnPh.classList.add('active');
      if (contentPh) contentPh.style.display = 'flex';
    }
  }

  function setupGuideModalListeners() {
    document.getElementById('openGuideModalBtn')?.addEventListener('click', () => openGuideModal('ph_context'));
    document.getElementById('welcomeOpenGuideBtn')?.addEventListener('click', () => {
      document.getElementById('welcomeModal')?.classList.remove('active');
      openGuideModal('ph_context');
    });
    document.getElementById('aboutOpenGuideBtn')?.addEventListener('click', () => {
      document.getElementById('aboutModal')?.classList.remove('active');
      openGuideModal('ph_context');
    });

    const closeGuide = () => document.getElementById('guideModal')?.classList.remove('active');
    document.getElementById('closeGuideModalBtn')?.addEventListener('click', closeGuide);
    document.getElementById('closeGuideModalFooterBtn')?.addEventListener('click', closeGuide);
    document.getElementById('guideModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('guideModal')) closeGuide();
    });

    document.getElementById('guideTabBtnPhContext')?.addEventListener('click', () => switchGuideTab('ph_context'));
    document.getElementById('guideTabBtnTutorial')?.addEventListener('click', () => switchGuideTab('tutorial'));
    document.getElementById('guideTabBtnPractices')?.addEventListener('click', () => switchGuideTab('practices'));
  }

  function setupExportImportListeners() {
    const exportDropdown = document.getElementById('exportDropdown');
    document.getElementById('exportMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown?.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      exportDropdown?.classList.remove('show');
    });

    document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportLedgerCsv());
    document.getElementById('exportSheetsBtn')?.addEventListener('click', () => copyForGoogleSheets());
    document.getElementById('exportJsonBtn')?.addEventListener('click', () => exportLedgerJson());
    document.getElementById('importJsonInput')?.addEventListener('change', handleFileImport);
    document.getElementById('loadSampleDataBtn')?.addEventListener('click', () => loadSampleData());

    document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all Bantay Barya records to 0 balance? This cannot be undone.')) {
        state.transactions = [];
        state.wallets = [...DEFAULT_WALLETS];
        state.wallets[0].initialBalance = 0;
        if (window.BB_WALLETS) {
          window.BB_WALLETS.recalculateLedgerBalances();
          window.BB_WALLETS.populateWalletDropdowns();
        }
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('All transactions cleared. Balance reset to ₱0.00.', 'info');
      }
    });
  }

  function exportLedgerCsv() {
    const sorted = [...state.transactions].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return a.date.localeCompare(b.date);
    });

    const baseCurr = state.settings.baseCurrency || 'PHP';
    const headers = [
      'Date', 'Wallet', 'Expense Item / Classification',
      `Credit (${baseCurr})`, `Debit (${baseCurr})`,
      `Wallet Balance (${baseCurr})`, `Total Net Balance (${baseCurr})`,
      'Input Currency', 'Input Amount', 'Exchange Rate', 'Notes'
    ];

    const rows = sorted.map(tx => {
      const w = window.BB_WALLETS ? window.BB_WALLETS.getWallet(tx.walletId) : null;
      return [
        `"${tx.date}"`,
        `"${(w ? w.name : 'Main Wallet').replace(/"/g, '""')}"`,
        `"${(tx.item || '').replace(/"/g, '""')}"`,
        parseFloat(tx.credit || 0).toFixed(2),
        parseFloat(tx.debit || 0).toFixed(2),
        parseFloat(tx.walletRunningBalance || 0).toFixed(2),
        parseFloat(tx.runningBalance || 0).toFixed(2),
        `"${tx.inputCurrency || baseCurr}"`,
        parseFloat(tx.inputAmount || (tx.credit > 0 ? tx.credit : tx.debit) || 0).toFixed(2),
        parseFloat(tx.exchangeRate || 1.0).toFixed(4),
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bantay_Barya_MultiWallet_Ledger_${baseCurr}_${getRelativeDateString(0)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Multi-Wallet CSV exported successfully!', 'success');
  }

  function copyForGoogleSheets() {
    const sorted = [...state.transactions].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return a.date.localeCompare(b.date);
    });

    const baseCurr = state.settings.baseCurrency || 'PHP';
    const headers = [
      'Date', 'Wallet', 'Classification',
      `Credit (${baseCurr})`, `Debit (${baseCurr})`,
      `Wallet Balance (${baseCurr})`, `Net Balance (${baseCurr})`,
      'Currency', 'Amount', 'FX Rate', 'Notes'
    ];

    const tsvRows = sorted.map(tx => {
      const w = window.BB_WALLETS ? window.BB_WALLETS.getWallet(tx.walletId) : null;
      return [
        tx.date || '',
        w ? w.name : 'Main Wallet',
        tx.item || '',
        parseFloat(tx.credit || 0).toFixed(2),
        parseFloat(tx.debit || 0).toFixed(2),
        parseFloat(tx.walletRunningBalance || 0).toFixed(2),
        parseFloat(tx.runningBalance || 0).toFixed(2),
        tx.inputCurrency || baseCurr,
        parseFloat(tx.inputAmount || (tx.credit > 0 ? tx.credit : tx.debit) || 0).toFixed(2),
        parseFloat(tx.exchangeRate || 1.0).toFixed(4),
        tx.notes || ''
      ].join('\t');
    });

    const fullTsv = [headers.join('\t'), ...tsvRows].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullTsv)
        .then(() => {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Copied to clipboard! Open Google Sheets and press Ctrl+V to paste.', 'success');
        })
        .catch(() => fallbackCopyText(fullTsv));
    } else {
      fallbackCopyText(fullTsv);
    }
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Copied for Google Sheets! Paste with Ctrl+V.', 'success');
    } catch (e) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Please copy from the CSV export file.', 'info');
    }
    document.body.removeChild(textarea);
  }

  function exportLedgerJson(filenamePrefix = 'Bantay_Barya_Backup') {
    const backupData = {
      appName: 'Bantay Barya',
      author: 'Jerome Gotangco (jeromesg@google.com)',
      disclaimer: 'Personal work of the author, not affiliated with or endorsed by Google or any other party.',
      website: 'https://antigravity.google/',
      version: '7.0',
      exportedAt: new Date().toISOString(),
      baseCurrency: state.settings.baseCurrency,
      saveSlots: state.saveSlots,
      activeSlotId: state.activeSlotId,
      wallets: state.wallets,
      debts: state.debts,
      bills: state.bills,
      categories: state.categories,
      settings: state.settings,
      transactions: state.transactions
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `${filenamePrefix}_${getRelativeDateString(0)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Bantay Barya Multi-Wallet JSON backup exported!', 'success');
  }

  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.barya')) {
      if (window.BB_WALLETS) window.BB_WALLETS.importBaryaFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (parsed.transactions && Array.isArray(parsed.transactions)) {
            state.transactions = parsed.transactions;
            if (parsed.wallets && Array.isArray(parsed.wallets)) {
              state.wallets = parsed.wallets;
            } else if (!state.wallets || state.wallets.length === 0) {
              state.wallets = [...DEFAULT_WALLETS];
            }
            if (parsed.debts && Array.isArray(parsed.debts)) state.debts = parsed.debts;
            if (parsed.bills && Array.isArray(parsed.bills)) state.bills = parsed.bills;
            if (parsed.settings) state.settings = parsed.settings;
            if (parsed.categories && Array.isArray(parsed.categories)) state.categories = parsed.categories;
            if (parsed.saveSlots && Array.isArray(parsed.saveSlots)) state.saveSlots = parsed.saveSlots;
            if (parsed.activeSlotId) state.activeSlotId = parsed.activeSlotId;

            state.transactions.forEach(t => {
              if (!t.walletId) t.walletId = state.wallets[0]?.id || 'wallet_default';
            });

            if (window.BB_CORE) {
              window.BB_CORE.updateCategoryDatalists();
              window.BB_CORE.updateFxRateAndConversion();
            }
            if (window.BB_WALLETS) {
              window.BB_WALLETS.populateWalletDropdowns();
              window.BB_WALLETS.recalculateLedgerBalances();
            }
            if (window.BB_BILLS) {
              window.BB_BILLS.checkBillDueNotifications();
              window.BB_BILLS.renderBillsTable();
            }
            const baseSelect = document.getElementById('baseCurrencySelect');
            const txSelect = document.getElementById('txCurrencySelect');
            const nameInput = document.getElementById('settingsUserNameInput');

            if (baseSelect) baseSelect.value = state.settings.baseCurrency || 'PHP';
            if (txSelect) txSelect.value = state.settings.baseCurrency || 'PHP';
            if (nameInput) nameInput.value = state.settings.userName || '';
            if (window.BB_THEME) window.BB_THEME.updateTimeGreeting();

            if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Restored ${parsed.transactions.length} transactions across ${state.wallets.length} wallets!`, 'success');
          } else {
            if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Invalid JSON ledger backup format.', 'error');
          }
        }
      } catch (err) {
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Error importing backup file: ' + err.message, 'error');
      }

      const input = document.getElementById('importJsonInput');
      if (input) input.value = '';
      const driveInput = document.getElementById('loadFromDriveInput');
      if (driveInput) driveInput.value = '';
      const welcomeInput = document.getElementById('welcomeImportInput');
      if (welcomeInput) welcomeInput.value = '';
    };
    reader.readAsText(file);
  }

  function loadSampleData() {
    const baseTimestamp = Date.now();
    state.wallets = [
      { id: 'wallet_spending', name: 'Personal Spending', type: 'spending', currency: 'PHP', icon: '👛', initialBalance: 15000.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_ewallet', name: 'GCash / Maya Super App', type: 'ewallet', currency: 'PHP', icon: '📱', initialBalance: 8500.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_savings', name: 'High-Yield Savings (SeaBank / Maya)', type: 'savings', currency: 'PHP', icon: '🏦', initialBalance: 50000.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_crypto', name: 'Crypto Portfolio (BTC / ETH / SOL)', type: 'crypto', currency: 'USD', icon: '🪙', initialBalance: 3500.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_stocks', name: 'US Equities & ETFs (GoTrade / PSEi)', type: 'investment', currency: 'USD', icon: '📈', initialBalance: 5000.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_td', name: 'Maya 6.0% p.a. Time Deposit', type: 'time_deposit', currency: 'PHP', icon: '⏳', initialBalance: 100000.00, createdAt: baseTimestamp - 70 * 86400000 },
      { id: 'wallet_cash', name: 'Physical Cash on Hand', type: 'cash', currency: 'PHP', icon: '💵', initialBalance: 5000.00, createdAt: baseTimestamp - 70 * 86400000 }
    ];

    state.transactions = [
      { id: 'tx_demo_1', walletId: 'wallet_spending', date: getRelativeDateString(-65), item: 'Balance Brought Forward', type: 'credit', inputCurrency: 'PHP', inputAmount: 15000.00, exchangeRate: 1.0, credit: 15000.00, debit: 0, notes: 'Initial personal spending balance', createdAt: baseTimestamp - 65 * 86400000 },
      { id: 'tx_demo_2', walletId: 'wallet_savings', date: getRelativeDateString(-55), item: 'Salary & Wages', type: 'credit', inputCurrency: 'PHP', inputAmount: 48000.00, exchangeRate: 1.0, credit: 48000.00, debit: 0, notes: 'Monthly earnings (Two months ago into savings)', createdAt: baseTimestamp - 55 * 86400000 },
      { id: 'tx_demo_3', walletId: 'wallet_spending', date: getRelativeDateString(-45), item: 'Rent & Housing', type: 'debit', inputCurrency: 'PHP', inputAmount: 15000.00, exchangeRate: 1.0, credit: 0, debit: 15000.00, notes: 'Apartment rent from spending wallet', createdAt: baseTimestamp - 45 * 86400000 },
      { id: 'tx_demo_4', walletId: 'wallet_savings', date: getRelativeDateString(-25), item: 'Salary & Wages', type: 'credit', inputCurrency: 'PHP', inputAmount: 48000.00, exchangeRate: 1.0, credit: 48000.00, debit: 0, notes: 'Monthly earnings (Last month into savings)', createdAt: baseTimestamp - 25 * 86400000 },
      { id: 'tx_demo_5', walletId: 'wallet_cash', date: getRelativeDateString(-18), item: 'Groceries', type: 'debit', inputCurrency: 'PHP', inputAmount: 2500.00, exchangeRate: 1.0, credit: 0, debit: 2500.00, notes: 'Farmers market groceries with cash', createdAt: baseTimestamp - 18 * 86400000 },
      { id: 'tx_demo_6', walletId: 'wallet_spending', date: getRelativeDateString(-12), item: 'Groceries', type: 'debit', inputCurrency: 'PHP', inputAmount: 4200.00, exchangeRate: 1.0, credit: 0, debit: 4200.00, notes: 'Supermarket supplies on card', createdAt: baseTimestamp - 12 * 86400000 },
      { id: 'tx_demo_7', walletId: 'wallet_savings', date: getRelativeDateString(-4), item: 'Balance Reconciliation', type: 'credit', inputCurrency: 'PHP', inputAmount: 650.00, exchangeRate: 1.0, credit: 650.00, debit: 0, notes: 'Bank interest credited to savings (+₱650.00)', createdAt: baseTimestamp - 4 * 86400000 },
      { id: 'tx_demo_8', walletId: 'wallet_cash', date: getRelativeDateString(-1), item: 'Dining & Food', type: 'debit', inputCurrency: 'PHP', inputAmount: 850.00, exchangeRate: 1.0, credit: 0, debit: 850.00, notes: 'Street food and coffee', createdAt: baseTimestamp - 1 * 86400000 },
      { id: 'tx_demo_9', walletId: 'wallet_spending', date: getRelativeDateString(0), item: 'Software & Subscriptions', type: 'debit', inputCurrency: 'USD', inputAmount: 20.00, exchangeRate: 58.50, credit: 0, debit: 1170.00, notes: 'Online productivity tools ($20 USD @ 58.50)', createdAt: baseTimestamp }
    ];

    state.debts = JSON.parse(JSON.stringify(SAMPLE_DEBTS));
    state.selectedSimDebtIds = state.debts.map(d => d.id);
    state.bills = JSON.parse(JSON.stringify(SAMPLE_BILLS));
    state.settings.baseCurrency = 'PHP';
    state.selectedWalletId = 'all';

    const baseSelect = document.getElementById('baseCurrencySelect');
    const txSelect = document.getElementById('txCurrencySelect');
    if (baseSelect) baseSelect.value = 'PHP';
    if (txSelect) txSelect.value = 'PHP';

    if (window.BB_CORE) {
      window.BB_CORE.updateCategoryDatalists();
      window.BB_CORE.updateFxRateAndConversion();
    }
    if (window.BB_WALLETS) {
      window.BB_WALLETS.populateWalletDropdowns();
      window.BB_WALLETS.recalculateLedgerBalances();
    }
    if (window.BB_BILLS) {
      window.BB_BILLS.checkBillDueNotifications();
      window.BB_BILLS.renderBillsTable();
    }
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Loaded multi-asset demo data: Crypto, Stocks, Maya TD, Bills & Loans!', 'success');
  }

  window.BB_REPORTS = {
    setupReportListeners,
    switchReportTab,
    setChartType,
    renderExpenseReport,
    updateChartThemeColors,
    renderBalanceSheet,
    openGuideModal,
    switchGuideTab,
    setupGuideModalListeners,
    setupExportImportListeners,
    exportLedgerCsv,
    copyForGoogleSheets,
    exportLedgerJson,
    handleFileImport,
    loadSampleData
  };
})(window);
