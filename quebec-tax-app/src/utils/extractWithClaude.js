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
 * System prompt sent alongside every document.
 *
 * We include the exact field key names so Claude returns values that map
 * directly to T4_FIELD_LABELS / RL1_FIELD_LABELS / RL31_FIELD_LABELS
 * without any post-processing normalisation.
 */
const PROMPT = `You are a Canadian tax document parser. Analyze this document and do two things:

1. Identify the document type — it will be one of: T4, RL-1, or RL-31. Use the document content to determine this automatically. Never ask the user to identify it.

2. Extract ONLY the boxes/fields that contain actual values. Skip any field that is empty or blank.

Return JSON only, no explanation. Format:
{
  "documentType": "T4" | "RL-1" | "RL-31",
  "fields": {
    "box14": 41870.06,
    "box22": 4442.54,
    ... only filled fields
  }
}

Use these exact field keys for each document type:

T4 keys: box14 (Employment Income), box16 (CPP Contributions), box17 (QPP Contributions),
  box18 (EI Premiums), box22 (Federal Income Tax Deducted), box44 (Union Dues),
  box46 (Charitable Donations), box52 (Pension Adjustment), box55 (PPIP Premiums),
  box40 (Other Taxable Benefits), box85 (Employee-Paid Health Premiums)

RL-1 keys: boxA (Employment Income), boxBA (QPP Contributions), boxBB (Supplemental QPP),
  boxC (EI Premiums), boxE (Quebec Income Tax Withheld), boxG (Admissible Salary QPP),
  boxH (QPIP Premiums), boxI (Admissible Salary QPIP), boxJ (Private Health Insurance),
  box235 (Supplemental Private Health Insurance)

RL-31 keys: boxA (Unit/Logement Number — string), boxB (Number of Tenants — integer),
  boxC (Address of Dwelling — string), landlordName (Landlord Name — string)

Numeric values must be plain numbers without $ signs or commas (e.g. 41870.06 not "$41,870.06").
Only include a key when the corresponding field has a value in the document.`;

/**
 * Convert a File to a base64 string.
 * Uses a chunked approach to avoid call-stack overflow on large files.
 */
async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Process in 8 KB chunks to stay well within call-stack limits
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
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const base64 = await fileToBase64(file);
  const isPDF = file.type === 'application/pdf';

  // Build the multimodal content block
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

  // Extract the text block from the response
  const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';

  // Pull the JSON object out (handles any surrounding explanation Claude adds)
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
