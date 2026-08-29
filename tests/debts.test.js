/**
 * Bantay Barya - Deterministic Automated Test Suite for Debt Amortization Engine & Helpers
 *
 * Covers:
 * 1. Interest Rate Helpers (getDebtMonthlyRate, getDebtNominalAnnualRate, getDebtEffectiveAnnualRate, calculateMonthlyInterest)
 * 2. Double-Spending Invariant (₱1k + ₱10k example with ₱500 extra)
 * 3. Monthly Diminishing Interest (₱100k @ 2%/mo = ₱2,000 Month 1 interest)
 * 4. Final Payment Below Scheduled Minimum (Unused Cash Redirection)
 * 5. Negative Amortization & Impossible Payoff Horizon Detection
 * 6. Lump-Sum Advance Payoff before Month 1
 * 7. Strategy Target Selection (Snowball vs Avalanche & Interest Minimization)
 * 8. Flat / Add-on vs. Diminishing Balance Method Differences
 * 9. Edge Cases (Empty lists, zero balances, zero interest)
 *
 * Strict Assertion Requirement: Failing calculations throw AssertionError and exit code 1.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Setup headless mock environment
const mockWindow = {
  BB_DATA: {
    SAMPLE_DEBTS: [],
    getRelativeDateString: () => '2026-08-29',
    formatCurrency: (val) => '₱' + (parseFloat(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    escapeHtml: (str) => String(str)
  },
  BB_STATE: {
    debts: [],
    settings: { baseCurrency: 'PHP' }
  }
};

const mockDocument = {
  getElementById: () => null,
  addEventListener: () => {}
};

// Load modules/debts.js into sandboxed context
const debtsFilePath = path.join(__dirname, '..', 'modules', 'debts.js');
const debtsCode = fs.readFileSync(debtsFilePath, 'utf8');

const initModule = new Function('window', 'document', debtsCode);
initModule(mockWindow, mockDocument);

const engine = mockWindow.BB_DEBTS;

if (!engine || typeof engine.runAmortizationSimulation !== 'function') {
  console.error('FATAL: Failed to load BB_DEBTS module.');
  process.exit(1);
}

// Test Runner Infrastructure
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
console.log(' BANTAY BARYA - DETERMINISTIC DEBT & AMORTIZATION TEST SUITE');
console.log('======================================================================');

// =====================================================================
// SUITE 1: Interest Rate Helpers
// =====================================================================
describe('1. Interest Rate Helper Functions', () => {
  test('getDebtMonthlyRate: respects authoritative monthlyRate', () => {
    const debt = { monthlyRate: 1.75, apr: 36 };
    assert.strictEqual(engine.getDebtMonthlyRate(debt), 1.75);
  });

  test('getDebtMonthlyRate: converts legacy apr to monthlyRate (apr / 12)', () => {
    const debt = { apr: 24.0 };
    assert.strictEqual(engine.getDebtMonthlyRate(debt), 2.0);
  });

  test('getDebtMonthlyRate: clamps invalid or negative rates to 0', () => {
    assert.strictEqual(engine.getDebtMonthlyRate({ monthlyRate: -5 }), 0);
    assert.strictEqual(engine.getDebtMonthlyRate(null), 0);
    assert.strictEqual(engine.getDebtMonthlyRate({}), 0);
  });

  test('getDebtNominalAnnualRate: returns monthlyRate * 12 (nominal p.a.)', () => {
    const debt = { monthlyRate: 3.0 };
    assert.strictEqual(engine.getDebtNominalAnnualRate(debt), 36.0);
  });

  test('getDebtEffectiveAnnualRate: correctly calculates compounded EAR: ((1 + m)^12 - 1) * 100', () => {
    const debt = { monthlyRate: 3.0 }; // 3% per month compounded
    const ear = engine.getDebtEffectiveAnnualRate(debt);
    // (1.03^12 - 1) * 100 = 42.576088...%
    const expected = (Math.pow(1 + 0.03, 12) - 1) * 100;
    assert.ok(Math.abs(ear - expected) < 1e-9);
    assert.ok(Math.abs(ear - 42.576) < 0.001);
  });

  test('calculateMonthlyInterest: diminishing balance method (₱100,000 @ 2% = ₱2,000.00)', () => {
    const debt = { balance: 100000, monthlyRate: 2.0, interestMethod: 'diminishing' };
    const interest = engine.calculateMonthlyInterest(debt);
    assert.strictEqual(interest, 2000.00);
  });

  test('calculateMonthlyInterest: flat add-on method uses originalPrincipal', () => {
    const debt = { balance: 50000, originalPrincipal: 100000, monthlyRate: 2.0, interestMethod: 'flat' };
    const interest = engine.calculateMonthlyInterest(debt);
    assert.strictEqual(interest, 2000.00); // 100,000 * 2% = 2,000 regardless of current 50k balance
  });

  test('calculateMonthlyInterest: zero or negative balance yields 0 interest', () => {
    assert.strictEqual(engine.calculateMonthlyInterest({ balance: 0, monthlyRate: 3.0 }), 0);
    assert.strictEqual(engine.calculateMonthlyInterest({ balance: -500, monthlyRate: 3.0 }), 0);
  });
});

// =====================================================================
// SUITE 2: Double-Spending Invariant (₱1k + ₱10k with ₱500 extra)
// =====================================================================
describe('2. Double-Spending Invariant (₱1k + ₱10k example with ₱500 extra)', () => {
  const debts = [
    { id: 'debt_A', name: 'Debt A', balance: 1000, monthlyRate: 0, minPayment: 1000, interestMethod: 'diminishing' },
    { id: 'debt_B', name: 'Debt B', balance: 10000, monthlyRate: 0, minPayment: 1000, interestMethod: 'diminishing' }
  ];

  const res = engine.runAmortizationSimulation(debts, 'snowball', 500, 0);

  test('Month 1: Total paid must be exactly ₱2,500 with Debt B ending balance at ₱8,500', () => {
    const m1 = res.schedule[0];
    assert.strictEqual(m1.month, 1);
    assert.strictEqual(m1.beginningBal, 11000);
    assert.strictEqual(m1.minPaid, 2000, 'Min paid must be 1000 (A) + 1000 (B) = 2000');
    assert.strictEqual(m1.extraPaid, 500, 'Extra paid must be exactly the 500 extra budget');
    assert.strictEqual(m1.totalPaid, 2500, 'Total paid must equal 2500 (no double spending)');
    assert.strictEqual(m1.interestPaid, 0);
    assert.strictEqual(m1.principalPaid, 2500);
    assert.strictEqual(m1.endingBal, 8500, 'Ending balance must be 11000 - 2500 = 8500 (Debt A=0, Debt B=8500)');
  });

  test('Month 1: Debt A is recorded as eliminated in Month 1 milestone', () => {
    assert.strictEqual(res.payoffRoadmap[0].id, 'debt_A');
    assert.strictEqual(res.payoffRoadmap[0].month, 1);
  });

  test('Month 2: Freed ₱1,000 payment from Debt A rolls over to Debt B (Total paid = ₱2,500, Ending bal = ₱6,000)', () => {
    const m2 = res.schedule[1];
    assert.strictEqual(m2.month, 2);
    assert.strictEqual(m2.beginningBal, 8500);
    assert.strictEqual(m2.minPaid, 1000, 'Debt B scheduled min payment is 1000');
    assert.strictEqual(m2.extraPaid, 1500, 'Freed 1000 from A + 500 extra budget = 1500 extra');
    assert.strictEqual(m2.totalPaid, 2500);
    assert.strictEqual(m2.endingBal, 6000, 'Ending balance must be 8500 - 2500 = 6000');
  });

  test('Full Amortization: Debt B paid off at Month 5 with total paid = ₱11,000', () => {
    assert.strictEqual(res.totalMonths, 5);
    assert.strictEqual(res.totalInterest, 0);
    assert.strictEqual(res.totalPaid, 11000);
    assert.strictEqual(res.isPayoffPossible, true);
    assert.strictEqual(res.payoffRoadmap[1].id, 'debt_B');
    assert.strictEqual(res.payoffRoadmap[1].month, 5);
  });
});

// =====================================================================
// SUITE 3: Monthly Diminishing Interest (₱100k @ 2%/mo)
// =====================================================================
describe('3. Monthly Diminishing Interest (₱100,000 @ 2%/mo)', () => {
  const debts = [
    { id: 'd_dim', name: 'Diminishing Loan', balance: 100000, monthlyRate: 2.0, minPayment: 5000, interestMethod: 'diminishing' }
  ];

  const res = engine.runAmortizationSimulation(debts, 'snowball', 0, 0);

  test('Month 1: Accrues exactly ₱2,000 interest, reduces principal by ₱3,000, ending at ₱97,000', () => {
    const m1 = res.schedule[0];
    assert.strictEqual(m1.beginningBal, 100000);
    assert.strictEqual(m1.interestPaid, 2000.00, 'Month 1 interest: 100,000 * 2% = 2,000');
    assert.strictEqual(m1.principalPaid, 3000.00, 'Month 1 principal: 5,000 - 2,000 = 3,000');
    assert.strictEqual(m1.totalPaid, 5000.00);
    assert.strictEqual(m1.endingBal, 97000.00);
  });

  test('Month 2: Accrues exactly ₱1,940 interest (97k * 2%), reduces principal by ₱3,060, ending at ₱93,940', () => {
    const m2 = res.schedule[1];
    assert.strictEqual(m2.beginningBal, 97000.00);
    assert.strictEqual(m2.interestPaid, 1940.00, 'Month 2 interest: 97,000 * 2% = 1,940');
    assert.strictEqual(m2.principalPaid, 3060.00, 'Month 2 principal: 5,000 - 1,940 = 3,060');
    assert.strictEqual(m2.totalPaid, 5000.00);
    assert.strictEqual(m2.endingBal, 93940.00);
  });

  test('Accounting Invariant: Ending Bal == Beginning Bal + Interest Paid - Total Paid across entire schedule', () => {
    res.schedule.forEach(row => {
      const calculatedEnd = row.beginningBal + row.interestPaid - row.totalPaid;
      assert.ok(Math.abs(row.endingBal - calculatedEnd) < 0.001, `Row ${row.month} accounting balance mismatch`);
    });
  });
});

// =====================================================================
// SUITE 4: Final Payment Below Minimum (Unused Cash Redirection)
// =====================================================================
describe('4. Final Payment Below Minimum (Unused Cash Redirection)', () => {
  const debts = [
    { id: 'd_small', name: 'Small Debt', balance: 200, monthlyRate: 0, minPayment: 1000, interestMethod: 'diminishing' },
    { id: 'd_large', name: 'Large Debt', balance: 5000, monthlyRate: 0, minPayment: 500, interestMethod: 'diminishing' }
  ];

  const res = engine.runAmortizationSimulation(debts, 'snowball', 0, 0);

  test('Month 1: Small Debt takes ₱200, unused ₱800 redirects to Large Debt; Month 1 Total Paid == ₱1,500', () => {
    const m1 = res.schedule[0];
    assert.strictEqual(m1.beginningBal, 5200);
    assert.strictEqual(m1.minPaid, 700, 'Actual min applied = 200 (Small) + 500 (Large) = 700');
    assert.strictEqual(m1.extraPaid, 800, 'Unused 800 from Small applied as extra to Large');
    assert.strictEqual(m1.totalPaid, 1500, 'Total paid in Month 1 must equal scheduled budget 1500');
    assert.strictEqual(m1.endingBal, 3700, 'Ending balance = 5200 - 1500 = 3700');
  });

  test('Milestone: Small Debt is eliminated in Month 1', () => {
    assert.strictEqual(res.payoffRoadmap[0].id, 'd_small');
    assert.strictEqual(res.payoffRoadmap[0].month, 1);
  });
});

// =====================================================================
// SUITE 5: Negative Amortization Detection
// =====================================================================
describe('5. Negative Amortization / Unpayable Debt Detection', () => {
  const debts = [
    { id: 'd_toxic', name: 'Toxic Debt', balance: 100000, monthlyRate: 3.0, minPayment: 2000, interestMethod: 'diminishing' }
  ];

  const res = engine.runAmortizationSimulation(debts, 'snowball', 0, 0);

  test('Flags isPayoffPossible = false and provides clear explanation', () => {
    assert.strictEqual(res.isPayoffPossible, false);
    assert.ok(res.impossibleReason.includes('Negative Amortization') || res.impossibleReason.includes('insufficient'));
  });

  test('Debt-free date string displays negative amortization warning, NOT a false future date', () => {
    assert.ok(res.debtFreeDate.includes('Unpayable') || res.debtFreeDate.includes('Negative Amortization'));
    assert.ok(!res.debtFreeDate.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/));
  });

  test('Schedule records the growing balance (₱100,000 + ₱3,000 int - ₱2,000 min = ₱101,000 ending bal)', () => {
    assert.strictEqual(res.schedule[0].beginningBal, 100000);
    assert.strictEqual(res.schedule[0].interestPaid, 3000);
    assert.strictEqual(res.schedule[0].totalPaid, 2000);
    assert.strictEqual(res.schedule[0].endingBal, 101000);
  });
});

// =====================================================================
// SUITE 6: Lump-Sum Advance Payoff before Month 1
// =====================================================================
describe('6. Lump-Sum Payoff (Day 1 / Month 0 Payoff & Rollover)', () => {
  const debts = [
    { id: 'd_A', name: 'Debt A', balance: 5000, monthlyRate: 0, minPayment: 1000, interestMethod: 'diminishing' },
    { id: 'd_B', name: 'Debt B', balance: 20000, monthlyRate: 0, minPayment: 2000, interestMethod: 'diminishing' }
  ];

  const res = engine.runAmortizationSimulation(debts, 'snowball', 0, 5000);

  test('Lump-sum eliminates Debt A at Month 0 / Day 1', () => {
    assert.strictEqual(res.payoffRoadmap[0].id, 'd_A');
    assert.strictEqual(res.payoffRoadmap[0].month, 0);
    assert.strictEqual(res.payoffRoadmap[0].monthStr, 'Lump Sum (Day 1)');
  });

  test('In Month 1, Debt A freed ₱1,000 payment rolls over to Debt B (Total paid = ₱3,000, Ending bal = ₱17,000)', () => {
    const m1 = res.schedule[0];
    assert.strictEqual(m1.beginningBal, 20000);
    assert.strictEqual(m1.minPaid, 2000);
    assert.strictEqual(m1.extraPaid, 1000, 'Freed 1000 from Debt A rolls over to Debt B');
    assert.strictEqual(m1.totalPaid, 3000);
    assert.strictEqual(m1.endingBal, 17000);
  });
});

// =====================================================================
// SUITE 7: Strategy Selection (Snowball vs Avalanche)
// =====================================================================
describe('7. Strategy Selection (Snowball vs Avalanche)', () => {
  const makeDebts = () => [
    { id: 'd_low_bal', name: 'Low Bal (1%/mo)', balance: 2000, monthlyRate: 1.0, minPayment: 500, interestMethod: 'diminishing' },
    { id: 'd_high_rate', name: 'High Rate (3%/mo)', balance: 10000, monthlyRate: 3.0, minPayment: 1000, interestMethod: 'diminishing' }
  ];

  const resSnow = engine.runAmortizationSimulation(makeDebts(), 'snowball', 1000, 0);
  const resAva = engine.runAmortizationSimulation(makeDebts(), 'avalanche', 1000, 0);

  test('Snowball targets lowest balance debt first (d_low_bal eliminated at Month 2)', () => {
    assert.strictEqual(resSnow.payoffRoadmap[0].id, 'd_low_bal');
    assert.strictEqual(resSnow.payoffRoadmap[0].month, 2);
  });

  test('Avalanche targets highest rate debt first (d_low_bal eliminated later at Month 5)', () => {
    assert.strictEqual(resAva.payoffRoadmap[0].id, 'd_low_bal');
    assert.strictEqual(resAva.payoffRoadmap[0].month, 5);
  });

  test('Avalanche results in strictly lower total interest cost than Snowball (₱1,041.77 vs ₱1,099.53)', () => {
    assert.ok(resAva.totalInterest < resSnow.totalInterest, 'Avalanche total interest must be strictly less than Snowball');
    assert.strictEqual(resAva.totalInterest.toFixed(2), '1041.77');
    assert.strictEqual(resSnow.totalInterest.toFixed(2), '1099.53');
  });
});

// =====================================================================
// SUITE 8: Flat / Add-on vs. Diminishing Method Differences
// =====================================================================
describe('8. Flat / Add-on vs Diminishing Balance Method Differences', () => {
  const debtsDim = [{ id: 'd_dim', name: 'Dim', balance: 100000, monthlyRate: 2.0, minPayment: 5000, interestMethod: 'diminishing' }];
  const debtsFlat = [{ id: 'd_flat', name: 'Flat', balance: 100000, originalPrincipal: 100000, monthlyRate: 2.0, minPayment: 5000, interestMethod: 'flat' }];

  const resDim = engine.runAmortizationSimulation(debtsDim, 'snowball', 0, 0);
  const resFlat = engine.runAmortizationSimulation(debtsFlat, 'snowball', 0, 0);

  test('Month 1: Both accrue ₱2,000 interest and end at ₱97,000', () => {
    assert.strictEqual(resDim.schedule[0].interestPaid, 2000.00);
    assert.strictEqual(resDim.schedule[0].endingBal, 97000.00);
    assert.strictEqual(resFlat.schedule[0].interestPaid, 2000.00);
    assert.strictEqual(resFlat.schedule[0].endingBal, 97000.00);
  });

  test('Month 2: Diminishing drops to ₱1,940 int (bal ₱93,940); Flat stays ₱2,000 int (bal ₱94,000)', () => {
    assert.strictEqual(resDim.schedule[1].interestPaid, 1940.00);
    assert.strictEqual(resDim.schedule[1].endingBal, 93940.00);
    assert.strictEqual(resFlat.schedule[1].interestPaid, 2000.00);
    assert.strictEqual(resFlat.schedule[1].endingBal, 94000.00);
  });

  test('Month 2 balance difference between Flat and Diminishing is exactly ₱60.00', () => {
    const diff = resFlat.schedule[1].endingBal - resDim.schedule[1].endingBal;
    assert.strictEqual(diff, 60.00);
  });
});

// =====================================================================
// SUITE 9: Edge Cases & Boundary Conditions
// =====================================================================
describe('9. Edge Cases & Boundary Conditions', () => {
  test('Empty debts array returns debt-free immediately', () => {
    const res = engine.runAmortizationSimulation([], 'snowball', 0, 0);
    assert.strictEqual(res.totalMonths, 0);
    assert.strictEqual(res.totalInterest, 0);
    assert.strictEqual(res.totalPaid, 0);
    assert.strictEqual(res.isPayoffPossible, true);
    assert.strictEqual(res.debtFreeDate, 'Debt Free Today');
  });

  test('Debts with zero balances are filtered out cleanly', () => {
    const debts = [{ id: 'd_zero', name: 'Zero', balance: 0, monthlyRate: 3.0, minPayment: 500 }];
    const res = engine.runAmortizationSimulation(debts, 'snowball', 0, 0);
    assert.strictEqual(res.totalMonths, 0);
    assert.strictEqual(res.debtFreeDate, 'Debt Free Today');
  });
});

// =====================================================================
// TEST REPORT SUMMARY
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
  console.log('\n🎉 ALL TESTS PASSED WITH 100% PRECISION!\n');
  process.exit(0);
}
