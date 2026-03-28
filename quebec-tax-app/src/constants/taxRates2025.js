export const FEDERAL_2025 = {
  brackets: [
    { min: 0, max: 57375, rate: 0.145 },
    { min: 57375, max: 114750, rate: 0.205 },
    { min: 114750, max: 177882, rate: 0.26 },
    { min: 177882, max: 253414, rate: 0.29 },
    { min: 253414, max: Infinity, rate: 0.33 },
  ],
  // Blended BPA for 2025: the mid-year rate change (15% → 14%) created a
  // prorated BPA that differs from the nominal $16,129. The H&R Block T1
  // confirms $13,477.65 on line 30000.
  basicPersonalAmount: 13477.65,
  canadaEmploymentAmount: 1471,
  quebecAbatement: 0.165,
  nonRefundableCreditRate: 0.145,
  medicalExpenseThreshold: 2834,
};

export const QUEBEC_2025 = {
  brackets: [
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, max: Infinity, rate: 0.2575 },
  ],
  basicPersonalAmount: 15518.22,
  employmentDeduction: 1420,
  nonRefundableCreditRate: 0.14,
  medicalExpenseCreditRate: 0.20,
  medicalExpenseThreshold: 384.43,
};

export const QPP_2025 = {
  ympe: 71300,
  basicExemption: 3500,
  baseRate: 0.054,
  enhancedRate: 0.01,
};

export const WORK_PREMIUM_2025 = {
  singlePerson: {
    excludedIncome: 2400,
    phaseInRate: 0.116,
    maxPremium: 1382.60,
    reductionThreshold: 56500,
    reductionRate: 0.07,
  },
};
