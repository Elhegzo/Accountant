import Anthropic from '@anthropic-ai/sdk';

const DOCUMENT_TYPE_MAP = {
  'T4':    'T4',
  'RL-1':  'RL1',
  'RL-31': 'RL31',
};

/**
 * System-level instruction — processed before the document.
 * Kept short and natural to match the way Claude.ai parses these forms.
 */
const SYSTEM = `You are an expert at reading Canadian tax slips (T4, Relevé 1, RL-31).
When given a document, you identify its type and extract every filled-in box value.
You return ONLY a JSON object — no prose, no markdown fences.`;

/**
 * User-turn instruction appended after the document content.
 * Lists exact key names to avoid any key-name ambiguity.
 */
const USER_INSTRUCTION = `Please extract all filled-in boxes from this tax slip.

Rules:
- Box LABELS (numbers like 14, 22, 44) are identifiers, never dollar values.
- Only include boxes that actually contain a printed amount — skip blanks and zeros.
- Dollar amounts: plain numbers, no $ or commas (e.g. 41870.06).
- If the document contains two copies of the same slip (employee copy + CRA copy), read only ONE copy.

Return this JSON structure:
{
  "documentType": "T4" | "RL-1" | "RL-31",
  "fields": { "box14": 41870.06, "box22": 4442.54 }
}

Exact key names to use:

T4 → box14 (Employment income), box16 (CPP), box17 (QPP), box18 (EI premiums),
     box22 (Income tax deducted), box44 (Union dues), box46 (Charitable donations),
     box52 (Pension adjustment), box55 (PPIP premiums), box40 (Other taxable benefits),
     box85 (Employee-paid health premiums)

RL-1 → boxA (Employment income), boxBA (QPP / RRQ contributions),
       boxBB (Supplemental QPP), boxC (EI premiums),
       boxE (Quebec income tax withheld), boxG (Admissible salary QPP),
       boxH (QPIP / RQAP premiums), boxI (Admissible salary QPIP),
       boxJ (Private health insurance), box235

RL-31 → boxA (unit number, text), boxB (number of tenants, integer),
        boxC (full address, text), landlordName (text)`;

/**
 * Use the browser's FileReader to produce a reliable base64 string.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          docBlock,
          { type: 'text', text: USER_INSTRUCTION },
        ],
      },
    ],
  });

  const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
  console.log('[extractWithClaude] raw response:', rawText);

  // Strip any accidental markdown fences before parsing
  const cleaned = rawText.replace(/```(?:json)?/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in response. Raw: ${rawText.slice(0, 200)}`);
  }

  const data = JSON.parse(jsonMatch[0]);

  const docType = DOCUMENT_TYPE_MAP[data.documentType];
  if (!docType) {
    throw new Error(`Unrecognised document type: "${data.documentType}"`);
  }

  const fields = {};
  for (const [key, val] of Object.entries(data.fields ?? {})) {
    if (val !== null && val !== undefined && val !== '') {
      fields[key] = val;
    }
  }

  return { docType, fields };
}
