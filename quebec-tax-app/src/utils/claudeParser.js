/**
 * Parse Canadian tax documents (T4, Relevé 1, Relevé 31) using the Claude API.
 * Claude understands scanned PDFs and images as visual documents — the same way
 * it works in Claude chat — giving near-perfect extraction accuracy.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const PARSE_PROMPT = `You are a Canadian tax document parser. Examine this document carefully and extract all tax values.

First identify the document type:
- T4: "Statement of Remuneration Paid" — federal employment slip from CRA
- RL1: "Relevé 1" — Quebec provincial employment slip from Revenu Québec
- RL31: "Relevé 31" — Quebec housing/rental slip

Then extract ALL visible dollar amounts for each box/case, exactly as printed.

Return ONLY a JSON object in one of these formats (no explanations, no markdown, just raw JSON):

For T4:
{
  "docType": "T4",
  "fields": {
    "box14": <number or null>,
    "box16": <number or null>,
    "box17": <number or null>,
    "box18": <number or null>,
    "box22": <number or null>,
    "box44": <number or null>,
    "box46": <number or null>,
    "box52": <number or null>,
    "box55": <number or null>,
    "box40": <number or null>,
    "box85": <number or null>
  }
}

For Relevé 1 (RL1):
{
  "docType": "RL1",
  "fields": {
    "boxA": <number or null>,
    "boxBA": <number or null>,
    "boxBB": <number or null>,
    "boxC": <number or null>,
    "boxE": <number or null>,
    "boxG": <number or null>,
    "boxH": <number or null>,
    "boxI": <number or null>,
    "boxJ": <number or null>,
    "box235": <number or null>
  }
}

For Relevé 31 (RL31):
{
  "docType": "RL31",
  "fields": {
    "boxA": <string or null>,
    "boxB": <number or null>,
    "boxC": <string or null>,
    "landlord": <string or null>
  }
}

Rules:
- Use null for any box/case that is blank or not present on the document
- Numbers must be plain numbers without currency symbols or commas (e.g. 41870.06 not $41,870.06)
- If a box shows "0.00" use 0, not null
- Return ONLY valid JSON`;

/**
 * Convert a File to a base64 string.
 */
async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Parse a tax document file using the Claude API.
 * @param {File} file - PDF or image file
 * @param {string} apiKey - Anthropic API key
 * @returns {{ docType: string, fields: object, confidence: string }}
 */
export async function parseDocumentWithClaude(file, apiKey) {
  const base64 = await fileToBase64(file);
  const isPDF = file.type === 'application/pdf';

  const contentBlock = isPDF
    ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.type,
          data: base64,
        },
      };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: PARSE_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Claude API error ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';

  // Pull out the JSON object from the response
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON. Raw response: ' + rawText.slice(0, 200));
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Strip null/undefined values so the UI shows "Enter value" for missing fields
  const cleanedFields = {};
  for (const [key, value] of Object.entries(parsed.fields || {})) {
    if (value !== null && value !== undefined) {
      cleanedFields[key] = typeof value === 'string' ? value : Number(value);
    }
  }

  return {
    docType: parsed.docType || 'UNKNOWN',
    fields: cleanedFields,
    confidence: 'high',
  };
}
