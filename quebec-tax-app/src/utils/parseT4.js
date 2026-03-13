/**
 * Parse T4 box values from spatially-extracted PDF rows.
 *
 * Each box definition carries:
 *   key       — the result object key
 *   patterns  — RegExp array matched against individual text items (primary)
 *   boxNum    — RegExp for the standalone box number (fallback)
 *
 * Strategy: search for the descriptive keyword first (more unique than a
 * bare number), then extract the nearest amount to its right. Fall back to
 * the standalone box number only if the keyword search fails.
 */
import { findAmountNearLabel } from './extractSpatialText';

const BOX_DEFINITIONS = [
  {
    key: 'box14',
    patterns: [/employment\s+income/i, /revenus?\s+d.emploi/i],
    boxNum: /^14$/,
  },
  {
    key: 'box16',
    patterns: [/employee.s\s+cpp/i, /cpp\s+contributions?/i, /cotisations?\s+(de\s+l.employ[eé]\s+au\s+)?rpc/i],
    boxNum: /^16$/,
  },
  {
    key: 'box17',
    patterns: [/employee.s\s+qpp/i, /qpp\s+contributions?/i, /cotisations?\s+(de\s+l.employ[eé]\s+au\s+)?rrq/i],
    boxNum: /^17$/,
  },
  {
    key: 'box18',
    patterns: [/ei\s+premiums?/i, /employee.s\s+ei/i, /cotisations?\s+.+\s+l.ae/i],
    boxNum: /^18$/,
  },
  {
    key: 'box22',
    patterns: [/income\s+tax\s+deducted/i, /imp[oô]t\s+sur\s+le\s+revenu\s+retenu/i],
    boxNum: /^22$/,
  },
  {
    key: 'box44',
    patterns: [/union\s+dues?/i, /cotisations?\s+syndicales?/i],
    boxNum: /^44$/,
  },
  {
    key: 'box46',
    patterns: [/charitable\s+donations?/i, /dons?\s+de\s+bienfaisance/i],
    boxNum: /^46$/,
  },
  {
    key: 'box52',
    patterns: [/pension\s+adjustment/i, /facteur\s+d.?[eé]quivalence/i],
    boxNum: /^52$/,
  },
  {
    key: 'box55',
    patterns: [/ppip\s+premiums?/i, /cotisations?\s+au\s+rpap/i],
    boxNum: /^55$/,
  },
  {
    key: 'box40',
    patterns: [/other\s+taxable\s+(allowances?|benefits?)/i, /autres\s+avantages?\s+imposables?/i],
    boxNum: /^40$/,
  },
  {
    key: 'box85',
    patterns: [/employee.paid\s+(health|premiums?)/i, /primes?\s+pay[ée]es?\s+par\s+l.employ[eé]/i],
    boxNum: /^85$/,
  },
];

/**
 * @param {Array} rows — spatial rows from extractPDFSpatial()
 * @returns {Object} extracted field values keyed by box identifier
 */
export function parseT4(rows) {
  if (!rows || !rows.length) return {};

  const result = {};

  for (const def of BOX_DEFINITIONS) {
    // Primary: keyword-based search
    let value = findAmountNearLabel(rows, def.patterns);

    // Fallback: standalone box number
    if (value === null) {
      value = findAmountNearLabel(rows, [def.boxNum]);
    }

    if (value !== null) result[def.key] = value;
  }

  return result;
}

export const T4_FIELD_LABELS = {
  box14: { label: 'Employment Income', box: '14', description: 'Your total employment income before deductions', isNumeric: true },
  box16: { label: 'CPP Contributions', box: '16', description: 'Canada Pension Plan contributions (usually $0 for Quebec employees who pay QPP instead)', isNumeric: true },
  box17: { label: 'QPP Contributions (Quebec Pension Plan)', box: '17', description: 'Quebec Pension Plan contributions deducted from your pay', isNumeric: true },
  box18: { label: 'EI Premiums', box: '18', description: 'Employment Insurance premiums deducted from your pay', isNumeric: true },
  box22: { label: 'Federal Income Tax Deducted', box: '22', description: 'Federal income tax already withheld by your employer', isNumeric: true },
  box44: { label: 'Union Dues', box: '44', description: 'Union membership fees — fully deductible federally', isNumeric: true },
  box46: { label: 'Charitable Donations', box: '46', description: 'Donations made through payroll deduction', isNumeric: true },
  box52: { label: 'Pension Adjustment', box: '52', description: 'Reduces your RRSP contribution room if you have a workplace pension', isNumeric: true },
  box55: { label: 'PPIP Premiums', box: '55', description: 'Provincial Parental Insurance Plan premiums (Quebec only)', isNumeric: true },
  box40: { label: 'Other Taxable Benefits', box: '40', description: 'Taxable benefits provided by your employer (e.g., company car, group benefits)', isNumeric: true },
  box85: { label: 'Employee-Paid Health Premiums', box: '85', description: 'Your share of group health insurance premiums', isNumeric: true },
};
