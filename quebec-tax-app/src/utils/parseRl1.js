/**
 * Parse Relevé 1 box values from spatially-extracted PDF rows.
 *
 * RL-1 boxes use letter identifiers (A, B.A, B.B, C, E, G, H, I, J, 235).
 * Both French (Revenu Québec) and English label variants are included.
 */
import { findAmountNearLabel } from './extractSpatialText';

const BOX_DEFINITIONS = [
  {
    key: 'boxA',
    patterns: [
      /revenus?\s+d.emploi/i,
      /employment\s+income/i,
      // Standalone box letter — must be isolated to avoid matching "CASE AB"
      /^A$/,
      /^case\s+a$/i,
      /^box\s+a$/i,
    ],
  },
  {
    key: 'boxBA',
    patterns: [
      /cotisations?\s+(au\s+)?rrq/i,
      /qpp\s+contributions?/i,
      /^B\.?A$/i,
      /^case\s+b\.?a$/i,
    ],
  },
  {
    key: 'boxBB',
    patterns: [
      /cotisations?\s+suppl[eé]mentaires?\s+(au\s+)?rrq/i,
      /supplemental\s+qpp/i,
      /^B\.?B$/i,
      /^case\s+b\.?b$/i,
    ],
  },
  {
    key: 'boxC',
    patterns: [
      /cotisations?\s+.+assurance.emploi/i,
      /ei\s+premiums?/i,
      /^C$/,
      /^case\s+c$/i,
    ],
  },
  {
    key: 'boxE',
    patterns: [
      /imp[oô]t\s+du\s+qu[eé]bec\s+retenu/i,
      /quebec\s+income\s+tax\s+withheld/i,
      /^E$/,
      /^case\s+e$/i,
    ],
  },
  {
    key: 'boxG',
    patterns: [
      /salaire\s+admissible\s+au\s+rrq/i,
      /admissible\s+salary.*rrq/i,
      /^G$/,
      /^case\s+g$/i,
    ],
  },
  {
    key: 'boxH',
    patterns: [
      /cotisations?\s+(au\s+)?rqap/i,
      /qpip\s+premiums?/i,
      /^H$/,
      /^case\s+h$/i,
    ],
  },
  {
    key: 'boxI',
    patterns: [
      /salaire\s+admissible\s+au\s+rqap/i,
      /admissible\s+salary.*qpip/i,
      /^I$/,
      /^case\s+i$/i,
    ],
  },
  {
    key: 'boxJ',
    patterns: [
      /r[eé]gime\s+priv[eé]\s+d.assurance/i,
      /private\s+health\s+insurance/i,
      /^J$/,
      /^case\s+j$/i,
    ],
  },
  {
    key: 'box235',
    patterns: [
      /^235$/,
      /^case\s+235$/i,
      /r[eé]gime\s+priv[eé]\s+d.assurance\s+maladie/i,
    ],
  },
];

/**
 * @param {Array} rows — spatial rows from extractPDFSpatial()
 * @returns {Object} extracted field values keyed by box identifier
 */
export function parseRl1(rows) {
  if (!rows || !rows.length) return {};

  const result = {};

  for (const def of BOX_DEFINITIONS) {
    const value = findAmountNearLabel(rows, def.patterns);
    if (value !== null) result[def.key] = value;
  }

  return result;
}

export const RL1_FIELD_LABELS = {
  boxA:   { label: 'Employment Income', box: 'A', description: 'Your total employment income from this employer (should match T4 Box 14)', isNumeric: true },
  boxBA:  { label: 'QPP Contributions (Quebec Pension Plan)', box: 'B.A', description: 'Your contributions to the Quebec Pension Plan (RRQ in French)', isNumeric: true },
  boxBB:  { label: 'Supplemental QPP Contributions', box: 'B.B', description: 'Additional QPP contributions (uncommon — only if you earned over the first ceiling)', isNumeric: true },
  boxC:   { label: 'EI Premiums', box: 'C', description: 'Employment Insurance premiums deducted (should match T4 Box 18)', isNumeric: true },
  boxE:   { label: 'Quebec Income Tax Withheld', box: 'E', description: 'Quebec provincial income tax already withheld by your employer', isNumeric: true },
  boxG:   { label: 'Admissible Salary (QPP)', box: 'G', description: 'The portion of your salary on which QPP was calculated', isNumeric: true },
  boxH:   { label: 'QPIP Premiums', box: 'H', description: 'Quebec Parental Insurance Plan premiums — used for parental leave benefits', isNumeric: true },
  boxI:   { label: 'Admissible Salary (QPIP)', box: 'I', description: 'The portion of your salary on which QPIP was calculated', isNumeric: true },
  boxJ:   { label: 'Private Health Insurance (Employee Share)', box: 'J', description: 'Your share of employer group health/dental premiums — deductible in Quebec', isNumeric: true },
  box235: { label: 'Private Health Insurance (Supplemental)', box: '235', description: 'Additional private health insurance premiums paid by employee', isNumeric: true },
};
