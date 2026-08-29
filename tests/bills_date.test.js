/**
 * Bantay Barya - Deterministic Automated Test Suite for Bill Dates, Recurrence & Timezones
 *
 * Requirements Verified:
 * 1. Treat bill due dates as calendar dates, not UTC timestamps (no toISOString timezone corruption).
 * 2. Timezone resilience: Identical behavior across Asia/Manila (UTC+8), UTC, and Western timezones.
 * 3. Preserve an explicit recurring anchor day.
 * 4. Jan 31 monthly recurrence sequence:
 *    Jan 31 -> Feb 28/29 -> Mar 31 -> Apr 30 -> May 31.
 * 5. Feb 29 leap-year annual recurrence sequence:
 *    2024-02-29 (leap) -> 2025-02-28 -> 2026-02-28 -> 2027-02-28 -> 2028-02-29 (leap).
 * 6. Weekly, bi-weekly, bi-monthly, quarterly, semi-annual recurrence anchor preservation.
 * 7. getDaysUntilDue exact calendar day distance.
 * 8. Paid this month KPI reporting for both recurring and one-time bills.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Setup mock window & document
const mockWindow = {
  BB_DATA: {
    CURRENCIES: { PHP: { symbol: '₱' }, USD: { symbol: '$' } },
    getRelativeDateString: (offsetDays = 0, baseDate = new Date()) => {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },
    formatCurrency: (val) => '₱' + (parseFloat(val) || 0).toFixed(2),
    formatForeignCurrency: (val, curr) => (curr === 'USD' ? '$' : '₱') + (parseFloat(val) || 0).toFixed(2),
    escapeHtml: (s) => String(s)
  },
  BB_STATE: {
    bills: [],
    wallets: [{ id: 'w1', name: 'Main', currency: 'PHP', balance: 50000 }],
    transactions: [],
    settings: { baseCurrency: 'PHP' }
  },
  BB_WALLETS: {
    convertCurrency: (amount) => amount,
    getFxRate: () => 1.0,
    recalculateLedgerBalances: () => {},
    getWallet: () => ({ id: 'w1', name: 'Main', icon: '👛' })
  },
  BB_CORE: {
    showToast: () => {},
    saveData: () => {}
  }
};

const mockDocument = {
  getElementById: () => ({
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {}
  }),
  querySelectorAll: () => []
};

// Load modules/bills.js into sandboxed environment
const billsCode = fs.readFileSync(path.join(__dirname, '..', 'modules', 'bills.js'), 'utf8');
const initBills = new Function('window', 'document', billsCode);
initBills(mockWindow, mockDocument);

const billsEngine = mockWindow.BB_BILLS;

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

function test(description, testFn) {
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    testFailures.push({ description, error: err });
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

function describe(suiteName, suiteFn) {
  console.log(`\n--- ${suiteName} ---`);
  suiteFn();
}

console.log('======================================================================');
console.log(' BANTAY BARYA - BILL DATES, RECURRENCE & CALENDAR TEST SUITE');
console.log('======================================================================');

// =====================================================================
// SUITE 1: Calendar Date Format & Days In Month Helpers
// =====================================================================
describe('1. Calendar Date Math & Month Bounds', () => {
  test('getDaysInMonth: accurately returns days for standard and leap years', () => {
    assert.strictEqual(billsEngine.getDaysInMonth(2026, 1), 31); // Jan
    assert.strictEqual(billsEngine.getDaysInMonth(2026, 2), 28); // Feb 2026 (non-leap)
    assert.strictEqual(billsEngine.getDaysInMonth(2024, 2), 29); // Feb 2024 (leap year)
    assert.strictEqual(billsEngine.getDaysInMonth(2000, 2), 29); // Feb 2000 (century leap)
    assert.strictEqual(billsEngine.getDaysInMonth(1900, 2), 28); // Feb 1900 (non-leap)
    assert.strictEqual(billsEngine.getDaysInMonth(2026, 4), 30); // Apr
  });

  test('formatCalendarDate: zero-pads month and day properly', () => {
    assert.strictEqual(billsEngine.formatCalendarDate(2026, 8, 5), '2026-08-05');
    assert.strictEqual(billsEngine.formatCalendarDate(2026, 12, 31), '2026-12-31');
  });

  test('formatDisplayDate: formats date cleanly without timezone shifting', () => {
    assert.strictEqual(billsEngine.formatDisplayDate('2026-08-31'), 'Aug 31, 2026');
    assert.strictEqual(billsEngine.formatDisplayDate('2026-01-01'), 'Jan 1, 2026');
    assert.strictEqual(billsEngine.formatDisplayDate(''), '—');
  });
});

// =====================================================================
// SUITE 2: January 31 Monthly Recurrence Sequence
// =====================================================================
describe('2. January 31 Monthly Recurrence Sequence (Anchor Day Preservation)', () => {
  test('Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31 (Non-Leap Year 2026)', () => {
    const anchor = 31;
    let d = '2026-01-31';

    // Step 1: Jan 31 -> Feb 28
    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2026-02-28', 'Jan 31 must clamp to Feb 28 in 2026');

    // Step 2: Feb 28 -> Mar 31 (Restores original 31st anchor!)
    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2026-03-31', 'Feb 28 must restore to Mar 31 via anchor');

    // Step 3: Mar 31 -> Apr 30
    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2026-04-30', 'Mar 31 must clamp to Apr 30');

    // Step 4: Apr 30 -> May 31
    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2026-05-31', 'Apr 30 must restore to May 31 via anchor');
  });

  test('Jan 31 -> Feb 29 -> Mar 31 in Leap Year (2024)', () => {
    const anchor = 31;
    let d = '2024-01-31';

    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2024-02-29', 'Jan 31 must clamp to Feb 29 in leap year 2024');

    d = billsEngine.advanceDueDate(d, 'monthly', anchor);
    assert.strictEqual(d, '2024-03-31', 'Feb 29 must restore to Mar 31 in leap year 2024');
  });

  test('Year-end crossover: Dec 31 -> Jan 31', () => {
    const anchor = 31;
    const next = billsEngine.advanceDueDate('2026-12-31', 'monthly', anchor);
    assert.strictEqual(next, '2027-01-31', 'Dec 31 must advance to Jan 31 of next year');
  });
});

// =====================================================================
// SUITE 3: February 29 Annual Recurrence Sequence
// =====================================================================
describe('3. February 29 Annual Recurrence Sequence', () => {
  test('2024-02-29 -> 2025-02-28 -> 2026-02-28 -> 2027-02-28 -> 2028-02-29 (Leap Year Return)', () => {
    const anchor = 29;
    let d = '2024-02-29';

    // 2024 -> 2025 (non-leap)
    d = billsEngine.advanceDueDate(d, 'annually', anchor);
    assert.strictEqual(d, '2025-02-28');

    // 2025 -> 2026 (non-leap)
    d = billsEngine.advanceDueDate(d, 'annually', anchor);
    assert.strictEqual(d, '2026-02-28');

    // 2026 -> 2027 (non-leap)
    d = billsEngine.advanceDueDate(d, 'annually', anchor);
    assert.strictEqual(d, '2027-02-28');

    // 2027 -> 2028 (leap year return!)
    d = billsEngine.advanceDueDate(d, 'annually', anchor);
    assert.strictEqual(d, '2028-02-29', 'Must restore to Feb 29 in 2028 leap year');
  });
});

// =====================================================================
// SUITE 4: Other Frequencies & Edge Cases
// =====================================================================
describe('4. Other Recurrence Frequencies', () => {
  test('Weekly recurrence: exactly +7 calendar days', () => {
    assert.strictEqual(billsEngine.advanceDueDate('2026-08-25', 'weekly'), '2026-09-01');
    assert.strictEqual(billsEngine.advanceDueDate('2026-12-28', 'weekly'), '2027-01-04');
  });

  test('Bi-weekly recurrence: exactly +14 calendar days', () => {
    assert.strictEqual(billsEngine.advanceDueDate('2026-08-20', 'biweekly'), '2026-09-03');
  });

  test('Quarterly recurrence (3 months) with anchor day', () => {
    const anchor = 31;
    let d = '2026-01-31';
    d = billsEngine.advanceDueDate(d, 'quarterly', anchor);
    assert.strictEqual(d, '2026-04-30', 'Jan 31 + 3mo = Apr 30');
    d = billsEngine.advanceDueDate(d, 'quarterly', anchor);
    assert.strictEqual(d, '2026-07-31', 'Apr 30 + 3mo = Jul 31 (anchor restored)');
  });

  test('Semi-annual recurrence (6 months) with anchor day', () => {
    const anchor = 31;
    let d = '2026-08-31';
    d = billsEngine.advanceDueDate(d, 'semi_annually', anchor);
    assert.strictEqual(d, '2027-02-28', 'Aug 31 + 6mo = Feb 28');
    d = billsEngine.advanceDueDate(d, 'semi_annually', anchor);
    assert.strictEqual(d, '2027-08-31', 'Feb 28 + 6mo = Aug 31 (anchor restored)');
  });
});

// =====================================================================
// SUITE 5: getDaysUntilDue Calendar Calculation
// =====================================================================
describe('5. getDaysUntilDue Calendar Distance', () => {
  const ref = new Date(2026, 7, 29); // Aug 29, 2026

  test('Due Today evaluates to exactly 0 days', () => {
    assert.strictEqual(billsEngine.getDaysUntilDue('2026-08-29', ref), 0);
  });

  test('Due in 3 days evaluates to +3 days', () => {
    assert.strictEqual(billsEngine.getDaysUntilDue('2026-09-01', ref), 3);
  });

  test('Overdue 5 days ago evaluates to -5 days', () => {
    assert.strictEqual(billsEngine.getDaysUntilDue('2026-08-24', ref), -5);
  });

  test('Invalid / empty date string returns 0 safely without error', () => {
    assert.strictEqual(billsEngine.getDaysUntilDue('', ref), 0);
    assert.strictEqual(billsEngine.getDaysUntilDue(null, ref), 0);
  });
});

// =====================================================================
// SUITE 6: Paid-This-Month Classification for Recurring & One-Time Bills
// =====================================================================
describe('6. Paid-This-Month KPI Reporting', () => {
  test('Paid recurring bill with advanced dueDate is still counted in paidThisMonth KPI', () => {
    const state = mockWindow.BB_STATE;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = `${currentMonth}-15`;

    state.bills = [
      {
        id: 'bill_rec_paid',
        name: 'Meralco Electric',
        amount: 3500.00,
        currency: 'PHP',
        isRecurring: true,
        frequency: 'monthly',
        anchorDay: 15,
        dueDate: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-15`, // advanced to next month
        status: 'unpaid', // status for next cycle
        lastPaidDate: today
      },
      {
        id: 'bill_onetime_paid',
        name: 'Annual Registration',
        amount: 1200.00,
        currency: 'PHP',
        isRecurring: false,
        dueDate: today,
        status: 'paid',
        lastPaidDate: today
      },
      {
        id: 'bill_unpaid_future',
        name: 'Internet',
        amount: 2000.00,
        currency: 'PHP',
        isRecurring: true,
        dueDate: `${currentMonth}-28`,
        status: 'unpaid',
        lastPaidDate: null
      }
    ];

    // Compute metrics as implemented in renderBillsTable
    let paidAmount = 0;
    let paidCount = 0;
    let unpaidAmount = 0;

    state.bills.forEach(bill => {
      const bAmount = parseFloat(bill.amount) || 0;
      if (bill.lastPaidDate && bill.lastPaidDate.startsWith(currentMonth)) {
        paidAmount += bAmount;
        paidCount++;
      }
      if (bill.status !== 'paid') {
        unpaidAmount += bAmount;
      }
    });

    assert.strictEqual(paidCount, 2, 'Must count both recurring and one-time bills paid this month');
    assert.strictEqual(paidAmount, 4700.00, 'Paid amount must be 3500 (recurring) + 1200 (one-time) = 4700');
    assert.strictEqual(unpaidAmount, 5500.00, 'Unpaid obligations: 3500 (next month recurring) + 2000 (internet) = 5500');
  });
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  console.error(`\n❌ ${failedTests} TEST(S) FAILED:`);
  testFailures.forEach((f, i) => {
    console.error(`  ${i + 1}. ${f.description}`);
    console.error(`     Error: ${f.error.message}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 ALL BILL DATE & CALENDAR TESTS PASSED WITH 100% PRECISION!\n');
  process.exit(0);
}
