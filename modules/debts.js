/**
 * Bantay Barya - Liabilities Tracker, Amortization Engine & Debt Snowball/Avalanche Simulator
 */
(function (window) {
  'use strict';

  const {
    SAMPLE_DEBTS,
    getRelativeDateString,
    formatCurrency,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;

  function getDebtIcon(type) {
    const map = {
      mortgage: '🏠', auto: '🚗', credit_card: '💳',
      personal: '🤝', student: '🎓', medical: '🏥', other: '📋'
    };
    return map[type] || '📋';
  }

  function getDebtTypeLabel(type) {
    const map = {
      mortgage: 'Home Mortgage', auto: 'Auto Loan', credit_card: 'Credit Card Loan',
      personal: 'Personal Loan', student: 'Student Loan', medical: 'Medical Debt', other: 'Other Obligation'
    };
    return map[type] || 'Debt';
  }

  function updateDebtKpis() {
    let totalDebt = 0;
    let totalMinPay = 0;
    let totalInterestCost = 0;
    let weightedAprSum = 0;

    state.debts.forEach(d => {
      const bal = parseFloat(d.balance) || 0;
      const apr = parseFloat(d.apr) || 0;
      const minP = parseFloat(d.minPayment) || 0;

      totalDebt += bal;
      totalMinPay += minP;
      totalInterestCost += (bal * (apr / 100)) / 12;
      weightedAprSum += bal * apr;
    });

    const weightedApr = totalDebt > 0 ? (weightedAprSum / totalDebt) : 0;
    const weightedMonthlyRate = weightedApr / 12;

    const totalDebtsVal = document.getElementById('totalDebtsKpiVal');
    const weightedAprVal = document.getElementById('weightedAprKpiVal');
    const weightedMonthlySub = document.getElementById('weightedMonthlyRateSub');
    const totalMinPayVal = document.getElementById('totalMinPayKpiVal');
    const monthlyIntCostVal = document.getElementById('monthlyInterestCostVal');

    if (totalDebtsVal) totalDebtsVal.textContent = formatCurrency(totalDebt);
    if (weightedAprVal) weightedAprVal.textContent = `${weightedApr.toFixed(2)}% EIR`;
    if (weightedMonthlySub) weightedMonthlySub.textContent = `${weightedMonthlyRate.toFixed(2)}% / mo`;
    if (totalMinPayVal) totalMinPayVal.textContent = formatCurrency(totalMinPay);
    if (monthlyIntCostVal) monthlyIntCostVal.textContent = formatCurrency(totalInterestCost);

    const headerBadge = document.getElementById('headerDebtCountBadge');
    const mobileBadge = document.getElementById('mobileDebtsBadge');
    const tableCount = document.getElementById('debtsTableCount');

    if (headerBadge) {
      headerBadge.textContent = state.debts.length;
      headerBadge.style.display = state.debts.length > 0 ? 'inline-flex' : 'none';
    }
    if (mobileBadge) {
      mobileBadge.textContent = state.debts.length;
      mobileBadge.style.display = state.debts.length > 0 ? 'inline-flex' : 'none';
    }
    if (tableCount) tableCount.textContent = state.debts.length;
  }

  function renderDebtsTable() {
    const tableBody = document.getElementById('debtsTableBody');
    if (!tableBody) return;
    updateDebtKpis();

    if (state.debts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 2.5rem; color: var(--text-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <span style="font-size: 2rem;">🎉</span>
              <strong>No active debts or liabilities recorded!</strong>
              <p style="font-size: 0.8rem;">You are currently debt-free, or you can add a loan using the form above.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    state.debts.forEach(d => {
      const icon = d.icon || getDebtIcon(d.type);
      const typeLabel = getDebtTypeLabel(d.type);
      const eir = parseFloat(d.apr) || 0;
      const monthlyRate = d.monthlyRate !== undefined ? parseFloat(d.monthlyRate) : (eir / 12);
      const monthlyInt = ((parseFloat(d.balance) || 0) * (eir / 1200));

      html += `
        <tr data-debt-id="${d.id}">
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">${icon}</span>
              <div>
                <strong>${escapeHtml(d.name)}</strong>
                ${d.dueDate ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(d.dueDate)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="cat-usage-pill in-use">${typeLabel}</span>
          </td>
          <td class="text-right font-mono debit-text" style="font-weight: 700;">
            ${formatCurrency(d.balance)}
          </td>
          <td class="text-center font-mono" style="font-weight: 600;">
            <div>${monthlyRate.toFixed(2)}%/mo</div>
            <small style="font-size: 0.72rem; color: var(--text-muted);">${eir.toFixed(2)}% EIR</small>
          </td>
          <td class="text-right font-mono">
            ${formatCurrency(d.minPayment)}
          </td>
          <td class="text-right font-mono debit-text" title="Monthly interest accrual (${monthlyRate.toFixed(2)}%/mo)">
            ${formatCurrency(monthlyInt)}
          </td>
          <td class="text-right">
            <div class="row-actions" style="justify-content: flex-end;">
              <button class="btn btn-outline btn-sm" onclick="window.app.openLogPaymentModal('${d.id}')" title="Record an actual payment towards this debt">
                <span>Pay</span>
              </button>
              <button class="btn-icon" onclick="window.app.openEditDebtModal('${d.id}')" title="Edit debt parameters">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" onclick="window.app.deleteDebt('${d.id}')" title="Delete debt entry">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  function createDebt(name, type, balance, monthlyRate, apr, minPayment, dueDate, notes) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    let cleanApr = parseFloat(apr);
    let cleanMonthly = parseFloat(monthlyRate);

    if (isNaN(cleanApr) && !isNaN(cleanMonthly)) {
      cleanApr = cleanMonthly * 12;
    } else if (isNaN(cleanMonthly) && !isNaN(cleanApr)) {
      cleanMonthly = cleanApr / 12;
    } else if (isNaN(cleanApr) && isNaN(cleanMonthly)) {
      cleanApr = 0;
      cleanMonthly = 0;
    }

    const newDebt = {
      id: 'debt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      type: type || 'other',
      icon: getDebtIcon(type),
      balance: Math.max(0, parseFloat(balance) || 0),
      monthlyRate: Math.max(0, cleanMonthly),
      apr: Math.max(0, cleanApr),
      minPayment: Math.max(0, parseFloat(minPayment) || 0),
      dueDate: (dueDate || '').trim(),
      notes: (notes || '').trim(),
      createdAt: Date.now()
    };

    state.debts.push(newDebt);
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderDebtsTable();
    renderSnowballSimulation();
    if (window.BB_CORE?.showToast) {
      window.BB_CORE.showToast(`Added debt "${cleanName}" (${formatCurrency(newDebt.balance)} @ ${cleanMonthly.toFixed(2)}%/mo)!`, 'success');
    }
  }

  function editDebt(id, name, type, balance, monthlyRate, apr, minPayment, dueDate, notes) {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;

    let cleanApr = parseFloat(apr);
    let cleanMonthly = parseFloat(monthlyRate);

    if (isNaN(cleanApr) && !isNaN(cleanMonthly)) {
      cleanApr = cleanMonthly * 12;
    } else if (isNaN(cleanMonthly) && !isNaN(cleanApr)) {
      cleanMonthly = cleanApr / 12;
    }

    debt.name = (name || debt.name).trim();
    debt.type = type || debt.type;
    debt.icon = getDebtIcon(debt.type);
    debt.balance = Math.max(0, parseFloat(balance) || 0);
    if (!isNaN(cleanMonthly)) debt.monthlyRate = Math.max(0, cleanMonthly);
    if (!isNaN(cleanApr)) debt.apr = Math.max(0, cleanApr);
    debt.minPayment = Math.max(0, parseFloat(minPayment) || 0);
    debt.dueDate = (dueDate !== undefined ? dueDate : debt.dueDate).trim();
    debt.notes = (notes !== undefined ? notes : debt.notes).trim();

    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderDebtsTable();
    renderSnowballSimulation();
    document.getElementById('editDebtModal')?.classList.remove('active');
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Updated "${debt.name}"!`, 'success');
  }

  function deleteDebt(id) {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;

    if (confirm(`Remove liability "${debt.name}" (${formatCurrency(debt.balance)}) from tracker?`)) {
      state.debts = state.debts.filter(d => d.id !== id);
      if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
      renderDebtsTable();
      renderSnowballSimulation();
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Removed liability "${debt.name}".`, 'info');
    }
  }

  function openEditDebtModal(id) {
    const debt = state.debts.find(d => d.id === id);
    if (!debt) return;

    const eir = parseFloat(debt.apr) || 0;
    const monthly = debt.monthlyRate !== undefined ? parseFloat(debt.monthlyRate) : (eir / 12);

    document.getElementById('editDebtId').value = debt.id;
    document.getElementById('editDebtName').value = debt.name;
    document.getElementById('editDebtType').value = debt.type;
    document.getElementById('editDebtBalance').value = debt.balance;
    const monthlyRateInput = document.getElementById('editDebtMonthlyRate');
    if (monthlyRateInput) monthlyRateInput.value = monthly.toFixed(2);
    document.getElementById('editDebtApr').value = eir.toFixed(2);
    document.getElementById('editDebtMinPay').value = debt.minPayment;
    document.getElementById('editDebtDueDate').value = debt.dueDate || '';

    document.getElementById('editDebtModal')?.classList.add('active');
  }

  function openLogPaymentModal(debtId) {
    if (window.BB_WALLETS) window.BB_WALLETS.populateWalletDropdowns();
    const debtSelect = document.getElementById('logPayDebtSelect');
    const walletSelect = document.getElementById('logPayWalletSelect');

    if (debtSelect) {
      debtSelect.innerHTML = state.debts.map(d =>
        `<option value="${d.id}" ${d.id === debtId ? 'selected' : ''}>${d.icon || '💳'} ${escapeHtml(d.name)} (Bal: ${formatCurrency(d.balance)})</option>`
      ).join('');
    }

    if (walletSelect) {
      walletSelect.innerHTML = state.wallets.map(w =>
        `<option value="${w.id}">${w.icon || '👛'} ${escapeHtml(w.name)} (${formatCurrency(window.BB_WALLETS ? window.BB_WALLETS.getWalletCurrentBalance(w.id) : 0)})</option>`
      ).join('');
    }

    const targetDebt = state.debts.find(d => d.id === debtId) || state.debts[0];
    if (targetDebt) {
      document.getElementById('logPayAmount').value = targetDebt.minPayment || '';
    }
    document.getElementById('logPayDate').value = getRelativeDateString(0);
    document.getElementById('logPayNotes').value = 'Monthly loan amortization';

    document.getElementById('logDebtPaymentModal')?.classList.add('active');
  }

  function recordDebtPayment(debtId, amount, date, deductWalletId, notes) {
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) return;

    const payVal = parseFloat(amount) || 0;
    if (payVal <= 0) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    const prevBal = debt.balance;
    debt.balance = Math.max(0, debt.balance - payVal);

    if (deductWalletId) {
      const newTx = {
        id: 'tx_debtpay_' + Date.now(),
        walletId: deductWalletId,
        date: date || getRelativeDateString(0),
        item: `Debt Payment: ${debt.name}`,
        type: 'debit',
        inputCurrency: state.settings.baseCurrency || 'PHP',
        inputAmount: payVal,
        exchangeRate: 1.0,
        credit: 0,
        debit: payVal,
        notes: notes ? `${notes} (Debt paydown for ${debt.name})` : `Payment to ${debt.name}`,
        createdAt: Date.now()
      };
      state.transactions.push(newTx);
      if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
    }

    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    renderDebtsTable();
    renderSnowballSimulation();

    document.getElementById('logDebtPaymentModal')?.classList.remove('active');

    if (debt.balance === 0 && prevBal > 0) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`🎊 Congratulations! "${debt.name}" has been 100% PAID OFF!`, 'success');
    } else {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Recorded ${formatCurrency(payVal)} payment to "${debt.name}". Remaining balance: ${formatCurrency(debt.balance)}.`, 'success');
    }
  }

  function switchDebtTab(tabName) {
    state.activeDebtTab = tabName;
    const btnMyDebts = document.getElementById('tabBtnMyDebts');
    const btnSnowball = document.getElementById('tabBtnSnowball');
    const viewMyDebts = document.getElementById('tabViewMyDebts');
    const viewSnowball = document.getElementById('tabViewSnowball');

    if (tabName === 'my_debts') {
      if (btnMyDebts) btnMyDebts.classList.add('active');
      if (btnSnowball) btnSnowball.classList.remove('active');
      if (viewMyDebts) viewMyDebts.style.display = 'flex';
      if (viewSnowball) viewSnowball.style.display = 'none';
      renderDebtsTable();
    } else {
      if (btnMyDebts) btnMyDebts.classList.remove('active');
      if (btnSnowball) btnSnowball.classList.add('active');
      if (viewMyDebts) viewMyDebts.style.display = 'none';
      if (viewSnowball) viewSnowball.style.display = 'block';
      renderSnowballSimulation();
    }
  }

  function runAmortizationSimulation(debtsList, strategy, extraMonthly = 0, lumpSum = 0) {
    if (!debtsList || debtsList.length === 0) {
      return { totalMonths: 0, totalInterest: 0, debtFreeDate: 'Debt Free Today', payoffRoadmap: [], schedule: [] };
    }

    const debts = debtsList.map(d => ({
      id: d.id,
      name: d.name,
      icon: d.icon || getDebtIcon(d.type),
      apr: parseFloat(d.apr) || 0,
      minPayment: parseFloat(d.minPayment) || 0,
      balance: Math.max(0, parseFloat(d.balance) || 0),
      payoffMonth: null
    })).filter(d => d.balance > 0);

    if (debts.length === 0) {
      return { totalMonths: 0, totalInterest: 0, debtFreeDate: 'Debt Free Today', payoffRoadmap: [], schedule: [] };
    }

    const schedule = [];
    const payoffRoadmap = [];
    let totalInterestPaidAll = 0;
    let currentMonth = 0;
    const maxMonths = 480;

    if (lumpSum > 0) {
      let remainingLump = lumpSum;
      const sortedForLump = [...debts].sort((a, b) => {
        if (strategy === 'avalanche') return b.apr - a.apr;
        return a.balance - b.balance;
      });

      for (const d of sortedForLump) {
        if (remainingLump <= 0) break;
        const deduction = Math.min(d.balance, remainingLump);
        d.balance -= deduction;
        remainingLump -= deduction;
      }
    }

    const startDate = new Date();

    while (currentMonth < maxMonths) {
      const activeDebts = debts.filter(d => d.balance > 0);
      if (activeDebts.length === 0) break;

      currentMonth++;
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + currentMonth, 1);
      const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      let monthBeginningBal = activeDebts.reduce((sum, d) => sum + d.balance, 0);
      let monthInterestTotal = 0;
      let monthPrincipalTotal = 0;
      let monthMinPaymentTotal = 0;

      activeDebts.forEach(d => {
        const monthlyRate = (d.apr / 100) / 12;
        const interest = d.balance * monthlyRate;
        d.balance += interest;
        monthInterestTotal += interest;
        totalInterestPaidAll += interest;
      });

      activeDebts.forEach(d => {
        const pay = Math.min(d.minPayment, d.balance);
        d.balance -= pay;
        monthPrincipalTotal += pay;
        monthMinPaymentTotal += pay;

        if (d.balance <= 0.01 && d.payoffMonth === null) {
          d.balance = 0;
          d.payoffMonth = currentMonth;
          payoffRoadmap.push({
            id: d.id,
            name: d.name,
            icon: d.icon,
            month: currentMonth,
            monthStr: monthStr,
            freedPayment: d.minPayment
          });
        }
      });

      const freedFromPaid = debts
        .filter(d => d.payoffMonth !== null && d.payoffMonth <= currentMonth)
        .reduce((sum, d) => sum + d.minPayment, 0);

      let availableSnowball = extraMonthly + freedFromPaid;

      const remainingDebts = debts.filter(d => d.balance > 0);
      remainingDebts.sort((a, b) => {
        if (strategy === 'avalanche') return b.apr - a.apr;
        return a.balance - b.balance;
      });

      for (const target of remainingDebts) {
        if (availableSnowball <= 0) break;
        const extraPay = Math.min(target.balance, availableSnowball);
        target.balance -= extraPay;
        availableSnowball -= extraPay;
        monthPrincipalTotal += extraPay;

        if (target.balance <= 0.01 && target.payoffMonth === null) {
          target.balance = 0;
          target.payoffMonth = currentMonth;
          payoffRoadmap.push({
            id: target.id,
            name: target.name,
            icon: target.icon,
            month: currentMonth,
            monthStr: monthStr,
            freedPayment: target.minPayment
          });
        }
      }

      const monthEndingBal = debts.reduce((sum, d) => sum + Math.max(0, d.balance), 0);

      if (currentMonth <= 120 || currentMonth === maxMonths || monthEndingBal <= 0) {
        schedule.push({
          month: currentMonth,
          monthStr: monthStr,
          beginningBal: monthBeginningBal,
          minPaid: monthMinPaymentTotal,
          extraPaid: monthPrincipalTotal - monthMinPaymentTotal,
          interestPaid: monthInterestTotal,
          principalPaid: monthPrincipalTotal,
          endingBal: monthEndingBal
        });
      }
    }

    const freeDateObj = new Date(startDate.getFullYear(), startDate.getMonth() + currentMonth, 1);
    const debtFreeDateStr = currentMonth === 0 ? 'Debt Free Today' : freeDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return {
      totalMonths: currentMonth,
      totalInterest: totalInterestPaidAll,
      debtFreeDate: debtFreeDateStr,
      payoffRoadmap: payoffRoadmap,
      schedule: schedule
    };
  }

  function renderDebtSelectionList() {
    const container = document.getElementById('simDebtCheckboxesContainer');
    const countBadge = document.getElementById('simSelectedDebtsCountBadge');
    if (!container) return;

    const allDebtsWithBal = state.debts.filter(d => (parseFloat(d.balance) || 0) > 0);

    if (allDebtsWithBal.length === 0) {
      container.innerHTML = `
        <div class="text-muted" style="grid-column: 1 / -1; font-size: 0.82rem; padding: 0.5rem 0;">
          No active debts available for simulation.
        </div>
      `;
      if (countBadge) countBadge.textContent = '0 Active Debts';
      return;
    }

    if (!state.selectedSimDebtIds || state.selectedSimDebtIds.length === 0) {
      state.selectedSimDebtIds = allDebtsWithBal.map(d => d.id);
    }

    const validSelected = state.selectedSimDebtIds.filter(id => allDebtsWithBal.some(d => d.id === id));

    if (countBadge) {
      if (validSelected.length === allDebtsWithBal.length) {
        countBadge.textContent = `All Debts Selected (${validSelected.length})`;
        countBadge.className = 'kpi-badge badge-positive';
      } else if (validSelected.length === 0) {
        countBadge.textContent = 'None Selected (0)';
        countBadge.className = 'kpi-badge text-danger';
      } else {
        countBadge.textContent = `${validSelected.length} of ${allDebtsWithBal.length} Debts Selected`;
        countBadge.className = 'kpi-badge';
      }
    }

    let html = '';
    allDebtsWithBal.forEach(d => {
      const isChecked = state.selectedSimDebtIds.includes(d.id);
      const icon = d.icon || getDebtIcon(d.type);
      const eir = parseFloat(d.apr) || 0;
      const monthlyRate = d.monthlyRate !== undefined ? parseFloat(d.monthlyRate) : (eir / 12);
      const bal = parseFloat(d.balance) || 0;
      const minPay = parseFloat(d.minPayment) || 0;

      html += `
        <label class="sim-debt-check-item ${isChecked ? 'active' : ''}">
          <input type="checkbox" class="sim-debt-checkbox" data-debt-id="${d.id}" ${isChecked ? 'checked' : ''}>
          <div class="sim-debt-check-info">
            <div class="sim-debt-check-title">
              <span>${icon}</span>
              <span>${escapeHtml(d.name)}</span>
            </div>
            <div class="sim-debt-check-meta">
              <span class="sim-debt-check-balance font-mono">${formatCurrency(bal)}</span>
              <span class="sim-debt-check-rate font-mono">${monthlyRate.toFixed(2)}%/mo | ${eir.toFixed(1)}% EIR</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.1rem;">
              Min: <strong class="font-mono">${formatCurrency(minPay)}/mo</strong>
            </div>
          </div>
        </label>
      `;
    });

    container.innerHTML = html;

    const checkboxes = container.querySelectorAll('.sim-debt-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const debtId = cb.getAttribute('data-debt-id');
        if (cb.checked) {
          if (!state.selectedSimDebtIds.includes(debtId)) state.selectedSimDebtIds.push(debtId);
        } else {
          state.selectedSimDebtIds = state.selectedSimDebtIds.filter(id => id !== debtId);
        }
        renderDebtSelectionList();
        renderSnowballSimulation();
      });
    });
  }

  function renderSnowballSimulation() {
    const tabView = document.getElementById('tabViewSnowball');
    if (!tabView) return;

    renderDebtSelectionList();

    const allDebtsWithBal = state.debts.filter(d => (parseFloat(d.balance) || 0) > 0);

    const simDebtFreeDate = document.getElementById('simDebtFreeDate');
    const simBaselineFreeDate = document.getElementById('simBaselineFreeDate');
    const simTimeSaved = document.getElementById('simTimeSaved');
    const simInterestSaved = document.getElementById('simInterestSaved');
    const simTotalInterestRemaining = document.getElementById('simTotalInterestRemaining');
    const simBaselineInterest = document.getElementById('simBaselineInterest');
    const simPayoffRoadmapCards = document.getElementById('simPayoffRoadmapCards');
    const simAmortizationTableBody = document.getElementById('simAmortizationTableBody');

    if (allDebtsWithBal.length === 0) {
      if (simDebtFreeDate) simDebtFreeDate.textContent = 'Debt Free Today 🎉';
      if (simBaselineFreeDate) simBaselineFreeDate.textContent = 'No active debts';
      if (simTimeSaved) simTimeSaved.textContent = '0 Months';
      if (simInterestSaved) simInterestSaved.textContent = formatCurrency(0);
      if (simTotalInterestRemaining) simTotalInterestRemaining.textContent = formatCurrency(0);
      if (simBaselineInterest) simBaselineInterest.textContent = 'Base: ₱0.00';
      if (simPayoffRoadmapCards) {
        simPayoffRoadmapCards.innerHTML = `
          <div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2rem;">
            No liabilities to simulate. Add your loans to generate your debt-free payoff roadmap.
          </div>
        `;
      }
      if (simAmortizationTableBody) simAmortizationTableBody.innerHTML = '';
      return;
    }

    const debtsWithBal = allDebtsWithBal.filter(d => state.selectedSimDebtIds.includes(d.id));

    if (debtsWithBal.length === 0) {
      if (simDebtFreeDate) simDebtFreeDate.textContent = 'None Selected';
      if (simBaselineFreeDate) simBaselineFreeDate.textContent = 'Select at least 1 debt above';
      if (simTimeSaved) simTimeSaved.textContent = '0 Months';
      if (simInterestSaved) simInterestSaved.textContent = formatCurrency(0);
      if (simTotalInterestRemaining) simTotalInterestRemaining.textContent = formatCurrency(0);
      if (simBaselineInterest) simBaselineInterest.textContent = 'Base: ₱0.00';
      if (simPayoffRoadmapCards) {
        simPayoffRoadmapCards.innerHTML = `
          <div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2rem;">
            ⚠️ No debts selected for simulation. Select one or more debts from the panel above to simulate your payoff strategy.
          </div>
        `;
      }
      if (simAmortizationTableBody) simAmortizationTableBody.innerHTML = '';
      return;
    }

    const strategy = state.snowballStrategy || 'snowball';
    const extraMonthly = parseFloat(state.extraMonthlyPayment) || 0;
    const lumpSum = parseFloat(state.lumpSumAdvancePayment) || 0;

    const baseline = runAmortizationSimulation(debtsWithBal, 'snowball', 0, 0);
    const simulated = runAmortizationSimulation(debtsWithBal, strategy, extraMonthly, lumpSum);

    const monthsSaved = Math.max(0, baseline.totalMonths - simulated.totalMonths);
    const yearsSaved = Math.floor(monthsSaved / 12);
    const remMonthsSaved = monthsSaved % 12;
    let timeSavedStr = `${monthsSaved} Months`;
    if (yearsSaved > 0) {
      timeSavedStr = `${yearsSaved} Yr${yearsSaved > 1 ? 's' : ''} ${remMonthsSaved > 0 ? remMonthsSaved + ' Mo' : ''}`;
    }

    const interestSaved = Math.max(0, baseline.totalInterest - simulated.totalInterest);

    if (simDebtFreeDate) simDebtFreeDate.textContent = simulated.debtFreeDate;
    if (simBaselineFreeDate) simBaselineFreeDate.textContent = `Base: ${baseline.debtFreeDate}`;
    if (simTimeSaved) simTimeSaved.textContent = monthsSaved > 0 ? `${timeSavedStr} Earlier` : 'Standard Rate';
    if (simInterestSaved) simInterestSaved.textContent = formatCurrency(interestSaved);
    if (simTotalInterestRemaining) simTotalInterestRemaining.textContent = formatCurrency(simulated.totalInterest);
    if (simBaselineInterest) simBaselineInterest.textContent = `Base: ${formatCurrency(baseline.totalInterest)}`;

    if (simPayoffRoadmapCards) {
      if (simulated.payoffRoadmap.length === 0) {
        simPayoffRoadmapCards.innerHTML = `
          <div class="text-center text-muted" style="grid-column: 1 / -1; padding: 1.5rem;">
            Calculating payoff roadmap milestones...
          </div>
        `;
      } else {
        let roadmapHtml = '';
        simulated.payoffRoadmap.forEach((step, idx) => {
          roadmapHtml += `
            <div class="roadmap-step-card">
              <span class="step-order-badge">Milestone #${idx + 1}</span>
              <div class="step-debt-name">
                <span>${step.icon}</span>
                <span>${escapeHtml(step.name)}</span>
              </div>
              <div class="step-payoff-date font-mono">${step.monthStr}</div>
              <div class="step-rollover-text font-mono">
                Clears +${formatCurrency(step.freedPayment)}/mo into next debt
              </div>
            </div>
          `;
        });
        simPayoffRoadmapCards.innerHTML = roadmapHtml;
      }
    }

    if (simAmortizationTableBody) {
      let schedHtml = '';
      simulated.schedule.slice(0, 60).forEach(row => {
        schedHtml += `
          <tr>
            <td class="font-mono"><strong>${row.monthStr}</strong> (#${row.month})</td>
            <td class="text-right font-mono">${formatCurrency(row.beginningBal)}</td>
            <td class="text-right font-mono">${formatCurrency(row.minPaid)}</td>
            <td class="text-right font-mono credit-text">${row.extraPaid > 0 ? '+' + formatCurrency(row.extraPaid) : '—'}</td>
            <td class="text-right font-mono debit-text">${formatCurrency(row.interestPaid)}</td>
            <td class="text-right font-mono">${formatCurrency(row.principalPaid)}</td>
            <td class="text-right font-mono" style="font-weight: 700; color: ${row.endingBal <= 0 ? 'var(--credit-color)' : 'var(--text-primary)'}">
              ${row.endingBal <= 0 ? '₱0.00 (PAID)' : formatCurrency(row.endingBal)}
            </td>
          </tr>
        `;
      });
      simAmortizationTableBody.innerHTML = schedHtml;
    }
  }

  function setupDebtsListeners() {
    const modal = document.getElementById('debtsModal');
    document.getElementById('openDebtsModalBtn')?.addEventListener('click', () => {
      switchDebtTab(state.activeDebtTab || 'my_debts');
      modal?.classList.add('active');
    });

    const closeDebts = () => modal?.classList.remove('active');
    document.getElementById('closeDebtsModalBtn')?.addEventListener('click', closeDebts);
    document.getElementById('closeDebtsModalFooterBtn')?.addEventListener('click', closeDebts);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeDebts();
    });

    document.getElementById('tabBtnMyDebts')?.addEventListener('click', () => switchDebtTab('my_debts'));
    document.getElementById('tabBtnSnowball')?.addEventListener('click', () => switchDebtTab('snowball'));

    document.getElementById('simSelectAllDebtsBtn')?.addEventListener('click', () => {
      state.selectedSimDebtIds = state.debts.filter(d => (parseFloat(d.balance) || 0) > 0).map(d => d.id);
      renderDebtSelectionList();
      renderSnowballSimulation();
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Selected all active debts for simulation!', 'info');
    });

    document.getElementById('simDeselectAllDebtsBtn')?.addEventListener('click', () => {
      state.selectedSimDebtIds = [];
      renderDebtSelectionList();
      renderSnowballSimulation();
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Deselected all debts.', 'info');
    });

    const newDebtMonthlyRate = document.getElementById('newDebtMonthlyRate');
    const newDebtApr = document.getElementById('newDebtApr');
    if (newDebtMonthlyRate && newDebtApr) {
      newDebtMonthlyRate.addEventListener('input', (e) => {
        const mVal = parseFloat(e.target.value);
        if (!isNaN(mVal)) newDebtApr.value = (mVal * 12).toFixed(2);
      });
      newDebtApr.addEventListener('input', (e) => {
        const aVal = parseFloat(e.target.value);
        if (!isNaN(aVal)) newDebtMonthlyRate.value = (aVal / 12).toFixed(2);
      });
    }

    const editDebtMonthlyRate = document.getElementById('editDebtMonthlyRate');
    const editDebtApr = document.getElementById('editDebtApr');
    if (editDebtMonthlyRate && editDebtApr) {
      editDebtMonthlyRate.addEventListener('input', (e) => {
        const mVal = parseFloat(e.target.value);
        if (!isNaN(mVal)) editDebtApr.value = (mVal * 12).toFixed(2);
      });
      editDebtApr.addEventListener('input', (e) => {
        const aVal = parseFloat(e.target.value);
        if (!isNaN(aVal)) editDebtMonthlyRate.value = (aVal / 12).toFixed(2);
      });
    }

    document.getElementById('presetCreditCardBtn')?.addEventListener('click', () => {
      document.getElementById('newDebtType').value = 'credit_card';
      if (newDebtMonthlyRate) newDebtMonthlyRate.value = '3.00';
      if (newDebtApr) newDebtApr.value = '36.00';
      const nameInput = document.getElementById('newDebtName');
      if (nameInput && !nameInput.value) nameInput.value = 'Credit Card (BDO/BPI/Citi)';
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Applied Philippine Credit Card Preset (3.0% / mo | 36.0% EIR)', 'info');
    });

    document.getElementById('presetAutoLoanBtn')?.addEventListener('click', () => {
      document.getElementById('newDebtType').value = 'auto';
      if (newDebtMonthlyRate) newDebtMonthlyRate.value = '0.71';
      if (newDebtApr) newDebtApr.value = '8.50';
      const nameInput = document.getElementById('newDebtName');
      if (nameInput && !nameInput.value) nameInput.value = 'Auto Loan (Bank Chattel)';
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Applied Philippine Auto Loan Preset (~8.50% EIR | ~0.71%/mo)', 'info');
    });

    document.getElementById('presetMortgageBtn')?.addEventListener('click', () => {
      document.getElementById('newDebtType').value = 'mortgage';
      if (newDebtMonthlyRate) newDebtMonthlyRate.value = '0.56';
      if (newDebtApr) newDebtApr.value = '6.75';
      const nameInput = document.getElementById('newDebtName');
      if (nameInput && !nameInput.value) nameInput.value = 'Home Mortgage (Bank Fixed)';
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Applied Philippine Home Mortgage Preset (~6.75% EIR | ~0.56%/mo)', 'info');
    });

    document.getElementById('presetSssBtn')?.addEventListener('click', () => {
      document.getElementById('newDebtType').value = 'personal';
      if (newDebtMonthlyRate) newDebtMonthlyRate.value = '0.83';
      if (newDebtApr) newDebtApr.value = '10.00';
      const nameInput = document.getElementById('newDebtName');
      if (nameInput && !nameInput.value) nameInput.value = 'SSS / Pag-IBIG Salary Loan';
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Applied SSS / Pag-IBIG Loan Preset (~10.00% EIR | ~0.83%/mo)', 'info');
    });

    const newDebtForm = document.getElementById('newDebtForm');
    if (newDebtForm) {
      newDebtForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createDebt(
          document.getElementById('newDebtName').value,
          document.getElementById('newDebtType').value,
          document.getElementById('newDebtBalance').value,
          document.getElementById('newDebtMonthlyRate')?.value || '',
          document.getElementById('newDebtApr').value,
          document.getElementById('newDebtMinPay').value,
          document.getElementById('newDebtDueDate').value,
          ''
        );
        document.getElementById('newDebtName').value = '';
        document.getElementById('newDebtBalance').value = '';
        if (document.getElementById('newDebtMonthlyRate')) document.getElementById('newDebtMonthlyRate').value = '';
        document.getElementById('newDebtApr').value = '';
        document.getElementById('newDebtMinPay').value = '';
        document.getElementById('newDebtDueDate').value = '';
      });
    }

    document.getElementById('loadSampleDebtsBtn')?.addEventListener('click', () => {
      state.debts = JSON.parse(JSON.stringify(SAMPLE_DEBTS));
      state.selectedSimDebtIds = state.debts.map(d => d.id);
      if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
      renderDebtsTable();
      renderDebtSelectionList();
      renderSnowballSimulation();
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Loaded sample Home Mortgage, Auto Loan, and Credit Card debts!', 'success');
    });

    const stratSnowballBtn = document.getElementById('stratSnowballBtn');
    const stratAvalancheBtn = document.getElementById('stratAvalancheBtn');

    if (stratSnowballBtn) {
      stratSnowballBtn.addEventListener('click', () => {
        state.snowballStrategy = 'snowball';
        stratSnowballBtn.classList.add('active');
        if (stratAvalancheBtn) stratAvalancheBtn.classList.remove('active');
        renderSnowballSimulation();
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Switched to Debt Snowball Strategy (Lowest Balance First)!', 'info');
      });
    }

    if (stratAvalancheBtn) {
      stratAvalancheBtn.addEventListener('click', () => {
        state.snowballStrategy = 'avalanche';
        stratAvalancheBtn.classList.add('active');
        if (stratSnowballBtn) stratSnowballBtn.classList.remove('active');
        renderSnowballSimulation();
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Switched to Debt Avalanche Strategy (Highest EIR % First)!', 'info');
      });
    }

    const simExtraRange = document.getElementById('simExtraMonthlyRange');
    const simExtraInput = document.getElementById('simExtraMonthlyInput');
    const simExtraDisplay = document.getElementById('simExtraMonthlyDisplay');

    if (simExtraRange && simExtraInput) {
      const syncExtraMonthly = (val) => {
        const num = Math.max(0, parseFloat(val) || 0);
        state.extraMonthlyPayment = num;
        simExtraRange.value = num;
        simExtraInput.value = num;
        if (simExtraDisplay) simExtraDisplay.textContent = `+${formatCurrency(num)} / mo`;
        renderSnowballSimulation();
      };

      simExtraRange.addEventListener('input', (e) => syncExtraMonthly(e.target.value));
      simExtraInput.addEventListener('input', (e) => syncExtraMonthly(e.target.value));
    }

    const simLumpInput = document.getElementById('simLumpSumInput');
    if (simLumpInput) {
      simLumpInput.addEventListener('input', (e) => {
        state.lumpSumAdvancePayment = Math.max(0, parseFloat(e.target.value) || 0);
        renderSnowballSimulation();
      });
    }

    const closeLogPay = () => document.getElementById('logDebtPaymentModal')?.classList.remove('active');
    document.getElementById('closeLogPaymentModalBtn')?.addEventListener('click', closeLogPay);
    document.getElementById('cancelLogPaymentBtn')?.addEventListener('click', closeLogPay);
    document.getElementById('logDebtPaymentModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('logDebtPaymentModal')) closeLogPay();
    });

    const deductWalletCheck = document.getElementById('logPayDeductWalletCheckbox');
    if (deductWalletCheck) {
      deductWalletCheck.addEventListener('change', (e) => {
        const group = document.getElementById('logPayWalletGroup');
        if (group) group.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    const logPayForm = document.getElementById('logDebtPaymentForm');
    if (logPayForm) {
      logPayForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const debtId = document.getElementById('logPayDebtSelect').value;
        const amount = document.getElementById('logPayAmount').value;
        const date = document.getElementById('logPayDate').value;
        const deductWalletId = document.getElementById('logPayDeductWalletCheckbox')?.checked
          ? document.getElementById('logPayWalletSelect').value
          : null;
        const notes = document.getElementById('logPayNotes').value.trim();

        recordDebtPayment(debtId, amount, date, deductWalletId, notes);
      });
    }

    const closeEditDebt = () => document.getElementById('editDebtModal')?.classList.remove('active');
    document.getElementById('closeEditDebtModalBtn')?.addEventListener('click', closeEditDebt);
    document.getElementById('cancelEditDebtBtn')?.addEventListener('click', closeEditDebt);
    document.getElementById('editDebtModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('editDebtModal')) closeEditDebt();
    });

    const editDebtForm = document.getElementById('editDebtForm');
    if (editDebtForm) {
      editDebtForm.addEventListener('submit', (e) => {
        e.preventDefault();
        editDebt(
          document.getElementById('editDebtId').value,
          document.getElementById('editDebtName').value,
          document.getElementById('editDebtType').value,
          document.getElementById('editDebtBalance').value,
          document.getElementById('editDebtMonthlyRate')?.value || '',
          document.getElementById('editDebtApr').value,
          document.getElementById('editDebtMinPay').value,
          document.getElementById('editDebtDueDate').value
        );
      });
    }
  }

  window.BB_DEBTS = {
    getDebtIcon,
    getDebtTypeLabel,
    updateDebtKpis,
    renderDebtsTable,
    createDebt,
    editDebt,
    deleteDebt,
    openEditDebtModal,
    openLogPaymentModal,
    recordDebtPayment,
    switchDebtTab,
    runAmortizationSimulation,
    renderDebtSelectionList,
    renderSnowballSimulation,
    setupDebtsListeners
  };
})(window);
