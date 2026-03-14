export const RL1_FIELD_LABELS = {
  boxA:   { label: 'Employment Income',                        box: 'A',   description: 'Your total employment income from this employer (should match T4 Box 14)', isNumeric: true },
  boxBA:  { label: 'QPP Contributions (Quebec Pension Plan)',  box: 'B.A', description: 'Your contributions to the Quebec Pension Plan (RRQ in French)', isNumeric: true },
  boxBB:  { label: 'Supplemental QPP Contributions',          box: 'B.B', description: 'Additional QPP contributions (uncommon — only if you earned over the first ceiling)', isNumeric: true },
  boxC:   { label: 'EI Premiums',                             box: 'C',   description: 'Employment Insurance premiums deducted (should match T4 Box 18)', isNumeric: true },
  boxE:   { label: 'Quebec Income Tax Withheld',              box: 'E',   description: 'Quebec provincial income tax already withheld by your employer', isNumeric: true },
  boxG:   { label: 'Admissible Salary (QPP)',                 box: 'G',   description: 'The portion of your salary on which QPP was calculated', isNumeric: true },
  boxH:   { label: 'QPIP Premiums',                           box: 'H',   description: 'Quebec Parental Insurance Plan premiums — used for parental leave benefits', isNumeric: true },
  boxI:   { label: 'Admissible Salary (QPIP)',                box: 'I',   description: 'The portion of your salary on which QPIP was calculated', isNumeric: true },
  boxJ:   { label: 'Private Health Insurance (Employee Share)', box: 'J', description: 'Your share of employer group health/dental premiums — deductible in Quebec', isNumeric: true },
  box235: { label: 'Private Health Insurance (Supplemental)', box: '235', description: 'Additional private health insurance premiums paid by employee', isNumeric: true },
};
