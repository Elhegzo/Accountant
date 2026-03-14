import Anthropic from '@anthropic-ai/sdk';

/**
 * Maps the documentType string returned by Claude to our internal docType keys.
 */
const DOCUMENT_TYPE_MAP = {
  'T4':    'T4',
  'RL-1':  'RL1',
  'RL-31': 'RL31',
};

/**
 * Explicit prompt that names every box by its number AND its printed description
 * so Claude never confuses a box label (e.g. "14") with a dollar value.
 */
const PROMPT = `You are a Canadian tax document parser. Follow these two steps exactly.

━━━ STEP 1 — Identify the document type ━━━
• T4    → header reads "Statement of Remuneration Paid / État de la rémunération payée". Issued by CRA/ARC.
• RL-1  → header reads "Relevé 1". Issued by Revenu Québec. Fields are labeled with letters (A, B, C, E…) plus the number 235.
• RL-31 → header reads "Relevé 31". About a rental dwelling (logement).

━━━ STEP 2 — Extract dollar amounts ━━━
Read every labeled box. For each box whose amount cell is non-blank and non-zero, record the dollar amount using the key listed below.

⚠️  CRITICAL: The printed box label (e.g. "14", "22", "44") is an identifier, NOT a dollar amount.
    Never use a box label as a value. Only extract the dollar figure printed inside or next to the box.

T4 field keys — match by the box number AND description printed on the slip:
  box14  → "14  Employment income / Revenus d'emploi"
  box16  → "16  Employee's CPP contributions / Cotisations de l'employé au RPC"
  box17  → "17  Employee's QPP contributions / Cotisations de l'employé au RRQ"
  box18  → "18  Employee's EI premiums / Cotisations de l'employé à l'AE"
  box22  → "22  Income tax deducted / Impôt sur le revenu retenu"
  box44  → "44  Union dues / Cotisations syndicales"
  box46  → "46  Charitable donations / Dons de bienfaisance"
  box52  → "52  Pension adjustment / Facteur d'équivalence"
  box55  → "55  Employee's PPIP premiums / Cotisations de l'employé au RPAP"
  box40  → "40  Other taxable allowances and benefits / Autres allocations et avantages imposables"
  box85  → "85  Employee-paid premiums for private health services plans"

RL-1 field keys — match by the box letter AND the French/English label printed beside it:
  boxA   → "A   Revenus d'emploi / Employment income"
  boxBA  → "B.A Cotisations au RRQ / QPP contributions"
  boxBB  → "B.B Cotisations au RRQ – taux supplémentaire / Supplemental QPP"
  boxC   → "C   Cotisations à l'assurance-emploi / EI premiums"
  boxE   → "E   Impôt du Québec retenu / Quebec income tax withheld"
  boxG   → "G   Salaire admissible au RRQ / Admissible salary (QPP)"
  boxH   → "H   Cotisations au RQAP / QPIP premiums"
  boxI   → "I   Salaire admissible au RQAP / Admissible salary (QPIP)"
  boxJ   → "J   Régime privé d'ass. maladie / Private health insurance"
  box235 → "235"

RL-31 field keys:
  boxA         → unit / logement identifier (text)
  boxB         → number of tenants (integer)
  boxC         → full civic address of the dwelling (text)
  landlordName → name of the landlord / locateur (text)

Output rules:
• Skip any box that is blank or zero.
• Dollar amounts: plain numbers, no $ sign, no commas — e.g. 41870.06 not "$41,870.06".
• Do NOT invent values. Only report what is visibly printed on the document.
• Return JSON only — no markdown fences, no explanation.

{
  "documentType": "T4" | "RL-1" | "RL-31",
  "fields": { "box14": 41870.06, "box22": 4442.54 }
}`;

/**
 * Convert a File to a base64 string.
 * Uses a chunked approach to avoid call-stack overflow on large files.
 */
async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Send a tax-slip file to Claude and return { docType, fields }.
 *
 * @param {File}   file    — PDF or image uploaded by the user
 * @param {string} apiKey  — Anthropic API key
 * @returns {{ docType: 'T4'|'RL1'|'RL31', fields: Object }}
 * @throws  {Error} on API failure, unexpected JSON, or unknown document type
 */
export async function extractWithClaude(file, apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY_MISSING');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const base64 = await fileToBase64(file);
  const isPDF = file.type === 'application/pdf';

  const docBlock = isPDF
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: file.type, data: base64 },
      };

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [docBlock, { type: 'text', text: PROMPT }],
      },
    ],
  });

  const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
  console.log('[extractWithClaude] raw response:', rawText);

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('API response contained no JSON object.');
  }

  const data = JSON.parse(jsonMatch[0]);

  const docType = DOCUMENT_TYPE_MAP[data.documentType];
  if (!docType) {
    throw new Error(`Unrecognised document type: "${data.documentType}"`);
  }

  // Drop nulls / empty strings returned by Claude
  const fields = {};
  for (const [key, val] of Object.entries(data.fields ?? {})) {
    if (val !== null && val !== undefined && val !== '') {
      fields[key] = val;
    }
  }

  return { docType, fields };
}
