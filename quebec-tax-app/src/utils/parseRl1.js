/**
 * Extract Relevé 1 box values from extracted text.
 */
export function parseRl1(text) {
  if (!text) return {};

  const result = {};
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  const extractAmount = (text, labels) => {
    for (const label of labels) {
      const patterns = [
        new RegExp(`${label}[:\\s]+([\\d,]+\\.?\\d*)`, 'gi'),
        new RegExp(`([\\d,]+\\.?\\d*)\\s*${label}`, 'gi'),
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount >= 0) return amount;
        }
      }
    }
    return null;
  };

  const boxes = [
    { key: 'boxA', labels: ['case a', 'box a', 'revenus d\'emploi', 'employment income'] },
    { key: 'boxBA', labels: ['case b\\.a', 'box b\\.a', 'cotisations au rrq', 'qpp contributions'] },
    { key: 'boxBB', labels: ['case b\\.b', 'box b\\.b', 'cotisations supplémentaires'] },
    { key: 'boxC', labels: ['case c', 'box c', 'cotisations à l\'assurance-emploi', 'ei premiums'] },
    { key: 'boxE', labels: ['case e', 'box e', 'impôt du québec retenu', 'quebec income tax'] },
    { key: 'boxG', labels: ['case g', 'box g', 'salaire admissible au rrq'] },
    { key: 'boxH', labels: ['case h', 'box h', 'cotisations au rqap', 'qpip'] },
    { key: 'boxI', labels: ['case i', 'box i', 'salaire admissible au rqap'] },
    { key: 'boxJ', labels: ['case j', 'box j', 'régime privé d\'assurance', 'private health'] },
    { key: 'box235', labels: ['case 235', 'box 235', 'régime privé d\'assurance maladie'] },
  ];

  for (const box of boxes) {
    const value = extractAmount(normalized, box.labels);
    if (value !== null) {
      result[box.key] = value;
    }
  }

  return result;
}

export const RL1_FIELD_LABELS = {
  boxA: { label: 'Employment Income', box: 'A', description: 'Your total employment income from this employer (should match T4 Box 14)' },
  boxBA: { label: 'QPP Contributions (Quebec Pension Plan)', box: 'B.A', description: 'Your contributions to the Quebec Pension Plan (RRQ in French)' },
  boxBB: { label: 'Supplemental QPP Contributions', box: 'B.B', description: 'Additional QPP contributions (uncommon — only if you earned over the first ceiling)' },
  boxC: { label: 'EI Premiums', box: 'C', description: 'Employment Insurance premiums deducted (should match T4 Box 18)' },
  boxE: { label: 'Quebec Income Tax Withheld', box: 'E', description: 'Quebec provincial income tax already withheld by your employer' },
  boxG: { label: 'Admissible Salary (QPP)', box: 'G', description: 'The portion of your salary on which QPP was calculated' },
  boxH: { label: 'QPIP Premiums', box: 'H', description: 'Quebec Parental Insurance Plan premiums — used for parental leave benefits' },
  boxI: { label: 'Admissible Salary (QPIP)', box: 'I', description: 'The portion of your salary on which QPIP was calculated' },
  boxJ: { label: 'Private Health Insurance (Employee Share)', box: 'J', description: 'Your share of employer group health/dental premiums — deductible in Quebec' },
  box235: { label: 'Private Health Insurance (Supplemental)', box: '235', description: 'Additional private health insurance premiums paid by employee' },
};
