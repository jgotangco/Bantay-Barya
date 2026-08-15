/**
 * Bantay Barya - Bill Tracker, Payment Schedules & Due Reminders
 */
(function (window) {
  'use strict';

  const {
    CURRENCIES,
    getRelativeDateString,
    formatCurrency,
    formatForeignCurrency,
    escapeHtml
  } = window.BB_DATA;

  const state = window.BB_STATE;

  function getDaysUntilDue(dueDateStr) {
    if (!dueDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDateStr + 'T00:00:00');
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function advanceDueDate(dueDateStr, frequency) {
    const d = new Date(dueDateStr + 'T00:00:00');
    const origDay = d.getDate();
    switch (frequency) {
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'biweekly':
        d.setDate(d.getDate() + 14);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        if (d.getDate() !== origDay) d.setDate(0);
        break;
      case 'bimonthly':
        d.setMonth(d.getMonth() + 2);
        if (d.getDate() !== origDay) d.setDate(0);
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + 3);
        if (d.getDate() !== origDay) d.setDate(0);
        break;
      case 'semi_annually':
        d.setMonth(d.getMonth() + 6);
        if (d.getDate() !== origDay) d.setDate(0);
        break;
      case 'annually':
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
        break;
    }
    return d.toISOString().split('T')[0];
  }

  function getBillCategoryIcon(category) {
    const icons = {
      'Utilities': '⚡',
      'Telecom & Internet': '🌐',
      'Subscriptions': '📱',
      'Housing & Rent': '🏠',
      'Insurance': '🛡️',
      'Loans & Credit': '💳',
      'Government & Taxes': '🏛️',
      'Education': '🎓',
      'Other': '📋'
    };
    return icons[category] || '📋';
  }

  function getFrequencyLabel(frequency) {
    const labels = {
      'weekly': 'Weekly',
      'biweekly': 'Every 2 Weeks',
      'monthly': 'Monthly',
      'bimonthly': 'Bi-monthly (2mo)',
      'quarterly': 'Quarterly (3mo)',
      'semi_annually': 'Semi-Annual (6mo)',
      'annually': 'Annually'
    };
    return labels[frequency] || 'Monthly';
  }

  function checkBillDueNotifications() {
    if (!state.bills) state.bills = [];

    let overdueCount = 0;
    let dueSoonCount = 0;
    let urgentBillNames = [];

    state.bills.forEach(bill => {
      if (bill.status !== 'paid') {
        const days = getDaysUntilDue(bill.dueDate);
        const leadDays = parseInt(bill.notifyDaysBefore) || 0;

        if (days < 0) {
          overdueCount++;
          urgentBillNames.push(`${bill.name} (Overdue ${Math.abs(days)}d)`);
        } else if (days <= leadDays) {
          dueSoonCount++;
          const dayLabel = days === 0 ? 'Due Today' : `Due in ${days}d`;
          urgentBillNames.push(`${bill.name} (${dayLabel})`);
        }
      }
    });

    const totalUrgent = overdueCount + dueSoonCount;

    const headerBadge = document.getElementById('headerBillsBadge');
    const mobileBadge = document.getElementById('mobileBillsBadge');
    const openBtn = document.getElementById('openBillsModalBtn');
    const pill = document.getElementById('billsDueAlertPill');
    const banner = document.getElementById('billsAlertBanner');
    const heading = document.getElementById('billsAlertHeading');
    const msg = document.getElementById('billsAlertMessage');

    if (headerBadge) {
      if (totalUrgent > 0) {
        headerBadge.textContent = totalUrgent;
        headerBadge.style.display = 'inline-flex';
      } else {
        headerBadge.style.display = 'none';
      }
    }

    if (mobileBadge) {
      if (totalUrgent > 0) {
        mobileBadge.textContent = totalUrgent;
        mobileBadge.style.display = 'inline-flex';
      } else {
        mobileBadge.style.display = 'none';
      }
    }

    if (openBtn) {
      if (overdueCount > 0) {
        openBtn.classList.remove('btn-glow-warning');
        openBtn.classList.add('btn-glow-urgent');
        openBtn.title = `⚠️ ${overdueCount} Overdue Bill(s) & ${dueSoonCount} Due Soon!`;
      } else if (dueSoonCount > 0) {
        openBtn.classList.remove('btn-glow-urgent');
        openBtn.classList.add('btn-glow-warning');
        openBtn.title = `🔔 ${dueSoonCount} Bill(s) Due Soon!`;
      } else {
        openBtn.classList.remove('btn-glow-warning', 'btn-glow-urgent');
        openBtn.title = 'Bill Tracker, Payment Schedules & Due Reminders';
      }
    }

    if (pill) {
      if (totalUrgent > 0) {
        pill.textContent = overdueCount > 0
          ? `⚠️ ${overdueCount} Overdue, ${dueSoonCount} Due Soon`
          : `🔔 ${dueSoonCount} Due Soon`;
        pill.style.display = 'inline-block';
      } else {
        pill.style.display = 'none';
      }
    }

    if (banner) {
      if (totalUrgent > 0) {
        banner.style.display = 'flex';
        if (heading) {
          heading.textContent = overdueCount > 0
            ? `⚠️ Urgent: ${overdueCount} Overdue & ${dueSoonCount} Due Soon!`
            : `🔔 Payment Reminder: ${dueSoonCount} Upcoming Bill(s)`;
        }
        if (msg) {
          msg.textContent = urgentBillNames.slice(0, 3).join(' • ') + (urgentBillNames.length > 3 ? ` and ${urgentBillNames.length - 3} more.` : '');
        }
      } else {
        banner.style.display = 'none';
      }
    }
  }

  function renderBillsTable() {
    if (!state.bills) state.bills = [];
    const baseCurr = state.settings.baseCurrency || 'PHP';

    let dueSoonOverdueTotal = 0;
    let dueSoonOverdueCount = 0;
    let totalUnpaidAmount = 0;
    let totalUnpaidCount = 0;
    let paidThisMonthAmount = 0;
    let paidThisMonthCount = 0;
    let estMonthlyTotal = 0;

    const currentMonth = new Date().toISOString().substring(0, 7);

    state.bills.forEach(bill => {
      const bAmount = parseFloat(bill.amount) || 0;
      const bCurr = bill.currency || baseCurr;
      const baseConvertedAmount = window.BB_WALLETS ? window.BB_WALLETS.convertCurrency(bAmount, bCurr, baseCurr) : bAmount;

      if (bill.status === 'paid') {
        if (bill.lastPaidDate && bill.lastPaidDate.startsWith(currentMonth)) {
          paidThisMonthAmount += baseConvertedAmount;
          paidThisMonthCount++;
        }
      } else {
        totalUnpaidAmount += baseConvertedAmount;
        totalUnpaidCount++;

        const days = getDaysUntilDue(bill.dueDate);
        const leadDays = parseInt(bill.notifyDaysBefore) || 0;
        if (days < 0 || days <= leadDays) {
          dueSoonOverdueTotal += baseConvertedAmount;
          dueSoonOverdueCount++;
        }
      }

      if (bill.isRecurring) {
        let monthlyFactor = 1;
        switch (bill.frequency) {
          case 'weekly': monthlyFactor = 4.33; break;
          case 'biweekly': monthlyFactor = 2.16; break;
          case 'monthly': monthlyFactor = 1; break;
          case 'bimonthly': monthlyFactor = 0.5; break;
          case 'quarterly': monthlyFactor = 1 / 3; break;
          case 'semi_annually': monthlyFactor = 1 / 6; break;
          case 'annually': monthlyFactor = 1 / 12; break;
          default: monthlyFactor = 1; break;
        }
        estMonthlyTotal += (baseConvertedAmount * monthlyFactor);
      }
    });

    const dueSoonKpi = document.getElementById('billsDueSoonKpiVal');
    const dueSoonCountSub = document.getElementById('billsDueSoonCountSub');
    const totalUnpaidKpi = document.getElementById('billsTotalUnpaidKpiVal');
    const unpaidCountSub = document.getElementById('billsUnpaidCountSub');
    const paidThisMonthKpi = document.getElementById('billsPaidThisMonthKpiVal');
    const paidCountSub = document.getElementById('billsPaidCountSub');
    const monthlyTotalKpi = document.getElementById('billsMonthlyTotalKpiVal');

    if (dueSoonKpi) dueSoonKpi.textContent = formatCurrency(dueSoonOverdueTotal);
    if (dueSoonCountSub) dueSoonCountSub.textContent = `${dueSoonOverdueCount} bill${dueSoonOverdueCount === 1 ? '' : 's'} need attention`;
    if (totalUnpaidKpi) totalUnpaidKpi.textContent = formatCurrency(totalUnpaidAmount);
    if (unpaidCountSub) unpaidCountSub.textContent = `${totalUnpaidCount} unpaid bill${totalUnpaidCount === 1 ? '' : 's'}`;
    if (paidThisMonthKpi) paidThisMonthKpi.textContent = formatCurrency(paidThisMonthAmount);
    if (paidCountSub) paidCountSub.textContent = `${paidThisMonthCount} settled in ${new Date().toLocaleString('en-US', { month: 'short' })}`;
    if (monthlyTotalKpi) monthlyTotalKpi.textContent = formatCurrency(estMonthlyTotal);

    const statusFilter = state.billStatusFilter || 'all';
    const categoryFilter = state.billCategoryFilter || 'all';
    const searchQuery = (state.billSearchQuery || '').toLowerCase().trim();

    let filtered = state.bills.filter(bill => {
      const days = getDaysUntilDue(bill.dueDate);
      const leadDays = parseInt(bill.notifyDaysBefore) || 0;

      if (statusFilter === 'due_soon') {
        if (bill.status === 'paid' || (days > leadDays && days >= 0)) return false;
      } else if (statusFilter === 'unpaid') {
        if (bill.status === 'paid') return false;
      } else if (statusFilter === 'paid') {
        if (bill.status !== 'paid') return false;
      }

      if (categoryFilter !== 'all' && bill.category !== categoryFilter) return false;

      if (searchQuery) {
        const matchesName = (bill.name || '').toLowerCase().includes(searchQuery);
        const matchesCat = (bill.category || '').toLowerCase().includes(searchQuery);
        const matchesNotes = (bill.notes || '').toLowerCase().includes(searchQuery);
        if (!matchesName && !matchesCat && !matchesNotes) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });

    const badge = document.getElementById('billsListCountBadge');
    if (badge) badge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Bill' : 'Bills'}`;

    const tableBody = document.getElementById('billsTableBody');
    const emptyState = document.getElementById('billsEmptyState');
    if (!tableBody) return;

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    filtered.forEach(bill => {
      const days = getDaysUntilDue(bill.dueDate);
      const leadDays = parseInt(bill.notifyDaysBefore) || 0;
      const w = window.BB_WALLETS ? window.BB_WALLETS.getWallet(bill.walletId) : null;
      const bCurr = bill.currency || baseCurr;
      const isForeign = bCurr !== baseCurr;
      const converted = window.BB_WALLETS ? window.BB_WALLETS.convertCurrency(bill.amount, bCurr, baseCurr) : bill.amount;

      let statusBadge = '';
      if (bill.status === 'paid') {
        statusBadge = `<span class="badge-bill-status badge-bill-paid">✓ Paid Settled</span>`;
      } else if (days < 0) {
        statusBadge = `<span class="badge-bill-status badge-bill-overdue">🔴 Overdue (${Math.abs(days)}d)</span>`;
      } else if (days === 0) {
        statusBadge = `<span class="badge-bill-status badge-bill-due-today">⚡ Due Today!</span>`;
      } else if (days <= leadDays) {
        statusBadge = `<span class="badge-bill-status badge-bill-due-soon">🟡 Due in ${days}d</span>`;
      } else {
        statusBadge = `<span class="badge-bill-status badge-bill-upcoming">⚪ In ${days} days</span>`;
      }

      const scheduleLabel = bill.isRecurring
        ? `<span class="bill-freq-tag">🔄 ${getFrequencyLabel(bill.frequency)}</span>`
        : `<span class="bill-freq-tag">1️⃣ One-Time</span>`;

      const formattedDueDate = bill.dueDate
        ? new Date(bill.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

      const catIcon = getBillCategoryIcon(bill.category);

      html += `
        <tr>
          <td>${statusBadge}</td>
          <td>
            <strong class="font-mono">${formattedDueDate}</strong>
            <div class="bill-notify-hint">🔔 ${leadDays === 0 ? 'On due date' : `${leadDays}d before`}</div>
          </td>
          <td>
            <div style="display: flex; align-items: flex-start; gap: 0.45rem;">
              <span style="font-size: 1.15rem; line-height: 1.2;">${catIcon}</span>
              <div>
                <strong style="color: var(--text-primary); font-size: 0.92rem;">${escapeHtml(bill.name)}</strong>
                <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(bill.category || 'General')}</div>
                ${bill.notes ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">${escapeHtml(bill.notes)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span style="font-size: 0.82rem; font-weight: 500;">
              ${w ? `${w.icon} ${escapeHtml(w.name)}` : 'Main Wallet'}
            </span>
          </td>
          <td class="text-right">
            <div class="font-mono debit-text" style="font-weight: 700; font-size: 0.95rem;">
              ${formatForeignCurrency(bill.amount, bCurr)}
            </div>
            ${isForeign ? `<div class="font-mono text-muted" style="font-size: 0.72rem;">≈ ${formatCurrency(converted)}</div>` : ''}
          </td>
          <td>${scheduleLabel}</td>
          <td class="text-center">
            <div class="row-actions" style="justify-content: center; gap: 0.35rem;">
              ${bill.status !== 'paid' ? `
                <button type="button" class="btn-bill-pay" title="Mark as Paid and advance cycle" onclick="window.app.openMarkBillPaidModal('${bill.id}')">
                  <span>✓ Pay</span>
                </button>
              ` : `
                <button type="button" class="btn btn-ghost btn-sm" title="Mark as Unpaid" onclick="window.app.toggleBillStatus('${bill.id}')" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">
                  <span>↩ Reopen</span>
                </button>
              `}
              <button type="button" class="btn-icon" title="Edit Bill" onclick="window.app.openEditBillModal('${bill.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button type="button" class="btn-icon btn-delete" title="Delete Bill" onclick="window.app.deleteBill('${bill.id}')">
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

  function saveBillFromForm(e) {
    e.preventDefault();
    const editId = document.getElementById('billEditId')?.value;
    const name = (document.getElementById('billName')?.value || '').trim();
    const category = document.getElementById('billCategory')?.value;
    const walletId = document.getElementById('billWalletSelect')?.value;
    const currency = document.getElementById('billCurrencySelect')?.value;
    const amount = parseFloat(document.getElementById('billAmount')?.value) || 0;
    const dueDate = document.getElementById('billDueDate')?.value;
    const isRecurring = document.getElementById('billTypeRecurring')?.checked;
    const frequency = document.getElementById('billFrequency')?.value;
    const notifyDaysBefore = parseInt(document.getElementById('billNotifyPreference')?.value) || 0;
    const notes = (document.getElementById('billNotes')?.value || '').trim();
    const autoPostTx = document.getElementById('billAutoPostTx')?.checked;

    if (!name || isNaN(amount) || amount <= 0 || !dueDate) {
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Please provide a valid bill name, amount, and due date.', 'error');
      return;
    }

    if (editId) {
      const existing = state.bills.find(b => b.id === editId);
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.walletId = walletId;
        existing.currency = currency;
        existing.amount = amount;
        existing.dueDate = dueDate;
        existing.isRecurring = isRecurring;
        existing.frequency = frequency;
        existing.notifyDaysBefore = notifyDaysBefore;
        existing.notes = notes;
        existing.autoPostTx = autoPostTx;
        existing.updatedAt = Date.now();
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Updated bill "${name}"!`, 'success');
      }
    } else {
      const newBill = {
        id: 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: name,
        category: category,
        walletId: walletId,
        currency: currency,
        amount: amount,
        dueDate: dueDate,
        isRecurring: isRecurring,
        frequency: frequency,
        notifyDaysBefore: notifyDaysBefore,
        status: 'unpaid',
        lastPaidDate: null,
        autoPostTx: autoPostTx,
        notes: notes,
        createdAt: Date.now()
      };
      state.bills.push(newBill);
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Scheduled new bill "${name}" (${formatForeignCurrency(amount, currency)})!`, 'success');
    }

    resetBillForm();
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    checkBillDueNotifications();
    renderBillsTable();
  }

  function resetBillForm() {
    const form = document.getElementById('billForm');
    if (!form) return;
    document.getElementById('billEditId').value = '';
    document.getElementById('billName').value = '';
    document.getElementById('billCategory').value = 'Utilities';
    document.getElementById('billAmount').value = '';
    document.getElementById('billDueDate').value = getRelativeDateString(3);
    document.getElementById('billTypeRecurring').checked = true;
    const freqGroup = document.getElementById('billFrequencyGroup');
    if (freqGroup) freqGroup.style.display = 'block';
    document.getElementById('billFrequency').value = 'monthly';
    document.getElementById('billNotifyPreference').value = '3';
    document.getElementById('billNotes').value = '';
    document.getElementById('billAutoPostTx').checked = true;
    const title = document.getElementById('billFormTitle');
    const saveBtn = document.getElementById('saveBillBtn');
    if (title) title.textContent = '➕ Schedule a New Bill';
    if (saveBtn) saveBtn.innerHTML = '<span>💾 Save Bill Schedule</span>';
  }

  function openEditBillModal(billId) {
    const bill = state.bills.find(b => b.id === billId);
    if (!bill) return;

    document.getElementById('billEditId').value = bill.id;
    document.getElementById('billName').value = bill.name;
    document.getElementById('billCategory').value = bill.category || 'Utilities';
    const walletSel = document.getElementById('billWalletSelect');
    if (walletSel) walletSel.value = bill.walletId || state.wallets[0]?.id;
    const currSel = document.getElementById('billCurrencySelect');
    if (currSel) currSel.value = bill.currency || state.settings.baseCurrency || 'PHP';
    document.getElementById('billAmount').value = (parseFloat(bill.amount) || 0).toFixed(2);
    document.getElementById('billDueDate').value = bill.dueDate;

    if (bill.isRecurring) {
      document.getElementById('billTypeRecurring').checked = true;
      const freqGroup = document.getElementById('billFrequencyGroup');
      if (freqGroup) freqGroup.style.display = 'block';
      document.getElementById('billFrequency').value = bill.frequency || 'monthly';
    } else {
      document.getElementById('billTypeOneTime').checked = true;
      const freqGroup = document.getElementById('billFrequencyGroup');
      if (freqGroup) freqGroup.style.display = 'none';
    }

    document.getElementById('billNotifyPreference').value = String(bill.notifyDaysBefore !== undefined ? bill.notifyDaysBefore : 3);
    document.getElementById('billNotes').value = bill.notes || '';
    document.getElementById('billAutoPostTx').checked = bill.autoPostTx !== false;

    const title = document.getElementById('billFormTitle');
    const saveBtn = document.getElementById('saveBillBtn');
    if (title) title.textContent = `✏️ Edit Bill: ${bill.name}`;
    if (saveBtn) saveBtn.innerHTML = '<span>Update Bill Schedule</span>';

    document.getElementById('billFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openMarkBillPaidModal(billId) {
    const bill = state.bills.find(b => b.id === billId);
    if (!bill) return;

    document.getElementById('payBillId').value = bill.id;
    document.getElementById('payBillNameDisplay').textContent = bill.name;
    document.getElementById('payBillAmountDisplay').textContent = formatForeignCurrency(bill.amount, bill.currency || state.settings.baseCurrency);
    document.getElementById('payBillDateInput').value = getRelativeDateString(0);

    const payWalletSel = document.getElementById('payBillWalletSelect');
    if (payWalletSel) payWalletSel.value = bill.walletId || state.wallets[0]?.id;

    document.getElementById('payBillPostTxCheckbox').checked = bill.autoPostTx !== false;

    const formattedDue = bill.dueDate
      ? new Date(bill.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    document.getElementById('payBillMetaDisplay').textContent = `Due: ${formattedDue} • ${bill.isRecurring ? getFrequencyLabel(bill.frequency) : 'One-Time'}`;

    const nextNotice = document.getElementById('payBillNextCycleNotice');
    const nextDisplay = document.getElementById('payBillNextDateDisplay');

    if (bill.isRecurring) {
      const nextDate = advanceDueDate(bill.dueDate, bill.frequency);
      const formattedNext = new Date(nextDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (nextDisplay) nextDisplay.textContent = formattedNext;
      if (nextNotice) nextNotice.style.display = 'block';
    } else {
      if (nextNotice) nextNotice.style.display = 'none';
    }

    document.getElementById('markBillPaidModal')?.classList.add('active');
  }

  function confirmMarkBillPaid(e) {
    e.preventDefault();
    const billId = document.getElementById('payBillId')?.value;
    const bill = state.bills.find(b => b.id === billId);
    if (!bill) return;

    const payDate = document.getElementById('payBillDateInput')?.value || getRelativeDateString(0);
    const payWalletId = document.getElementById('payBillWalletSelect')?.value;
    const postTx = document.getElementById('payBillPostTxCheckbox')?.checked;

    const baseCurr = state.settings.baseCurrency || 'PHP';
    const bCurr = bill.currency || baseCurr;
    const bAmount = parseFloat(bill.amount) || 0;
    const baseConvertedAmount = window.BB_WALLETS ? window.BB_WALLETS.convertCurrency(bAmount, bCurr, baseCurr) : bAmount;
    const fxRate = window.BB_WALLETS ? window.BB_WALLETS.getFxRate(bCurr, baseCurr) : 1.0;

    if (postTx) {
      const newTx = {
        id: 'tx_bill_' + Date.now(),
        walletId: payWalletId,
        date: payDate,
        item: bill.name,
        type: 'debit',
        inputCurrency: bCurr,
        inputAmount: bAmount,
        exchangeRate: fxRate,
        credit: 0,
        debit: baseConvertedAmount,
        notes: `Paid via Bill Tracker (${bill.category}${bill.notes ? ' • ' + bill.notes : ''})`,
        createdAt: Date.now()
      };
      state.transactions.push(newTx);
    }

    if (bill.isRecurring) {
      const oldDue = bill.dueDate;
      bill.dueDate = advanceDueDate(oldDue, bill.frequency);
      bill.lastPaidDate = payDate;
      bill.status = 'unpaid';
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Settled ${bill.name}! Next cycle advanced to ${bill.dueDate}.`, 'success');
    } else {
      bill.status = 'paid';
      bill.lastPaidDate = payDate;
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Marked ${bill.name} as paid!`, 'success');
    }

    document.getElementById('markBillPaidModal')?.classList.remove('active');
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    if (window.BB_WALLETS) window.BB_WALLETS.recalculateLedgerBalances();
    checkBillDueNotifications();
    renderBillsTable();
  }

  function toggleBillStatus(billId) {
    const bill = state.bills.find(b => b.id === billId);
    if (!bill) return;
    bill.status = bill.status === 'paid' ? 'unpaid' : 'paid';
    if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
    checkBillDueNotifications();
    renderBillsTable();
    if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Bill status updated to ${bill.status}!`, 'info');
  }

  function deleteBill(billId) {
    const bill = state.bills.find(b => b.id === billId);
    if (!bill) return;

    if (confirm(`Remove bill "${bill.name}" from schedule?`)) {
      state.bills = state.bills.filter(b => b.id !== billId);
      if (window.BB_CORE?.saveData) window.BB_CORE.saveData();
      checkBillDueNotifications();
      renderBillsTable();
      if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Deleted bill "${bill.name}".`, 'info');
    }
  }

  function setupBillsListeners() {
    const modal = document.getElementById('billsModal');
    const openModal = () => {
      if (window.BB_WALLETS) window.BB_WALLETS.populateWalletDropdowns();
      checkBillDueNotifications();
      renderBillsTable();
      modal?.classList.add('active');
    };

    const closeModal = () => modal?.classList.remove('active');

    document.getElementById('openBillsModalBtn')?.addEventListener('click', openModal);
    document.getElementById('closeBillsModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeBillsModalFooterBtn')?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById('dismissBillsAlertBtn')?.addEventListener('click', () => {
      const banner = document.getElementById('billsAlertBanner');
      if (banner) banner.style.display = 'none';
    });

    const billTypeRecurring = document.getElementById('billTypeRecurring');
    const billTypeOneTime = document.getElementById('billTypeOneTime');
    const freqGroup = document.getElementById('billFrequencyGroup');

    if (billTypeRecurring && billTypeOneTime) {
      billTypeRecurring.addEventListener('change', () => {
        if (freqGroup) freqGroup.style.display = 'block';
      });
      billTypeOneTime.addEventListener('change', () => {
        if (freqGroup) freqGroup.style.display = 'none';
      });
    }

    const billCurrencySelect = document.getElementById('billCurrencySelect');
    const billAmountPrefix = document.getElementById('billAmountPrefix');
    if (billCurrencySelect && billAmountPrefix) {
      billCurrencySelect.addEventListener('change', (e) => {
        const sym = CURRENCIES[e.target.value]?.symbol || e.target.value;
        billAmountPrefix.textContent = sym;
      });
    }

    document.querySelectorAll('.bill-date-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const offset = parseInt(btn.dataset.offset) || 0;
        const dueInput = document.getElementById('billDueDate');
        if (dueInput) dueInput.value = getRelativeDateString(offset);
      });
    });

    document.querySelectorAll('.bill-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const cat = btn.dataset.cat;
        const freq = btn.dataset.freq;

        const nameInput = document.getElementById('billName');
        const catInput = document.getElementById('billCategory');
        const recurringRadio = document.getElementById('billTypeRecurring');
        const freqInput = document.getElementById('billFrequency');
        const dueInput = document.getElementById('billDueDate');
        const amountInput = document.getElementById('billAmount');

        if (nameInput) nameInput.value = name;
        if (catInput) catInput.value = cat;
        if (recurringRadio) recurringRadio.checked = true;
        if (freqGroup) freqGroup.style.display = 'block';
        if (freqInput) freqInput.value = freq;
        if (dueInput) dueInput.value = getRelativeDateString(5);
        if (amountInput) amountInput.focus();
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast(`Template applied for ${name}!`, 'info');
      });
    });

    document.getElementById('billForm')?.addEventListener('submit', saveBillFromForm);
    document.getElementById('cancelBillFormBtn')?.addEventListener('click', resetBillForm);

    document.getElementById('billStatusFilter')?.addEventListener('change', (e) => {
      state.billStatusFilter = e.target.value;
      renderBillsTable();
    });

    document.getElementById('billCategoryFilter')?.addEventListener('change', (e) => {
      state.billCategoryFilter = e.target.value;
      renderBillsTable();
    });

    document.getElementById('billSearchInput')?.addEventListener('input', (e) => {
      state.billSearchQuery = e.target.value;
      renderBillsTable();
    });

    const closeMarkPaidModal = () => document.getElementById('markBillPaidModal')?.classList.remove('active');
    document.getElementById('closeMarkBillPaidModalBtn')?.addEventListener('click', closeMarkPaidModal);
    document.getElementById('cancelMarkBillPaidBtn')?.addEventListener('click', closeMarkPaidModal);
    document.getElementById('markBillPaidModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('markBillPaidModal')) closeMarkPaidModal();
    });
    document.getElementById('markBillPaidForm')?.addEventListener('submit', confirmMarkBillPaid);
  }

  window.BB_BILLS = {
    getDaysUntilDue,
    advanceDueDate,
    getBillCategoryIcon,
    getFrequencyLabel,
    checkBillDueNotifications,
    renderBillsTable,
    saveBillFromForm,
    resetBillForm,
    openEditBillModal,
    openMarkBillPaidModal,
    confirmMarkBillPaid,
    toggleBillStatus,
    deleteBill,
    setupBillsListeners
  };
})(window);
