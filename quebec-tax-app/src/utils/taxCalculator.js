import { FEDERAL_2025, QUEBEC_2025, QPP_2025, WORK_PREMIUM_2025 } from '../constants/taxRates2025';
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
 * Round to 2 decimal places (standard CRA/RQ rounding).
 */
function r2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split T4 Box 17 QPP contributions into base and enhanced portions.
 */
export function splitQpp(qppPaid, pensionableEarnings) {
  const qppIncome = Math.max(0, Math.min(pensionableEarnings, QPP_2025.ympe) - QPP_2025.basicExemption);
  const baseRequired = r2(qppIncome * QPP_2025.baseRate);
  const enhancedRequired = r2(qppIncome * QPP_2025.enhancedRate);
  const totalRequired = r2(baseRequired + enhancedRequired);

  const base = Math.min(qppPaid, baseRequired);
  const enhanced = Math.min(Math.max(0, qppPaid - baseRequired), enhancedRequired);
  const overpayment = r2(Math.max(0, qppPaid - totalRequired));

  return { base, enhanced, overpayment, baseRequired, enhancedRequired, totalRequired };
}

/**
 * Calculate federal taxes (T1).
 */
export function calculateFederal(t4, rl1, credits = {}) {
  const employmentIncome = t4.box14 || 0;
  const qppPaid = t4.box17 || 0;
  const eiPremiums = t4.box18 || 0;
  const taxAlreadyPaid = t4.box22 || 0;
  const pensionableEarnings = t4.box26 || employmentIncome;
  const ppipPremiums = t4.box55 || 0;
  const medicalExpenses = t4.box85 || 0;
  const unionDues = t4.box44 || 0;
  const charitableDonations = (t4.box46 || 0) + (credits.donations || 0);
  const rrspDeduction = credits.rrsp || 0;

  // --- Bug 1 & 2: Split QPP into base and enhanced ---
  const qpp = splitQpp(qppPaid, pensionableEarnings);

  // Step 1: Total income (line 15000)
  const totalIncome = employmentIncome;

  // Step 2: Deductions — enhanced QPP goes on line 22215
  const enhancedQppDeduction = qpp.enhanced;
  const totalDeductions = enhancedQppDeduction + rrspDeduction;
  const netIncome = r2(Math.max(0, totalIncome - totalDeductions));
  const taxableIncome = netIncome;

  // Step 3: Gross federal tax
  const grossTax = r2(applyBrackets(taxableIncome, FEDERAL_2025.brackets));

  // Step 4: Non-refundable credits (all at 14.5% for 2025)
  const creditRate = FEDERAL_2025.nonRefundableCreditRate;

  const bpaAmount = FEDERAL_2025.basicPersonalAmount;
  const baseQppAmount = qpp.base;                         // line 30800
  const eiAmount = eiPremiums;                             // line 31200
  const ppipAmount = ppipPremiums;                         // line 31210
  const employmentAmount = Math.min(FEDERAL_2025.canadaEmploymentAmount, employmentIncome); // line 31260

  // Bug 3: Medical expenses (line 33099) — threshold = lesser of $2,834 and 3% of net income
  const medThreshold = Math.min(FEDERAL_CREDITS.medicalExpenseThreshold, netIncome * 0.03);
  const medicalCreditAmount = Math.max(0, medicalExpenses - medThreshold);

  // Sum of non-refundable credit amounts (line 33500)
  const totalCreditAmounts = r2(bpaAmount + baseQppAmount + eiAmount + ppipAmount + employmentAmount + medicalCreditAmount);
  const creditsAtRate = r2(totalCreditAmounts * creditRate); // line 33800

  // Bug 6: Top-up tax credit (line 34990) — compensates for 15% → 14.5% rate
  // drop on credits used against income above the first bracket
  const incomeAboveFirstBracket = Math.max(0, taxableIncome - FEDERAL_2025.brackets[0].max);
  const topUpCredit = r2(0.005 * Math.min(totalCreditAmounts, incomeAboveFirstBracket));

  // Charitable donations credit (two-tier)
  let donationsCredit = 0;
  if (charitableDonations > 0) {
    const firstTier = Math.min(charitableDonations, FEDERAL_CREDITS.donationsFirstTier.limit);
    const secondTier = Math.max(0, charitableDonations - FEDERAL_CREDITS.donationsFirstTier.limit);
    donationsCredit = r2(firstTier * FEDERAL_CREDITS.donationsFirstTier.rate + secondTier * FEDERAL_CREDITS.donationsSecondTier.rate);
  }

  const totalCredits = r2(creditsAtRate + topUpCredit + donationsCredit); // line 35000

  // Step 5: Federal tax after credits (line 40600)
  const taxAfterCredits = r2(Math.max(0, grossTax - totalCredits));

  // Step 6: Quebec Abatement (line 44000) = 16.5% of tax after credits
  const quebecAbatement = r2(taxAfterCredits * FEDERAL_2025.quebecAbatement);

  // Step 7: Net federal tax
  const netFederalTax = r2(Math.max(0, taxAfterCredits - quebecAbatement));

  // Step 8: Refund or owing
  const refundOrOwing = r2(taxAlreadyPaid - netFederalTax);

  return {
    // Income
    employmentIncome,
    totalIncome,
    // Deductions
    enhancedQppDeduction,
    rrspDeduction,
    totalDeductions,
    netIncome,
    taxableIncome,
    // Tax
    grossTax,
    // Credit amounts
    bpaAmount,
    baseQppAmount,
    eiAmount,
    ppipAmount,
    employmentAmount,
    medicalExpenses,
    medicalCreditAmount,
    totalCreditAmounts,
    // Credit values
    creditRate,
    creditsAtRate,
    topUpCredit,
    donationsCredit,
    totalCredits,
    // After credits
    taxAfterCredits,
    quebecAbatement,
    netFederalTax,
    taxAlreadyPaid,
    refundOrOwing,
  };
}

