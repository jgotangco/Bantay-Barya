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
    '#7be3a8', '#1a7a8e', '#38bdf8', '#ff7b92', '#f59e0b', '#a78bfa',
    '#0d5e6e', '#34d399', '#f43f5e', '#60a5fa', '#ca8a04', '#2dd4bf',
    '#fb923c', '#c084fc', '#4ade80', '#0284c7', '#d97706', '#ec4899',
    '#059669', '#dc2626', '#4f46e5', '#7c3aed', '#0891b2', '#9333ea'
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
    let expenseTx = state.transactions.filter(tx => (parseFloat(tx.debit) || 0) > 0 && !tx.isTransfer && tx.type !== 'transfer_out' && !tx.isArchived);

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
    document.getElementById('closeGuideModalBtn')?.addEventListener('click', () => {
      document.getElementById('guideModal')?.classList.remove('active');
    });
    document.getElementById('closeGuideModalFooterBtn')?.addEventListener('click', () => {
      document.getElementById('guideModal')?.classList.remove('active');
    });

    document.getElementById('guideTabBtnPhContext')?.addEventListener('click', () => switchGuideTab('ph_context'));
    document.getElementById('guideTabBtnTutorial')?.addEventListener('click', () => switchGuideTab('tutorial'));
    document.getElementById('guideTabBtnPractices')?.addEventListener('click', () => switchGuideTab('practices'));

    const guideModal = document.getElementById('guideModal');
    guideModal?.addEventListener('click', (e) => {
      if (e.target === guideModal) guideModal.classList.remove('active');
    });
  }

  function setupExportImportListeners() {
    document.getElementById('exportJsonBtn')?.addEventListener('click', exportDataAsJson);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportDataAsCsv);
    document.getElementById('exportSaveVaultBtn')?.addEventListener('click', exportSaveVaultArchive);

    const importInput = document.getElementById('importFileInput');
    const importVaultInput = document.getElementById('importVaultFileInput');

    document.getElementById('importJsonBtn')?.addEventListener('click', () => importInput?.click());
    document.getElementById('importSaveVaultBtn')?.addEventListener('click', () => importVaultInput?.click());

    importInput?.addEventListener('change', handleFileImport);
    importVaultInput?.addEventListener('change', handleVaultImport);

    document.getElementById('demoDataBtn')?.addEventListener('click', () => {
      if (window.BB_CORE && window.BB_CORE.hasActiveSavedLedger()) {
        window.BB_CORE.showOverwriteWarningModal('sample');
        return;
      }
      if (confirm('Load demo transactions and wallets? Existing active data will be replaced.')) {
        loadDemoData();
      }
    });

    document.getElementById('welcomeLoadSampleBtn')?.addEventListener('click', () => {
      if (window.BB_CORE && window.BB_CORE.hasActiveSavedLedger()) {
        window.BB_CORE.showOverwriteWarningModal('sample');
        return;
      }
      loadDemoData();
      document.getElementById('welcomeModal')?.classList.remove('active');
    });
  }

  function exportDataAsJson() {
    const payload = {
      app: 'Bantay Barya',
      version: '7.0',
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      wallets: state.wallets,
      debts: state.debts,
      bills: state.bills,
      categories: state.categories,
      transactions: state.transactions
    };

    const str = JSON.stringify(payload, null, 2);
    downloadFile(str, `bantay_barya_ledger_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Ledger data exported successfully as JSON.', 'success');
  }

  function exportDataAsCsv() {
    const headers = ['ID', 'Date', 'Wallet', 'Item / Description', 'Debit (Expense)', 'Credit (Income)', 'Running Balance', 'Currency', 'Exchange Rate', 'Notes'];
    const rows = state.transactions.map(t => {
      const w = state.wallets.find(x => x.id === t.walletId);
      const wName = w ? w.name : 'Unknown';
      return [
        `"${t.id || ''}"`,
        `"${t.date || ''}"`,
        `"${wName.replace(/"/g, '""')}"`,
        `"${(t.item || '').replace(/"/g, '""')}"`,
        (parseFloat(t.debit) || 0).toFixed(2),
        (parseFloat(t.credit) || 0).toFixed(2),
        (parseFloat(t.runningBalance) || 0).toFixed(2),
        `"${t.originalCurrency || state.settings.baseCurrency || 'PHP'}"`,
        (parseFloat(t.exchangeRate) || 1.0).toFixed(4),
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    downloadFile(csvContent, `bantay_barya_transactions_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Transactions exported as CSV.', 'success');
  }

  function exportSaveVaultArchive() {
    if (window.BB_WALLETS?.syncActiveSlotPayload) window.BB_WALLETS.syncActiveSlotPayload();
    const vaultPayload = {
      app: 'Bantay Barya Save Vault',
      version: '7.0',
      vaultExportedAt: new Date().toISOString(),
      activeSlotId: state.activeSlotId,
      saveSlots: state.saveSlots
    };

    const str = JSON.stringify(vaultPayload, null, 2);
    downloadFile(str, `bantay_barya_vault_all_slots_${new Date().toISOString().slice(0, 10)}.barya`, 'application/json');
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('All save vault profiles exported as .barya archive!', 'success');
  }

  function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (window.BB_CORE && window.BB_CORE.hasActiveSavedLedger()) {
      window.BB_CORE.showOverwriteWarningModal('backup', file);
      e.target.value = '';
      return;
    }

    executeFileImport(file);
    e.target.value = '';
  }

  function executeFileImport(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.wallets && !data.transactions) {
          throw new Error('Invalid file format: missing wallets or transactions.');
        }

        state.wallets = Array.isArray(data.wallets) && data.wallets.length > 0 ? data.wallets : [...DEFAULT_WALLETS];
        state.transactions = Array.isArray(data.transactions) ? data.transactions : [];
        state.debts = Array.isArray(data.debts) ? data.debts : [];
        state.bills = Array.isArray(data.bills) ? data.bills : [];
        state.categories = Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : [...DEFAULT_CATEGORIES];
        if (data.settings) state.settings = { ...state.settings, ...data.settings };

        if (window.BB_WALLETS?.recalculateBalances) window.BB_WALLETS.recalculateBalances();
        if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
        if (window.BB_WALLETS?.renderWalletBar) window.BB_WALLETS.renderWalletBar();
        if (window.BB_CORE?.renderTable) window.BB_CORE.renderTable();
        if (window.BB_THEME?.renderAllHeroCharts) window.BB_THEME.renderAllHeroCharts();

        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.classList.remove('active');

        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Ledger successfully imported and restored!', 'success');
      } catch (err) {
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  function handleVaultImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.saveSlots || !Array.isArray(data.saveSlots)) {
          throw new Error('Invalid .barya save vault file format.');
        }

        if (confirm(`Import ${data.saveSlots.length} save vault slots from archive? Existing slots will be merged/updated.`)) {
          data.saveSlots.forEach(newSlot => {
            const idx = state.saveSlots.findIndex(s => s.id === newSlot.id);
            if (idx >= 0) state.saveSlots[idx] = newSlot;
            else state.saveSlots.push(newSlot);
          });

          if (window.BB_WALLETS?.persistSaveSlots) window.BB_WALLETS.persistSaveSlots();
          if (window.BB_WALLETS?.renderSaveSlotsUI) window.BB_WALLETS.renderSaveSlotsUI();
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Save vault slots imported successfully!', 'success');
        }
      } catch (err) {
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Vault import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function loadDemoData() {
    state.settings.userName = 'Jerome G.';
    state.settings.baseCurrency = 'PHP';

    state.wallets = [
      {
        id: 'wallet_bpi',
        name: 'BPI Preferred Checking',
        type: 'current',
        currency: 'PHP',
        icon: '🏦',
        initialBalance: 85000.00,
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
      },
      {
        id: 'wallet_maya',
        name: 'Maya High-Yield Savings (6.0%)',
        type: 'savings',
        currency: 'PHP',
        icon: '📱',
        initialBalance: 150000.00,
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
      },
      {
        id: 'wallet_gcash',
        name: 'GCash Everyday Spending',
        type: 'ewallet',
        currency: 'PHP',
        icon: '💳',
        initialBalance: 12500.00,
        createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000
      },
      {
        id: 'wallet_wise_usd',
        name: 'Wise USD Multi-Currency',
        type: 'current',
        currency: 'USD',
        icon: '🌐',
        initialBalance: 2400.00,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
      },
      {
        id: 'wallet_bdo_rtb',
        name: 'RTB-30 Treasury Bonds (5.75%)',
        type: 'bond',
        currency: 'PHP',
        icon: '📜',
        initialBalance: 100000.00,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
      }
    ];

    state.debts = [
      {
        id: 'debt_mortgage_sample',
        name: 'Avida Condo Mortgage (BPI)',
        type: 'mortgage',
        icon: '🏠',
        balance: 1850000.00,
        monthlyRate: 0.5625,
        apr: 6.75,
        minPayment: 16500.00,
        dueDate: 'Every 15th',
        notes: '20-year fixed home loan (6.75% EIR p.a.)',
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
      },
      {
        id: 'debt_auto_sample',
        name: 'Toyota Raize Auto Loan (TFS)',
        type: 'auto',
        icon: '🚗',
        balance: 380000.00,
        monthlyRate: 0.7083,
        apr: 8.50,
        minPayment: 9800.00,
        dueDate: 'Every 5th',
        notes: '5-year auto amortization (8.50% EIR p.a.)',
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000
      },
      {
        id: 'debt_cc_sample',
        name: 'BPI Visa Signature',
        type: 'credit_card',
        icon: '💳',
        balance: 45000.00,
        monthlyRate: 3.00,
        apr: 36.00,
        minPayment: 3500.00,
        dueDate: 'Every 22nd',
        notes: 'BSP standard credit card rate (3.0% / mo | 36.0% EIR)',
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
      }
    ];

    state.bills = SAMPLE_BILLS.map(b => ({ ...b }));

    state.transactions = [
      { id: 'tx_demo_01', walletId: 'wallet_bpi', date: getRelativeDateString(-25), item: 'Salary & Retainer (Client Tech Global)', type: 'credit', debit: 0, credit: 95000.00, runningBalance: 180000.00, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Monthly consulting retainer direct deposit', createdAt: Date.now() - 25 * 86400000 },
      { id: 'tx_demo_02', walletId: 'wallet_bpi', date: getRelativeDateString(-22), item: 'Rent & Housing', type: 'debit', debit: 28000.00, credit: 0, runningBalance: 152000.00, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Bonifacio Global City condo monthly lease', createdAt: Date.now() - 22 * 86400000 },
      { id: 'tx_demo_03', walletId: 'wallet_gcash', date: getRelativeDateString(-20), item: 'Groceries', type: 'debit', debit: 4850.50, credit: 0, runningBalance: 7649.50, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'S&R Membership Shopping BGC', createdAt: Date.now() - 20 * 86400000 },
      { id: 'tx_demo_04', walletId: 'wallet_bpi', date: getRelativeDateString(-18), item: 'Utilities & Bills', type: 'debit', debit: 5420.00, credit: 0, runningBalance: 146580.00, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Meralco electricity bill auto-debit', createdAt: Date.now() - 18 * 86400000 },
      { id: 'tx_demo_05', walletId: 'wallet_gcash', date: getRelativeDateString(-15), item: 'Dining & Food', type: 'debit', debit: 1650.00, credit: 0, runningBalance: 5999.50, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Family dinner at Wildflour Cafe', createdAt: Date.now() - 15 * 86400000 },
      { id: 'tx_demo_06', walletId: 'wallet_wise_usd', date: getRelativeDateString(-12), item: 'Consulting Fee', type: 'credit', debit: 0, credit: 1500.00, runningBalance: 3900.00, originalCurrency: 'USD', exchangeRate: 58.50, notes: 'US Enterprise architectural review retainer', createdAt: Date.now() - 12 * 86400000 },
      { id: 'tx_demo_07', walletId: 'wallet_wise_usd', date: getRelativeDateString(-10), item: 'Software & Subscriptions', type: 'debit', debit: 200.00, credit: 0, runningBalance: 3700.00, originalCurrency: 'USD', exchangeRate: 58.50, notes: 'GitHub Enterprise + AWS Cloud Services', createdAt: Date.now() - 10 * 86400000 },
      { id: 'tx_demo_08', walletId: 'wallet_maya', date: getRelativeDateString(-8), item: 'Investment Return', type: 'credit', debit: 0, credit: 750.00, runningBalance: 150750.00, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Maya high-yield daily accrued interest payout', createdAt: Date.now() - 8 * 86400000 },
      { id: 'tx_demo_09', walletId: 'wallet_gcash', date: getRelativeDateString(-5), item: 'Transportation & Fuel', type: 'debit', debit: 2800.00, credit: 0, runningBalance: 3199.50, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Caltex full tank gas reload', createdAt: Date.now() - 5 * 86400000 },
      { id: 'tx_demo_10', walletId: 'wallet_bpi', date: getRelativeDateString(-2), item: 'Healthcare & Wellness', type: 'debit', debit: 3200.00, credit: 0, runningBalance: 143380.00, originalCurrency: 'PHP', exchangeRate: 1.0, notes: 'Annual dental prophylaxis & maintenance', createdAt: Date.now() - 2 * 86400000 }
    ];

    if (window.BB_WALLETS?.recalculateBalances) window.BB_WALLETS.recalculateBalances();
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    if (window.BB_WALLETS?.renderWalletBar) window.BB_WALLETS.renderWalletBar();
    if (window.BB_CORE?.renderTable) window.BB_CORE.renderTable();
    if (window.BB_THEME?.renderAllHeroCharts) window.BB_THEME.renderAllHeroCharts();
    if (window.BB_DEBTS?.renderDebtsUI) window.BB_DEBTS.renderDebtsUI();
    if (window.BB_BILLS?.renderBillsUI) window.BB_BILLS.renderBillsUI();

    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Demo financial multi-wallet data loaded!', 'success');
  }

  window.BB_REPORTS = {
    REPORT_MULTI_COLORS,
    setupReportListeners,
    switchReportTab,
    renderExpenseReport,
    updateChartThemeColors,
    renderBalanceSheet,
    openGuideModal,
    switchGuideTab,
    setupGuideModalListeners,
    setupExportImportListeners,
    exportDataAsJson,
    exportDataAsCsv,
    exportSaveVaultArchive,
    executeFileImport,
    loadDemoData
  };
})(window);
