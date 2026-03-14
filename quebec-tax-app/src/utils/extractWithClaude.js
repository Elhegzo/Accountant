import Anthropic from '@anthropic-ai/sdk';
import * as pdfjsLib from 'pdfjs-dist';

// Use the CDN worker that matches the installed pdfjs-dist version.
// This avoids Vite bundling issues with the worker module.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// ---------------------------------------------------------------------------
// Prompt constants
// ---------------------------------------------------------------------------

const SYSTEM = `You are an expert at reading Canadian tax slips (T4, Relevé 1, RL-31).
When given a document, you identify its type and extract every filled-in box value.
You return ONLY a JSON object — no prose, no markdown fences.`;

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

const DOCUMENT_TYPE_MAP = {
  'T4':    'T4',
  'RL-1':  'RL1',
  'RL-31': 'RL31',
};

// ---------------------------------------------------------------------------
// PDF → images
// ---------------------------------------------------------------------------

/**
 * Renders every page of a PDF to a PNG image.
 *
 * Sending images (instead of a `document` block) gives Claude the same visual
 * representation that claude.ai uses, preserving the 2-D grid layout of tax
 * forms and preventing box-label / value mismatches caused by text extraction.
 *
 * @param {File} file
 * @returns {Promise<string[]>} Base64-encoded PNG strings, one per page
 */
async function pdfToImages(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // Scale 2× for crisp text at typical screen DPI
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    // Strip the "data:image/png;base64," prefix
    images.push(canvas.toDataURL('image/png').split(',')[1]);
  }

  return images;
}

// ---------------------------------------------------------------------------
// Image file → base64
// ---------------------------------------------------------------------------

/**
 * Converts an image File to a raw base64 string via FileReader.
 * @param {File} file
 * @returns {Promise<string>}
 */
function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Sends a tax-slip file to Claude and returns { docType, fields }.
 *
 * PDFs are rendered to images before sending so Claude sees the visual layout
 * (matching claude.ai behaviour) rather than a text-extracted stream.
 *
 * @param {File}   file    PDF or image uploaded by the user
 * @param {string} apiKey  Anthropic API key
 * @returns {Promise<{ docType: 'T4'|'RL1'|'RL31', fields: Object }>}
 * @throws {Error} on API failure, malformed JSON, or unrecognised document type
 */
export async function extractWithClaude(file, apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY_MISSING');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // Build image content blocks — one per PDF page, or one for image files
  let imageBlocks;
  if (file.type === 'application/pdf') {
    const pages = await pdfToImages(file);
    imageBlocks = pages.map((base64) => ({
      type:   'image',
      source: { type: 'base64', media_type: 'image/png', data: base64 },
    }));
  } else {
    const base64 = await imageToBase64(file);
    imageBlocks = [{
      type:   'image',
      source: { type: 'base64', media_type: file.type, data: base64 },
    }];
  }

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     SYSTEM,
    messages: [{
      role:    'user',
      content: [...imageBlocks, { type: 'text', text: USER_INSTRUCTION }],
    }],
  });

  const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
  console.log('[extractWithClaude] raw response:', rawText);

  // Strip any accidental markdown fences before parsing
  const cleaned   = rawText.replace(/```(?:json)?/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in response. Raw: ${rawText.slice(0, 200)}`);
  }

  const data = JSON.parse(jsonMatch[0]);

  const docType = DOCUMENT_TYPE_MAP[data.documentType];
  if (!docType) {
    throw new Error(`Unrecognised document type: "${data.documentType}"`);
  }

  // Filter out empty / null values
  const fields = {};
  for (const [key, val] of Object.entries(data.fields ?? {})) {
    if (val !== null && val !== undefined && val !== '') {
      fields[key] = val;
    }
  }

  return { docType, fields };
}
