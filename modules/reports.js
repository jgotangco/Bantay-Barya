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

    const labels = sortedCategories.map(c => c.name);
    const data = sortedCategories.map(c => c.total);
    const backgroundColors = sortedCategories.map((_, idx) => REPORT_MULTI_COLORS[idx % REPORT_MULTI_COLORS.length]);

    if (chartInstance) {
      chartInstance.destroy();
    }

    const chartType = state.reportChartType || 'doughnut';
    const isBar = chartType === 'bar';

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#0a3640' : '#b8d4cc';
    const gridColor = isLight ? 'rgba(10, 54, 64, 0.08)' : 'rgba(123, 227, 168, 0.1)';

    const chartConfig = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: isLight ? '#ffffff' : '#052a33',
          borderWidth: isBar ? 0 : 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: isBar ? 'none' : 'right',
            display: !isBar,
            labels: {
              boxWidth: 12,
              padding: 10,
              color: textColor,
              font: {
                family: "'Inter Tight', 'Plus Jakarta Sans', sans-serif",
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.raw || 0;
                const pct = totalDebitExpense > 0 ? ((val / totalDebitExpense) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    };

    if (isBar) {
      chartConfig.options.scales = {
        x: {
          ticks: { color: textColor, font: { family: "'Inter Tight', sans-serif", size: 10 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 10 } },
          grid: { color: gridColor }
        }
      };
    }

    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, chartConfig);
  }

  function updateChartThemeColors() {
    if (chartInstance) {
      renderExpenseReport();
    }
  }

  function renderBalanceSheet() {
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const dateEl = document.getElementById('bsAsOfDate');
    if (dateEl) {
      dateEl.textContent = `As of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }

    const liquidList = document.getElementById('bsLiquidAssetsList');
    const fixedList = document.getElementById('bsFixedAssetsList');
    const currLiabList = document.getElementById('bsCurrentLiabList');
    const longLiabList = document.getElementById('bsLongLiabList');
    const equityList = document.getElementById('bsEquityList');

    let totalLiquid = 0;
    let totalFixed = 0;
    let totalCurrLiab = 0;
    let totalLongLiab = 0;

    let liquidHtml = '';
    let fixedHtml = '';
    let currLiabHtml = '';
    let longLiabHtml = '';

    state.wallets.forEach(w => {
      const bal = parseFloat(w.balance) || 0;
      const converted = w.currency === baseCurr ? bal : bal * (w.customExchangeRate || 1.0);
      const isNegative = converted < 0;

      if (isNegative) {
        const absVal = Math.abs(converted);
        totalCurrLiab += absVal;
        currLiabHtml += `
          <div class="bs-row">
            <span>${w.icon || '👛'} ${escapeHtml(w.name)} (Overdraft)</span>
            <span class="font-mono debit-text">${formatCurrency(absVal)}</span>
          </div>
        `;
      } else {
        if (w.assetType === 'fixed_income' || w.assetType === 'crypto' || w.assetType === 'stocks') {
          totalFixed += converted;
          fixedHtml += `
            <div class="bs-row">
              <span>${w.icon || '📜'} ${escapeHtml(w.name)} (${w.currency || baseCurr})</span>
              <span class="font-mono">${formatCurrency(converted)}</span>
            </div>
          `;
        } else {
          totalLiquid += converted;
          liquidHtml += `
            <div class="bs-row">
              <span>${w.icon || '👛'} ${escapeHtml(w.name)} (${w.currency || baseCurr})</span>
              <span class="font-mono">${formatCurrency(converted)}</span>
            </div>
          `;
        }
      }
    });

    state.debts.forEach(d => {
      const bal = parseFloat(d.balance) || 0;
      if (bal > 0) {
        if (d.type === 'credit_card' || d.type === 'personal') {
          totalCurrLiab += bal;
          currLiabHtml += `
            <div class="bs-row">
              <span>💳 ${escapeHtml(d.name)} (${d.rateMonthly || 0}% / mo)</span>
              <span class="font-mono debit-text">${formatCurrency(bal)}</span>
            </div>
          `;
        } else {
          totalLongLiab += bal;
          longLiabHtml += `
            <div class="bs-row">
              <span>🏛️ ${escapeHtml(d.name)} (${d.rateAnnual || 0}% p.a.)</span>
              <span class="font-mono debit-text">${formatCurrency(bal)}</span>
            </div>
          `;
        }
      }
    });

    if (liquidList) liquidList.innerHTML = liquidHtml || '<div class="bs-row empty-row"><span>No liquid cash / bank accounts</span><span class="font-mono">₱0.00</span></div>';
    if (fixedList) fixedList.innerHTML = fixedHtml || '<div class="bs-row empty-row"><span>No investment or fixed-income assets</span><span class="font-mono">₱0.00</span></div>';
    if (currLiabList) currLiabList.innerHTML = currLiabHtml || '<div class="bs-row empty-row"><span>No short-term revolving debt</span><span class="font-mono">₱0.00</span></div>';
    if (longLiabList) longLiabList.innerHTML = longLiabHtml || '<div class="bs-row empty-row"><span>No long-term installment liabilities</span><span class="font-mono">₱0.00</span></div>';

    const totalAssets = totalLiquid + totalFixed;
    const totalLiabilities = totalCurrLiab + totalLongLiab;
    const realNetWorth = totalAssets - totalLiabilities;

    let startingCapital = 0;
    state.wallets.forEach(w => {
      const initBal = parseFloat(w.initialBalance) || 0;
      startingCapital += (w.currency === baseCurr ? initBal : initBal * (w.customExchangeRate || 1.0));
    });

    let netIncomeSurplus = 0;
    state.transactions.forEach(tx => {
      if (tx.isArchived) return;
      if (tx.type === 'credit') {
        const rate = parseFloat(tx.exchangeRate) || 1.0;
        netIncomeSurplus += ((parseFloat(tx.inputAmount) || parseFloat(tx.credit) || 0) * (tx.inputCurrency === baseCurr ? 1.0 : rate));
      } else if (tx.type === 'debit') {
        const rate = parseFloat(tx.exchangeRate) || 1.0;
        netIncomeSurplus -= ((parseFloat(tx.inputAmount) || parseFloat(tx.debit) || 0) * (tx.inputCurrency === baseCurr ? 1.0 : rate));
      }
    });

    const otherBalAdjustments = realNetWorth - (startingCapital + netIncomeSurplus);

    let equityHtml = `
      <div class="bs-row">
        <span>Initial Ledger Capital (Opening Balances)</span>
        <span class="font-mono">${formatCurrency(startingCapital)}</span>
      </div>
      <div class="bs-row">
        <span>Cumulative Net Operating Surplus (Inflows − Outflows)</span>
        <span class="font-mono ${netIncomeSurplus >= 0 ? 'credit-text' : 'debit-text'}">${formatCurrency(netIncomeSurplus)}</span>
      </div>
    `;

    if (Math.abs(otherBalAdjustments) > 0.01) {
      equityHtml += `
        <div class="bs-row">
          <span>Reconciled Discrepancies & Liabilities Adjustments</span>
          <span class="font-mono">${formatCurrency(otherBalAdjustments)}</span>
        </div>
      `;
    }

    if (equityList) equityList.innerHTML = equityHtml;

    const bsTotalLiquid = document.getElementById('bsTotalLiquidAssets');
    const bsTotalFixed = document.getElementById('bsTotalFixedAssets');
    const bsGrandAssets = document.getElementById('bsGrandTotalAssets');

    const bsTotalCurr = document.getElementById('bsTotalCurrentLiab');
    const bsTotalLong = document.getElementById('bsTotalLongLiab');
    const bsGrandLiab = document.getElementById('bsGrandTotalLiab');
    const bsNetWorth = document.getElementById('bsTotalRealNetWorth');
    const bsGrandLiabEquity = document.getElementById('bsGrandTotalLiabEquity');
    const bsBalanceCheck = document.getElementById('bsBalanceEquationCheck');

    if (bsTotalLiquid) bsTotalLiquid.textContent = formatCurrency(totalLiquid);
    if (bsTotalFixed) bsTotalFixed.textContent = formatCurrency(totalFixed);
    if (bsGrandAssets) bsGrandAssets.textContent = formatCurrency(totalAssets);

    if (bsTotalCurr) bsTotalCurr.textContent = formatCurrency(totalCurrLiab);
    if (bsTotalLong) bsTotalLong.textContent = formatCurrency(totalLongLiab);
    if (bsGrandLiab) bsGrandLiab.textContent = formatCurrency(totalLiabilities);
    if (bsNetWorth) {
      bsNetWorth.textContent = formatCurrency(realNetWorth);
      bsNetWorth.className = `font-mono ${realNetWorth >= 0 ? 'credit-text' : 'debit-text'}`;
    }
    if (bsGrandLiabEquity) bsGrandLiabEquity.textContent = formatCurrency(totalLiabilities + realNetWorth);

    if (bsBalanceCheck) {
      const diff = Math.abs(totalAssets - (totalLiabilities + realNetWorth));
      if (diff < 0.01) {
        bsBalanceCheck.textContent = '✓ Fundamental Accounting Equation Balanced: Assets = Liabilities + Real Net Worth';
        bsBalanceCheck.style.color = 'var(--credit-color)';
      } else {
        bsBalanceCheck.textContent = '⚠️ Discrepancy detected in balance equation.';
        bsBalanceCheck.style.color = 'var(--debit-color)';
      }
    }
  }

  function downloadUserManual() {
    const link = document.createElement('a');
    link.href = 'USER_MANUAL.pdf';
    link.download = 'Bantay_Barya_User_Manual.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Downloaded Bantay Barya User Manual (PDF)!', 'success');
  }

  function openGuideModal(initialTab = 'ph_context') {
    switchGuideTab(initialTab);
    document.getElementById('guideModal')?.classList.add('active');
  }

  function switchGuideTab(tabName) {
    const btnPh = document.getElementById('guideTabBtnPhContext');
    const btnTut = document.getElementById('guideTabBtnTutorial');
    const btnPrac = document.getElementById('guideTabBtnPractices');
    const btnManual = document.getElementById('guideTabBtnManual');

    const contentPh = document.getElementById('guideTabContentPhContext');
    const contentTut = document.getElementById('guideTabContentTutorial');
    const contentPrac = document.getElementById('guideTabContentPractices');
    const contentManual = document.getElementById('guideTabContentManual');

    [btnPh, btnTut, btnPrac, btnManual].forEach(b => b?.classList.remove('active'));
    if (contentPh) contentPh.style.display = 'none';
    if (contentTut) contentTut.style.display = 'none';
    if (contentPrac) contentPrac.style.display = 'none';
    if (contentManual) contentManual.style.display = 'none';

    if (tabName === 'tutorial') {
      if (btnTut) btnTut.classList.add('active');
      if (contentTut) contentTut.style.display = 'flex';
    } else if (tabName === 'practices') {
      if (btnPrac) btnPrac.classList.add('active');
      if (contentPrac) contentPrac.style.display = 'flex';
    } else if (tabName === 'manual') {
      if (btnManual) btnManual.classList.add('active');
      if (contentManual) contentManual.style.display = 'flex';
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
    document.getElementById('guideTabBtnManual')?.addEventListener('click', () => switchGuideTab('manual'));

    // Manual PDF Download triggers
    document.getElementById('downloadUserManualPdfBtn')?.addEventListener('click', () => downloadUserManual());
    document.getElementById('guideFooterDownloadManualBtn')?.addEventListener('click', () => downloadUserManual());
    document.getElementById('settingsDownloadManualBtn')?.addEventListener('click', () => downloadUserManual());
  }

  function setupExportImportListeners() {
    const exportDropdown = document.getElementById('exportDropdown');
    document.getElementById('exportMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown?.classList.toggle('show');
    });

    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
      exportLedgerCsv();
      exportDropdown?.classList.remove('show');
    });

    document.getElementById('exportGoogleSheetsBtn')?.addEventListener('click', () => {
      copyForGoogleSheets();
      exportDropdown?.classList.remove('show');
    });

    document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
      exportLedgerJson();
      exportDropdown?.classList.remove('show');
    });

    document.getElementById('importJsonBtn')?.addEventListener('click', () => {
      document.getElementById('importFileInput')?.click();
      exportDropdown?.classList.remove('show');
    });

    document.getElementById('importFileInput')?.addEventListener('change', handleFileImport);

    document.getElementById('loadSampleDataBtn')?.addEventListener('click', () => {
      exportDropdown?.classList.remove('show');
      if (window.BB_APP?.hasActiveSavedLedger && window.BB_APP.hasActiveSavedLedger()) {
        window.BB_APP.openOverwriteWarningModal('sample_data', () => loadSampleData());
      } else {
        loadSampleData();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown-wrapper')) {
        exportDropdown?.classList.remove('show');
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
      'ID', 'Date', 'Type', 'Wallet ID', 'Wallet Name', 'Category / Item',
      `Credit Inflow (${baseCurr})`, `Debit Outflow (${baseCurr})`,
      `Wallet Balance (${baseCurr})`, `Converted Total Balance (${baseCurr})`,
      'Input Currency', 'Input Amount', 'FX Exchange Rate', 'Notes'
    ];

    const rows = sorted.map((tx) => {
      const wallet = state.wallets.find(w => w.id === tx.walletId) || {};
      return [
        `"${tx.id || ''}"`,
        `"${tx.date || ''}"`,
        `"${tx.type || 'debit'}"`,
        `"${tx.walletId || ''}"`,
        `"${(wallet.name || '').replace(/"/g, '""')}"`,
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
      'Date', 'Wallet', 'Category / Item', `Debit (${baseCurr})`, `Credit (${baseCurr})`,
      `Wallet Balance (${baseCurr})`, `Total Balance (${baseCurr})`, 'Input Currency', 'Amount', 'FX Rate', 'Notes'
    ];

    const rows = sorted.map((tx) => {
      const wallet = state.wallets.find(w => w.id === tx.walletId) || {};
      return [
        tx.date || '',
        wallet.name || '',
        tx.item || '',
        parseFloat(tx.debit || 0).toFixed(2),
        parseFloat(tx.credit || 0).toFixed(2),
        parseFloat(tx.walletRunningBalance || 0).toFixed(2),
        parseFloat(tx.runningBalance || 0).toFixed(2),
        tx.inputCurrency || baseCurr,
        parseFloat(tx.inputAmount || (tx.credit > 0 ? tx.credit : tx.debit) || 0).toFixed(2),
        parseFloat(tx.exchangeRate || 1.0).toFixed(4),
        tx.notes || ''
      ].join('\t');
    });

    const tsvData = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsvData).then(() => {
      if (window.BB_CORE?.showToast) {
        window.BB_CORE.showToast('TSV copied to clipboard! Paste directly into Google Sheets (Ctrl+V)', 'success');
      }
    }).catch(() => {
      if (window.BB_CORE?.showToast) {
        window.BB_CORE.showToast('Could not access clipboard. Please export as CSV instead.', 'error');
      }
    });
  }

  function exportLedgerJson(customFilename = null) {
    const exportData = {
      app: 'Bantay Barya',
      author: 'Jerome Gotangco (https://github.com/jgotangco)',
      attribution: 'Designed and product-directed by Jerome Gotangco. Developed with Google Antigravity / Gemini.',
      version: '2.9.0',
      exportedAt: new Date().toISOString(),
      baseCurrency: state.settings.baseCurrency || 'PHP',
      activeWalletId: state.activeWalletId,
      wallets: state.wallets,
      categories: state.categories,
      transactions: state.transactions,
      debts: state.debts,
      bills: state.bills,
      settings: state.settings
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    const filenamePrefix = customFilename || 'Bantay_Barya_Full_Backup';
    link.setAttribute('download', `${filenamePrefix}_${getRelativeDateString(0)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast('JSON backup exported successfully!', 'success');
  }

  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const performImport = () => {
      const reader = new FileReader();
      reader.onload = function (event) {
        try {
          const content = event.target.result;
          if (file.name.endsWith('.json') || file.name.endsWith('.barya')) {
            const data = JSON.parse(content);
            if (data.wallets && Array.isArray(data.wallets)) {
              state.wallets = data.wallets;
            }
            if (data.transactions && Array.isArray(data.transactions)) {
              state.transactions = data.transactions;
            }
            if (data.categories && Array.isArray(data.categories)) {
              state.categories = data.categories;
            }
            if (data.debts && Array.isArray(data.debts)) {
              state.debts = data.debts;
            }
            if (data.bills && Array.isArray(data.bills)) {
              state.bills = data.bills;
            }
            if (data.settings && typeof data.settings === 'object') {
              state.settings = { ...state.settings, ...data.settings };
            }
            if (data.activeWalletId) {
              state.activeWalletId = data.activeWalletId;
            } else if (state.wallets.length > 0) {
              state.activeWalletId = state.wallets[0].id;
            }

            if (window.BB_CORE?.saveToStorage) window.BB_CORE.saveToStorage();
            if (window.BB_WALLETS) {
              window.BB_WALLETS.populateWalletDropdowns();
              window.BB_WALLETS.recalculateLedgerBalances();
            }
            if (window.BB_DEBTS) window.BB_DEBTS.renderDebtsTable();
            if (window.BB_BILLS) {
              window.BB_BILLS.checkBillDueNotifications();
              window.BB_BILLS.renderBillsTable();
            }
            if (window.BB_CORE) {
              window.BB_CORE.updateCategoryDatalists();
              window.BB_CORE.updateSettingsUI();
            }
            if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Imported ${state.transactions.length} transactions and ${state.wallets.length} wallets!`, 'success');
          }
        } catch (err) {
          console.error('Import error:', err);
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Failed to import file. Invalid backup format.', 'error');
        }
      };
      reader.readAsText(file);
    };

    if (window.BB_APP?.hasActiveSavedLedger && window.BB_APP.hasActiveSavedLedger()) {
      window.BB_APP.openOverwriteWarningModal('restore_backup', performImport);
    } else {
      performImport();
    }
  }

  function loadSampleData() {
    const today = getRelativeDateString(0);
    const yesterday = getRelativeDateString(-1);
    const twoDaysAgo = getRelativeDateString(-2);
    const threeDaysAgo = getRelativeDateString(-3);
    const fiveDaysAgo = getRelativeDateString(-5);
    const tenDaysAgo = getRelativeDateString(-10);
    const fifteenDaysAgo = getRelativeDateString(-15);
    const twentyDaysAgo = getRelativeDateString(-20);
    const twentyFiveDaysAgo = getRelativeDateString(-25);
    const thirtyDaysAgo = getRelativeDateString(-30);

    state.wallets = [
      { id: 'w_bpi', name: 'BPI Checking', currency: 'PHP', icon: '🏛️', initialBalance: 75000, balance: 75000, assetType: 'checking', isDefault: true, createdAt: 1700000000000 },
      { id: 'w_maya_savings', name: 'Maya 6% Savings', currency: 'PHP', icon: '🏦', initialBalance: 120000, balance: 120000, assetType: 'high_yield_savings', isDefault: false, createdAt: 1700000000000 },
      { id: 'w_gcash', name: 'GCash Everyday', currency: 'PHP', icon: '📱', initialBalance: 15000, balance: 15000, assetType: 'ewallet', isDefault: false, createdAt: 1700000000000 },
      { id: 'w_cash', name: 'Cash on Hand (Wallet)', currency: 'PHP', icon: '💵', initialBalance: 5000, balance: 5000, assetType: 'cash', isDefault: false, createdAt: 1700000000000 },
      { id: 'w_wise_usd', name: 'Wise Multi-Currency USD', currency: 'USD', icon: '💳', initialBalance: 2500, balance: 2500, assetType: 'ewallet', customExchangeRate: 58.50, isDefault: false, createdAt: 1700000000000 },
      { id: 'w_maya_td', name: 'Maya 6-Mo Time Deposit', currency: 'PHP', icon: '📜', initialBalance: 100000, balance: 100000, assetType: 'fixed_income', isDefault: false, createdAt: 1700000000000 },
      { id: 'w_stocks', name: 'COL Financial PSE Equities', currency: 'PHP', icon: '📈', initialBalance: 150000, balance: 150000, assetType: 'stocks', isDefault: false, createdAt: 1700000000000 },
      { id: 'w_crypto', name: 'Hardware Ledger Cold Storage', currency: 'PHP', icon: '🪙', initialBalance: 85000, balance: 85000, assetType: 'crypto', isDefault: false, createdAt: 1700000000000 }
    ];
    state.activeWalletId = 'w_bpi';

    state.categories = [...DEFAULT_CATEGORIES];

    state.transactions = [
      { id: 'tx_demo_01', date: thirtyDaysAgo, type: 'credit', walletId: 'w_bpi', item: 'Salary (15th Payday)', credit: 65000, debit: 0, notes: 'Net salary direct deposit via ACH wire', runningBalance: 0, createdAt: 1700000001000 },
      { id: 'tx_demo_02', date: twentyFiveDaysAgo, type: 'debit', walletId: 'w_bpi', item: 'Rent / Housing', credit: 0, debit: 18000, notes: 'Condo monthly rent via bank transfer', runningBalance: 0, createdAt: 1700000002000 },
      { id: 'tx_demo_03', date: twentyDaysAgo, type: 'debit', walletId: 'w_gcash', item: 'Food & Groceries', credit: 0, debit: 5420.50, notes: 'S&R Membership Shopping weekend groceries', runningBalance: 0, createdAt: 1700000003000 },
      { id: 'tx_demo_04', date: fifteenDaysAgo, type: 'credit', walletId: 'w_bpi', item: 'Salary (30th Payday)', credit: 65000, debit: 0, notes: 'Second cut payday credited', runningBalance: 0, createdAt: 1700000004000 },
      { id: 'tx_demo_05', date: tenDaysAgo, type: 'debit', walletId: 'w_bpi', item: 'Electricity (Meralco)', credit: 0, debit: 6850.75, notes: 'Meralco summer aircon electricity bill', runningBalance: 0, createdAt: 1700000005000 },
      { id: 'tx_demo_06', date: fiveDaysAgo, type: 'debit', walletId: 'w_gcash', item: 'Internet & Broadband', credit: 0, debit: 2099.00, notes: 'PLDT Home Fiber monthly subscription', runningBalance: 0, createdAt: 1700000006000 },
      { id: 'tx_demo_07', date: threeDaysAgo, type: 'debit', walletId: 'w_cash', item: 'Transportation & Fuel', credit: 0, debit: 2800.00, notes: 'Shell full tank gas + tollway RFID top-up', runningBalance: 0, createdAt: 1700000007000 },
      { id: 'tx_demo_08', date: twoDaysAgo, type: 'debit', walletId: 'w_wise_usd', item: 'Software & Cloud Tools', inputCurrency: 'USD', inputAmount: 49.00, exchangeRate: 58.50, credit: 0, debit: 2866.50, notes: 'GitHub Copilot + Google Workspace business account', runningBalance: 0, createdAt: 1700000008000 },
      { id: 'tx_demo_09', date: yesterday, type: 'debit', walletId: 'w_bpi', item: 'Dining & Restaurants', credit: 0, debit: 1850.00, notes: 'Family dinner weekend treat at restaurant', runningBalance: 0, createdAt: 1700000009000 },
      { id: 'tx_demo_10', date: today, type: 'credit', walletId: 'w_maya_savings', item: 'High-Yield Interest Inflow', credit: 620.45, debit: 0, notes: 'Maya 6.0% p.a. daily interest credit posted', runningBalance: 0, createdAt: 1700000010000 }
    ];

    state.debts = [
      { id: 'd_demo_bpi_cc', name: 'BPI Visa Signature', type: 'credit_card', balance: 28500, minPayment: 1500, rateMonthly: 3.0, rateAnnual: 36.0, dueDay: 18, notes: 'Revolving card (Paid in full each cycle)', createdAt: 1700000000000 },
      { id: 'd_demo_auto', name: 'Toyota Vios Auto Loan', type: 'auto_loan', balance: 340000, minPayment: 14850, rateMonthly: 0.82, rateAnnual: 9.8, dueDay: 25, notes: '5-year fixed chattel mortgage', createdAt: 1700000000000 },
      { id: 'd_demo_home', name: 'Pag-IBIG Housing Loan', type: 'mortgage', balance: 1850000, minPayment: 16200, rateMonthly: 0.52, rateAnnual: 6.25, dueDay: 5, notes: '3-year repricing housing loan', createdAt: 1700000000000 }
    ];

    state.bills = [
      { id: 'b_demo_meralco', name: 'Meralco Electric Bill', category: 'Electricity', amount: 6850, dueDay: 14, walletId: 'w_bpi', isAutoPay: false, notes: 'Customer Account # 1042-8891-03', createdAt: 1700000000000 },
      { id: 'b_demo_pldt', name: 'PLDT Home Fiber 200Mbps', category: 'Internet', amount: 2099, dueDay: 20, walletId: 'w_gcash', isAutoPay: true, notes: 'Account # 02-8891-4420', createdAt: 1700000000000 },
      { id: 'b_demo_maynilad', name: 'Maynilad Water Services', category: 'Water', amount: 840, dueDay: 8, walletId: 'w_gcash', isAutoPay: false, notes: 'Water utility service invoice', createdAt: 1700000000000 },
      { id: 'b_demo_netflix', name: 'Netflix Premium 4K UHD', category: 'Subscriptions', amount: 549, dueDay: 28, walletId: 'w_gcash', isAutoPay: true, notes: 'Monthly family subscription', createdAt: 1700000000000 }
    ];

    if (window.BB_CORE?.saveToStorage) window.BB_CORE.saveToStorage();

    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    const dateInput = document.getElementById('entryDate');
    if (dateInput) dateInput.value = today;
    const txSelect = document.getElementById('entryCurrencySelect');
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
    loadSampleData,
    downloadUserManual
  };
})(window);
