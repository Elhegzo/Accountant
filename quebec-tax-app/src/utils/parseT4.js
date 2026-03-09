/**
 * Extract T4 box values from text extracted from a T4 PDF/image.
 * Returns an object with box numbers as keys and extracted numeric values.
 */
export function parseT4(text) {
  if (!text) return {};

  const result = {};

  // Normalize text: collapse whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  // Each box: label patterns and box number
  const boxes = [
    { key: 'box14', labels: ['14', 'employment income', 'revenus d\'emploi'], priority: 1 },
    { key: 'box16', labels: ['16', 'cpp contributions', 'cotisations au rpc'], priority: 1 },
    { key: 'box17', labels: ['17', 'qpp contributions', 'cotisations au rrq'], priority: 1 },
    { key: 'box18', labels: ['18', 'ei premiums', 'cotisations à l\'ae'], priority: 1 },
    { key: 'box22', labels: ['22', 'income tax deducted', 'impôt sur le revenu retenu'], priority: 1 },
    { key: 'box44', labels: ['44', 'union dues', 'cotisations syndicales'], priority: 1 },
    { key: 'box46', labels: ['46', 'charitable donations', 'dons de bienfaisance'], priority: 1 },
    { key: 'box52', labels: ['52', 'pension adjustment', 'facteur d\'équivalence'], priority: 1 },
    { key: 'box55', labels: ['55', 'ppip premiums', 'cotisations au rpap'], priority: 1 },
    { key: 'box40', labels: ['40', 'other taxable allowances', 'autres avantages imposables'], priority: 2 },
    { key: 'box85', labels: ['85', 'employee-paid premiums', 'primes payées par l\'employé'], priority: 2 },
  ];

  // Extract a dollar amount near a box number or label
  // Looks for patterns like "Box 14: 41,870.00" or "14 Employment income 41870"
  const extractAmount = (text, labels) => {
    for (const label of labels) {
      // Try pattern: label followed by amount
      const patterns = [
        new RegExp(`${label}[:\\s]+([\\d,]+\\.?\\d*)`, 'gi'),
        new RegExp(`([\\d,]+\\.?\\d*)\\s*${label}`, 'gi'),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount >= 0) {
            return amount;
          }
        }
      }
    }
    return null;
  };

  for (const box of boxes) {
    const value = extractAmount(normalized, box.labels);
    if (value !== null) {
      result[box.key] = value;
    }
  }

  return result;
}

export const T4_FIELD_LABELS = {
  box14: { label: 'Employment Income', box: '14', description: 'Your total employment income before deductions' },
  box16: { label: 'CPP Contributions', box: '16', description: 'Canada Pension Plan contributions (usually $0 for Quebec employees who pay QPP instead)' },
  box17: { label: 'QPP Contributions (Quebec Pension Plan)', box: '17', description: 'Quebec Pension Plan contributions deducted from your pay' },
  box18: { label: 'EI Premiums', box: '18', description: 'Employment Insurance premiums deducted from your pay' },
  box22: { label: 'Federal Income Tax Deducted', box: '22', description: 'Federal income tax already withheld by your employer' },
  box44: { label: 'Union Dues', box: '44', description: 'Union membership fees — fully deductible federally' },
  box46: { label: 'Charitable Donations', box: '46', description: 'Donations made through payroll deduction' },
  box52: { label: 'Pension Adjustment', box: '52', description: 'Reduces your RRSP contribution room if you have a workplace pension' },
  box55: { label: 'PPIP Premiums', box: '55', description: 'Provincial Parental Insurance Plan premiums (Quebec only)' },
  box40: { label: 'Other Taxable Benefits', box: '40', description: 'Taxable benefits provided by your employer (e.g., company car, group benefits)' },
  box85: { label: 'Employee-Paid Health Premiums', box: '85', description: 'Your share of group health insurance premiums' },
};
