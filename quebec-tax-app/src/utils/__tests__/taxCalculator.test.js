import { describe, it, expect } from 'vitest';
import { calculateFederal, calculateQuebec, splitQpp, formatCurrency } from '../taxCalculator';

// ---------------------------------------------------------------------------
// H&R Block ground-truth fixtures (Mostafa Hegazy 2025 return)
// ---------------------------------------------------------------------------

const HR_T4 = {
  box14: 41870.06,
  box17: 2608.84,
  box18: 548.49,
  box22: 4442.54,
  box26: 42378.14,
  box40: 377.75,
  box55: 206.84,
  box85: 885.83,
};

const HR_RL1 = {
  boxA: 42378.14,
  boxBA: 2608.84,
  boxE: 5421.29,
  boxG: 42378.14,
  boxH: 206.84,
  boxI: 41870.06,
  boxJ: 885.83,
  box235: 885.83,
};

// ---------------------------------------------------------------------------
// splitQpp
// ---------------------------------------------------------------------------

describe('splitQpp', () => {
  it('splits QPP into base and enhanced for typical earnings', () => {
    const result = splitQpp(2608.84, 42378.14);
    expect(result.base).toBeCloseTo(2099.42, 2);
    expect(result.enhanced).toBeCloseTo(388.78, 2);
    expect(result.overpayment).toBeCloseTo(120.64, 2);
  });

  it('returns zero for zero contributions', () => {
    const result = splitQpp(0, 0);
    expect(result.base).toBe(0);
    expect(result.enhanced).toBe(0);
    expect(result.overpayment).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateFederal — H&R Block validation
// ---------------------------------------------------------------------------

describe('calculateFederal', () => {
  it('matches H&R Block federal return line-by-line', () => {
    const r = calculateFederal(HR_T4, HR_RL1);

    // Income
    expect(r.totalIncome).toBeCloseTo(41870.06, 2);
    expect(r.enhancedQppDeduction).toBeCloseTo(388.78, 2);
    expect(r.netIncome).toBeCloseTo(41481.28, 2);
    expect(r.taxableIncome).toBeCloseTo(41481.28, 2);

    // Credits
    expect(r.baseQppAmount).toBeCloseTo(2099.42, 2);
    expect(r.medicalExpenses).toBeCloseTo(885.83, 2);
    expect(r.totalCreditAmounts).toBeCloseTo(17803.40, 0);
    expect(r.creditsAtRate).toBeCloseTo(2581.49, 0);

    // Tax
    expect(r.taxAfterCredits).toBeCloseTo(3433.29, 0);
    expect(r.quebecAbatement).toBeCloseTo(566.49, 0);

    // Refund
    expect(r.refundOrOwing).toBeCloseTo(1575.74, 0);
  });

  it('returns zero net tax for zero income', () => {
    const r = calculateFederal({}, {});
    expect(r.employmentIncome).toBe(0);
    expect(r.grossTax).toBe(0);
    expect(r.netFederalTax).toBe(0);
    expect(r.refundOrOwing).toBe(0);
  });

  it('applies the first bracket at 14.5% for income below $57,375', () => {
    const r = calculateFederal({ box14: 40000 }, {});
    expect(r.grossTax).toBeCloseTo(40000 * 0.145, 2);
  });

  it('applies two brackets for income above $57,375', () => {
    const r = calculateFederal({ box14: 70000 }, {});
    const expected = 57375 * 0.145 + (70000 - 57375) * 0.205;
    expect(r.grossTax).toBeCloseTo(expected, 2);
  });

  it('applies Quebec abatement of 16.5%', () => {
    const r = calculateFederal(HR_T4, HR_RL1);
    expect(r.quebecAbatement).toBeCloseTo(r.taxAfterCredits * 0.165, 2);
  });

  it('netFederalTax is never negative', () => {
    const r = calculateFederal({ box14: 5000 }, {});
    expect(r.netFederalTax).toBeGreaterThanOrEqual(0);
  });

  it('RRSP deduction reduces taxable income and net tax', () => {
    const baseline = calculateFederal(HR_T4, HR_RL1);
    const withRrsp = calculateFederal(HR_T4, HR_RL1, { rrsp: 5000 });
    expect(withRrsp.taxableIncome).toBe(baseline.taxableIncome - 5000);
    expect(withRrsp.netFederalTax).toBeLessThan(baseline.netFederalTax);
  });

  it('charitable donations apply two-tier credit correctly', () => {
    const r = calculateFederal({ box14: 60000, box46: 500 }, {});
    const expectedCredit = 200 * 0.145 + 300 * 0.29;
    expect(r.donationsCredit).toBeCloseTo(expectedCredit, 2);
  });

  it('top-up credit is zero when income is below first bracket', () => {
    const r = calculateFederal(HR_T4, HR_RL1);
    expect(r.topUpCredit).toBe(0);
  });

  it('top-up credit is non-zero when income exceeds first bracket', () => {
    const r = calculateFederal({ box14: 80000 }, {});
    expect(r.topUpCredit).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateQuebec — H&R Block validation
// ---------------------------------------------------------------------------

describe('calculateQuebec', () => {
  it('matches H&R Block Quebec return line-by-line', () => {
    const r = calculateQuebec(HR_T4, HR_RL1);

    // Income
    expect(r.totalIncome).toBeCloseTo(42378.14, 2);
    expect(r.employmentDeduction).toBeCloseTo(1420.00, 2);
    expect(r.enhancedQppDeduction).toBeCloseTo(388.78, 2);
    expect(r.totalDeductions).toBeCloseTo(1808.78, 2);
    expect(r.netIncome).toBeCloseTo(40569.36, 2);
    expect(r.taxableIncome).toBeCloseTo(40569.36, 2);

    // Tax
    expect(r.grossTax).toBeCloseTo(5679.71, 0);

    // Non-refundable credits
    expect(r.bpaAmount).toBeCloseTo(15518.22, 2);
    expect(r.bpaCredit).toBeCloseTo(2172.55, 0);
    expect(r.medicalEligible).toBeCloseTo(501.40, 2);
    expect(r.medicalCredit).toBeCloseTo(100.28, 2);
    expect(r.totalNonRefundableCredits).toBeCloseTo(2272.83, 0);

    // Tax payable
    expect(r.taxPayable).toBeCloseTo(3406.88, 0);

    // Refundable credits
    expect(r.taxAlreadyPaid).toBeCloseTo(5421.29, 2);
    expect(r.qppOverpayment).toBeCloseTo(120.64, 2);
    expect(r.workPremium).toBeCloseTo(1382.60, 2);
    expect(r.totalRefundableCredits).toBeCloseTo(6924.53, 0);

    // Refund
    expect(r.refundOrOwing).toBeCloseTo(3517.65, 0);
  });

  it('returns zero net tax for zero income', () => {
    const r = calculateQuebec({}, {});
    expect(r.grossTax).toBe(0);
    expect(r.taxPayable).toBe(0);
    expect(r.refundOrOwing).toBe(0);
  });

  it('applies the first Quebec bracket (14%) for income below $51,780', () => {
    const r = calculateQuebec({}, { boxA: 40000, boxE: 0 });
    expect(r.grossTax).toBeCloseTo(r.netIncome * 0.14, 2);
  });

  it('taxPayable is never negative', () => {
    const r = calculateQuebec({}, { boxA: 3000, boxE: 0 });
    expect(r.taxPayable).toBeGreaterThanOrEqual(0);
  });

  it('work premium is zero when income is below excluded amount', () => {
    const r = calculateQuebec({}, { boxA: 2000, boxE: 0 });
    expect(r.workPremium).toBe(0);
  });

  it('combines boxBA and boxBB for total QPP', () => {
    // boxBA + boxBB = 3500, which exceeds base QPP for $60k earnings
    // base = (60000-3500)*0.054 = 3051, so enhanced portion exists
    const r = calculateQuebec({}, { boxA: 60000, boxBA: 3000, boxBB: 500, boxG: 60000 });
    expect(r.enhancedQppDeduction).toBeGreaterThan(0);
  });

  it('combined refund matches $5,093.39', () => {
    const fed = calculateFederal(HR_T4, HR_RL1);
    const qc = calculateQuebec(HR_T4, HR_RL1);
    expect(fed.refundOrOwing + qc.refundOrOwing).toBeCloseTo(5093.39, 0);
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats a positive amount with cents', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats a negative amount with a leading minus', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('returns an em-dash for null, undefined, and NaN', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });
});
