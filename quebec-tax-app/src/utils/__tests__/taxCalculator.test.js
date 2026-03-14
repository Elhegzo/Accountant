import { describe, it, expect } from 'vitest';
import { calculateFederal, calculateQuebec, formatCurrency } from '../taxCalculator';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Typical Quebec employee with $60,000 income. */
const TYPICAL_T4 = {
  box14: 60_000,  // Employment income
  box17: 3_210,   // QPP contributions (~5.35%)
  box18:   732,   // EI premiums (~1.22%)
  box22: 8_500,   // Federal income tax withheld
  box44:   480,   // Union dues
  box55:   426,   // PPIP premiums
};

const TYPICAL_RL1 = {
  boxA:  60_000,  // Employment income
  boxBA:  3_210,  // QPP contributions
  boxH:     426,  // QPIP premiums
  boxE:   7_200,  // Quebec income tax withheld
};

// ---------------------------------------------------------------------------
// calculateFederal
// ---------------------------------------------------------------------------

describe('calculateFederal', () => {
  it('returns zero net tax for zero income', () => {
    const result = calculateFederal({}, {});
    expect(result.employmentIncome).toBe(0);
    expect(result.grossTax).toBe(0);
    expect(result.netFederalTax).toBe(0);
    expect(result.refundOrOwing).toBe(0);
  });

  it('returns all expected output keys', () => {
    const result = calculateFederal(TYPICAL_T4, TYPICAL_RL1);
    const expected = [
      'employmentIncome', 'rrspDeduction', 'taxableIncome', 'grossTax',
      'basicPersonalCredit', 'qppCredit', 'eiCredit', 'employmentCredit',
      'ppipCredit', 'unionDuesCredit', 'donationsCredit', 'medicalCredit',
      'totalCredits', 'taxAfterCredits', 'quebecAbatement',
      'netFederalTax', 'taxAlreadyPaid', 'refundOrOwing',
    ];
    for (const key of expected) {
      expect(result).toHaveProperty(key);
    }
  });

  it('applies the first bracket correctly for income below $57,375', () => {
    const result = calculateFederal({ box14: 40_000 }, {});
    // All income falls in the 15% bracket
    expect(result.grossTax).toBeCloseTo(40_000 * 0.15, 2);
  });

  it('applies two brackets for income above $57,375', () => {
    const result = calculateFederal({ box14: 70_000 }, {});
    const expected = 57_375 * 0.15 + (70_000 - 57_375) * 0.205;
    expect(result.grossTax).toBeCloseTo(expected, 2);
  });

  it('applies Quebec abatement of 16.5%', () => {
    const result = calculateFederal(TYPICAL_T4, TYPICAL_RL1);
    expect(result.quebecAbatement).toBeCloseTo(result.taxAfterCredits * 0.165, 2);
  });

  it('netFederalTax = taxAfterCredits − quebecAbatement', () => {
    const result = calculateFederal(TYPICAL_T4, TYPICAL_RL1);
    expect(result.netFederalTax).toBeCloseTo(
      result.taxAfterCredits - result.quebecAbatement, 2
    );
  });

  it('refundOrOwing = taxAlreadyPaid − netFederalTax', () => {
    const result = calculateFederal(TYPICAL_T4, TYPICAL_RL1);
    expect(result.refundOrOwing).toBeCloseTo(
      result.taxAlreadyPaid - result.netFederalTax, 2
    );
  });

  it('netFederalTax is never negative', () => {
    // Extremely low income — credits exceed gross tax
    const result = calculateFederal({ box14: 5_000 }, {});
    expect(result.netFederalTax).toBeGreaterThanOrEqual(0);
  });

  it('RRSP deduction reduces taxable income and net tax', () => {
    const baseline  = calculateFederal(TYPICAL_T4, TYPICAL_RL1);
    const withRrsp  = calculateFederal(TYPICAL_T4, TYPICAL_RL1, { rrsp: 5_000 });
    expect(withRrsp.taxableIncome).toBe(baseline.taxableIncome - 5_000);
    expect(withRrsp.netFederalTax).toBeLessThan(baseline.netFederalTax);
  });

  it('charitable donations apply two-tier credit correctly', () => {
    // First $200 at 15%, remainder at 29%
    const result = calculateFederal({ box14: 60_000, box46: 500 }, {});
    const expectedCredit = 200 * 0.15 + 300 * 0.29;
    expect(result.donationsCredit).toBeCloseTo(expectedCredit, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateQuebec
// ---------------------------------------------------------------------------

describe('calculateQuebec', () => {
  it('returns zero net tax for zero income', () => {
    const result = calculateQuebec({}, {});
    expect(result.grossTax).toBe(0);
    expect(result.netQuebecTax).toBe(0);
    expect(result.refundOrOwing).toBe(0);
  });

  it('returns all expected output keys', () => {
    const result = calculateQuebec(TYPICAL_T4, TYPICAL_RL1);
    const expected = [
      'employmentIncome', 'qppContributions', 'qpipPremiums',
      'employmentDeduction', 'unionDues', 'rrspDeduction',
      'totalDeductions', 'netIncome', 'grossTax',
      'basicPersonalCredit', 'qppCredit', 'qpipCredit',
      'privateHealthCredit', 'unionDuesCredit', 'totalCredits',
      'netQuebecTax', 'taxAlreadyPaid', 'refundOrOwing',
    ];
    for (const key of expected) {
      expect(result).toHaveProperty(key);
    }
  });

  it('QPP + QPIP + union dues + employment deduction reduce net income', () => {
    const result = calculateQuebec(TYPICAL_T4, TYPICAL_RL1);
    // calculateQuebec sums: qppContributions + qpipPremiums + employmentDeduction + rrspDeduction + unionDues
    const expectedDeductions =
      TYPICAL_RL1.boxBA + TYPICAL_RL1.boxH + result.employmentDeduction + TYPICAL_T4.box44;
    expect(result.totalDeductions).toBeCloseTo(expectedDeductions, 2);
    expect(result.netIncome).toBeCloseTo(60_000 - expectedDeductions, 2);
  });

  it('applies the first Quebec bracket (14%) for income below $53,255', () => {
    const result = calculateQuebec({}, { boxA: 40_000, boxE: 0 });
    // netIncome = 40000 − employmentDeduction; grossTax should be at 14%
    expect(result.grossTax).toBeCloseTo(result.netIncome * 0.14, 2);
  });

  it('netQuebecTax is never negative', () => {
    const result = calculateQuebec({}, { boxA: 3_000, boxE: 0 });
    expect(result.netQuebecTax).toBeGreaterThanOrEqual(0);
  });

  it('refundOrOwing = taxAlreadyPaid − netQuebecTax', () => {
    const result = calculateQuebec(TYPICAL_T4, TYPICAL_RL1);
    expect(result.refundOrOwing).toBeCloseTo(
      result.taxAlreadyPaid - result.netQuebecTax, 2
    );
  });

  it('combines boxBA and boxBB for total QPP', () => {
    const result = calculateQuebec({}, { boxA: 60_000, boxBA: 2_000, boxBB: 500 });
    expect(result.qppContributions).toBe(2_500);
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats a positive integer', () => {
    expect(formatCurrency(1_234)).toBe('$1,234');
  });

  it('rounds to whole dollars', () => {
    expect(formatCurrency(1_234.56)).toBe('$1,235');
    expect(formatCurrency(1_234.44)).toBe('$1,234');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats a negative amount with a leading minus', () => {
    expect(formatCurrency(-500)).toBe('-$500');
  });

  it('returns an em-dash for null, undefined, and NaN', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });
});
