export const FEDERAL_2025 = {
  brackets: [
    { min: 0, max: 57375, rate: 0.15 },
    { min: 57375, max: 114750, rate: 0.205 },
    { min: 114750, max: 158519, rate: 0.26 },
    { min: 158519, max: 220000, rate: 0.29 },
    { min: 220000, max: Infinity, rate: 0.33 },
  ],
  basicPersonalAmount: 16129,
  canadaEmploymentAmount: 1433,
  quebecAbatement: 0.165,
};

export const QUEBEC_2025 = {
  brackets: [
    { min: 0, max: 53255, rate: 0.14 },
    { min: 53255, max: 106495, rate: 0.19 },
    { min: 106495, max: 129590, rate: 0.24 },
    { min: 129590, max: Infinity, rate: 0.2575 },
  ],
  basicPersonalAmount: 17183,
  employmentDeduction: 1368,
};