/**
 * Calculate Quebec provincial taxes (TP-1).
 */
export function calculateQuebec(t4, rl1, credits = {}) {
  const employmentIncome = rl1.boxA || 0;
  const qppPaid = (rl1.boxBA || 0) + (rl1.boxBB || 0);
  const pensionableEarnings = rl1.boxG || rl1.boxA || 0;
  const qpipPremiums = rl1.boxH || 0;
  const taxAlreadyPaid = rl1.boxE || 0;
  // Use boxJ only (box235 is supplementary info for the same amount)
  const medicalExpenses = rl1.boxJ || 0;
  const unionDues = t4.box44 || 0;
  const rrspDeduction = credits.rrsp || 0;

  // Split QPP into base and enhanced
  const qpp = splitQpp(qppPaid, pensionableEarnings);

  // Step 1: Total income (line 199)
  const totalIncome = employmentIncome;

  // Step 2: Quebec deductions — only workers deduction + enhanced QPP (Bug 7)
  // QPP base and QPIP are NOT deducted from Quebec income
  const employmentDeduction = Math.min(QUEBEC_2025.employmentDeduction, employmentIncome);
  const enhancedQppDeduction = qpp.enhanced;
  const totalDeductions = r2(employmentDeduction + enhancedQppDeduction + rrspDeduction + unionDues);
  const netIncome = r2(Math.max(0, totalIncome - totalDeductions));
  const taxableIncome = netIncome;

  // Step 3: Gross Quebec tax (line 401)
  const grossTax = r2(applyBrackets(taxableIncome, QUEBEC_2025.brackets));

  // Step 4: Non-refundable credits
  const creditRate = QUEBEC_2025.nonRefundableCreditRate;

  // Bug 11: BPA = $15,518.22 for 2025 (line 350 → line 377)
  const bpaAmount = QUEBEC_2025.basicPersonalAmount;
  const bpaCredit = r2(bpaAmount * creditRate); // line 377.1

  // Bug 8: Medical expenses at 20% rate (lines 381-389)
  const medThreshold = QUEBEC_CREDITS.medicalExpenseThreshold;
  const medicalEligible = r2(Math.max(0, medicalExpenses - medThreshold)); // line 381/388
  const medicalCredit = r2(medicalEligible * QUEBEC_CREDITS.medicalExpenseCreditRate); // line 389

  const totalNonRefundableCredits = r2(bpaCredit + medicalCredit); // line 399

  // Step 5: Tax payable (line 413 / line 450)
  const taxPayable = r2(Math.max(0, grossTax - totalNonRefundableCredits));

  // Step 6: Refundable credits
  // Tax withheld (line 451)
  const taxWithheld = taxAlreadyPaid;

  // Bug 9: QPP overpayment (line 452)
  const qppOverpayment = qpp.overpayment;

  // Bug 10: Work premium (line 456)
  const workPremium = calculateWorkPremium(employmentIncome, netIncome);

  const totalRefundableCredits = r2(taxWithheld + qppOverpayment + workPremium); // line 465

  // Step 7: Refund or owing
  const refundOrOwing = r2(totalRefundableCredits - taxPayable);

  return {
    // Income
    employmentIncome,
    totalIncome,
    // Deductions
    employmentDeduction,
    enhancedQppDeduction,
    unionDues,
    rrspDeduction,
    totalDeductions,
    netIncome,
    taxableIncome,
    // Tax
    grossTax,
    // Credits
    bpaAmount,
    bpaCredit,
    medicalExpenses,
    medicalEligible,
    medicalCredit,
    totalNonRefundableCredits,
    // Tax payable
    taxPayable,
    // Refundable credits
    taxAlreadyPaid,
    qppOverpayment,
    workPremium,
    totalRefundableCredits,
    // Result
    refundOrOwing,
  };
}

/**
 * Calculate Quebec work premium (Schedule P) for a single person.
 * Bug 10: This was completely missing.
 */
function calculateWorkPremium(workIncome, netFamilyIncome) {
  const params = WORK_PREMIUM_2025.singlePerson;

  if (workIncome <= params.excludedIncome) return 0;

  // Phase-in: rate × (work income − excluded), capped at max premium
  const phaseIn = Math.min(
    (workIncome - params.excludedIncome) * params.phaseInRate,
    params.maxPremium,
  );

  // Phase-out: reduction rate × excess of net income over threshold
  const phaseOut = Math.max(0, (netFamilyIncome - params.reductionThreshold) * params.reductionRate);

  return r2(Math.max(0, phaseIn - phaseOut));
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}
