import { FEDERAL_2025, QUEBEC_2025 } from '../constants/taxRates2025';
import { FEDERAL_CREDITS, QUEBEC_CREDITS } from '../constants/credits2025';

/**
 * Apply progressive tax brackets to taxable income.
 */
function applyBrackets(income, brackets) {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxableInThisBracket = Math.min(income, bracket.max) - bracket.min;
    tax += taxableInThisBracket * bracket.rate;
  }
  return Math.max(0, tax);
}

/**
 * Calculate federal taxes (T1).
 * @param {object} t4 - T4 extracted fields
 * @param {object} rl1 - RL-1 extracted fields
 * @param {object} credits - Additional credits from credit discovery
 * @returns {object} Federal calculation breakdown
 */
export function calculateFederal(t4, rl1, credits = {}) {
  const employmentIncome = t4.box14 || 0;
  const qppContributions = t4.box17 || 0;
  const eiPremiums = t4.box18 || 0;
  const taxAlreadyPaid = t4.box22 || 0;
  const ppipPremiums = t4.box55 || 0;
  const unionDues = t4.box44 || 0;
  const charitableDonations = (t4.box46 || 0) + (credits.donations || 0);
  const rrspDeduction = credits.rrsp || 0;
  const medicalExpenses = credits.medical || 0;

  // Step 1: Total income
  const totalIncome = employmentIncome;

  // Step 2: Deductions
  const deductions = rrspDeduction;
  const taxableIncome = Math.max(0, totalIncome - deductions);

  // Step 3: Gross federal tax
  const grossTax = applyBrackets(taxableIncome, FEDERAL_2025.brackets);

  // Step 4: Non-refundable credits (all at 15%)
  const basicPersonalCredit = FEDERAL_2025.basicPersonalAmount * FEDERAL_CREDITS.basicPersonalRate;
  const qppCredit = qppContributions * FEDERAL_CREDITS.qppRate;
  const eiCredit = eiPremiums * FEDERAL_CREDITS.eiRate;
  const employmentCredit = FEDERAL_2025.canadaEmploymentAmount * FEDERAL_CREDITS.canadaEmploymentRate;
  const ppipCredit = ppipPremiums * FEDERAL_CREDITS.ppipRate;
  const unionDuesCredit = unionDues * FEDERAL_CREDITS.unionDuesRate;

  // Charitable donations credit
  let donationsCredit = 0;
  if (charitableDonations > 0) {
    const firstTier = Math.min(charitableDonations, FEDERAL_CREDITS.donationsFirstTier.limit);
    const secondTier = Math.max(0, charitableDonations - FEDERAL_CREDITS.donationsFirstTier.limit);
    donationsCredit = firstTier * FEDERAL_CREDITS.donationsFirstTier.rate + secondTier * FEDERAL_CREDITS.donationsSecondTier.rate;
  }

  // Medical expenses credit (above threshold)
  let medicalCredit = 0;
  if (medicalExpenses > FEDERAL_CREDITS.medicalExpenseThreshold) {
    medicalCredit = (medicalExpenses - FEDERAL_CREDITS.medicalExpenseThreshold) * 0.15;
  }

  const totalCredits = basicPersonalCredit + qppCredit + eiCredit + employmentCredit + ppipCredit + unionDuesCredit + donationsCredit + medicalCredit;

  // Step 5: Tax after credits
  const taxAfterCredits = Math.max(0, grossTax - totalCredits);

  // Step 6: Quebec Abatement = taxAfterCredits × 16.5%
  const quebecAbatement = taxAfterCredits * FEDERAL_2025.quebecAbatement;

  // Step 7: Net federal tax
  const netFederalTax = Math.max(0, taxAfterCredits - quebecAbatement);

  // Step 8: Refund or owing
  const refundOrOwing = taxAlreadyPaid - netFederalTax;

  return {
    employmentIncome,
    rrspDeduction,
    taxableIncome,
    grossTax,
    basicPersonalCredit,
    qppCredit,
    eiCredit,
    employmentCredit,
    ppipCredit,
    unionDuesCredit,
    donationsCredit,
    medicalCredit,
    totalCredits,
    taxAfterCredits,
    quebecAbatement,
    netFederalTax,
    taxAlreadyPaid,
    refundOrOwing, // positive = refund, negative = owes
  };
}

/**
 * Calculate Quebec provincial taxes (TP-1).
 */
export function calculateQuebec(t4, rl1, credits = {}) {
  const employmentIncome = rl1.boxA || 0;
  const qppContributions = (rl1.boxBA || 0) + (rl1.boxBB || 0);
  const qpipPremiums = rl1.boxH || 0;
  const taxAlreadyPaid = rl1.boxE || 0;
  const unionDues = t4.box44 || 0;
  const privateHealth = (rl1.boxJ || 0) + (rl1.box235 || 0);
  const rrspDeduction = credits.rrsp || 0;

  // Step 1: Total income
  const totalIncome = employmentIncome;

  // Step 2: Quebec deductions
  const employmentDeduction = QUEBEC_2025.employmentDeduction;
  const totalDeductions = qppContributions + qpipPremiums + employmentDeduction + rrspDeduction + unionDues;
  const netIncome = Math.max(0, totalIncome - totalDeductions);

  // Step 3: Gross Quebec tax
  const grossTax = applyBrackets(netIncome, QUEBEC_2025.brackets);

  // Step 4: Quebec non-refundable credits (all at 14%)
  const basicPersonalCredit = QUEBEC_2025.basicPersonalAmount * QUEBEC_CREDITS.basicPersonalRate;
  const qppCredit = qppContributions * QUEBEC_CREDITS.qppRate;
  const qpipCredit = qpipPremiums * QUEBEC_CREDITS.qpipRate;
  const privateHealthCredit = privateHealth * QUEBEC_CREDITS.privateHealthRate;
  const unionDuesCredit = unionDues * QUEBEC_CREDITS.unionDuesRate;

  const totalCredits = basicPersonalCredit + qppCredit + qpipCredit + privateHealthCredit + unionDuesCredit;

  // Step 5: Net Quebec tax
  const netQuebecTax = Math.max(0, grossTax - totalCredits);

  // Step 6: Refund or owing
  const refundOrOwing = taxAlreadyPaid - netQuebecTax;

  return {
    employmentIncome,
    qppContributions,
    qpipPremiums,
    employmentDeduction,
    unionDues,
    rrspDeduction,
    totalDeductions,
    netIncome,
    grossTax,
    basicPersonalCredit,
    qppCredit,
    qpipCredit,
    privateHealthCredit,
    unionDuesCredit,
    totalCredits,
    netQuebecTax,
    taxAlreadyPaid,
    refundOrOwing,
  };
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}
