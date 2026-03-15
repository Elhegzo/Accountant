import Anthropic from '@anthropic-ai/sdk';
import * as pdfjsLib from 'pdfjs-dist';

// Use the CDN worker that matches the installed pdfjs-dist version.
// This avoids Vite bundling issues with the worker module.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Abort the API call if it hasn't returned within this window.
const EXTRACTION_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Prompt constants
// ---------------------------------------------------------------------------

const SYSTEM = `You are a Canadian tax document reader.
Return only valid JSON — no explanations, no markdown, no extra text.`;

const USER_INSTRUCTION = `Look at this document and do the following:

1. Identify what type of document this is (T4, RL-1, or RL-31) based on what you see.

2. Find every field or box that has a value filled in. Ignore anything that is empty or blank.
   If the page shows two identical copies of the same form (e.g. employee copy on top,
   CRA copy below), read ONLY the top copy.

3. Return the results as JSON in exactly this format — no other text:

{
  "documentType": "T4",
  "fields": [
    { "box": "14", "description": "Employment Income", "value": "41870.06" },
    { "box": "22", "description": "Federal Income Tax Deducted", "value": "4442.54" }
  ]
}

Rules:
- documentType must be exactly one of: "T4", "RL-1", or "RL-31".
- box is the box number or letter exactly as printed on the form (e.g. "14", "A", "B.A").
- description is the label printed next to that box on the form.
- value is always a string containing only the numeric amount (e.g. "41870.06", not "$41,870.06").`;

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
 * Sending images (instead of a raw `document` block) gives Claude the same
 * visual representation that claude.ai uses, preserving the 2-D grid layout
 * of tax forms and preventing value/box-label mismatches.
 *
 * @param {File} file
 * @returns {Promise<string[]>} Base64-encoded PNG strings, one per page
 */
async function renderPage(pdf, pageNum) {
  const page     = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); // 2× for crisp text

  const canvas  = document.createElement('canvas');
  canvas.width  = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  const base64 = canvas.toDataURL('image/png').split(',')[1];

  // Release backing store immediately — large canvases hold significant memory.
  canvas.width = canvas.height = 0;

  return base64;
}

async function pdfToImages(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Render all pages concurrently instead of sequentially.
  return Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) => renderPage(pdf, i + 1))
  );
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
// Response parsing — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Parse the raw text returned by Claude into { docType, fields }.
 *
 * fields is an array of { box, description, value } objects exactly as
 * Claude returned them — documentProcessor.js handles the conversion to the
 * keyed object format used by the tax calculator.
 *
 * Exported so tests can exercise this logic without real API calls.
 *
 * @param   {string} rawText
 * @returns {{ docType: 'T4'|'RL1'|'RL31', fields: Array<{box,description,value}> }}
 * @throws  {Error} on malformed JSON or unrecognised document type
 */
export function parseClaudeResponse(rawText) {
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

  // Keep only rows that have both a box identifier and a non-empty value
  const fields = (data.fields ?? []).filter(
    (row) => row.box && row.value !== null && row.value !== undefined && String(row.value).trim() !== ''
  );

  return { docType, fields };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Sends a tax-slip file to Claude and returns { docType, fields }.
 *
 * PDFs are rendered to images before sending so Claude sees the visual layout
 * (matching claude.ai behaviour). The call is aborted after EXTRACTION_TIMEOUT_MS.
 *
 * @param {File}   file    PDF or image uploaded by the user
 * @param {string} apiKey  Anthropic API key
 * @returns {Promise<{ docType: 'T4'|'RL1'|'RL31', fields: Array }>}
 * @throws {Error} on API failure, timeout, malformed JSON, or unrecognised type
 */
export async function extractWithClaude(file, apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY_MISSING');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // Build image blocks — one per PDF page, or one for image files.
  // Normalise image/jpg → image/jpeg for API compatibility.
  let imageBlocks;
  if (file.type === 'application/pdf') {
    const pages = await pdfToImages(file);
    imageBlocks = pages.map((base64) => ({
      type:   'image',
      source: { type: 'base64', media_type: 'image/png', data: base64 },
    }));
  } else {
    const base64    = await imageToBase64(file);
    const mediaType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    imageBlocks = [{
      type:   'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    }];
  }

  const response = await client.messages.create(
    {
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM,
      messages: [{
        role:    'user',
        content: [...imageBlocks, { type: 'text', text: USER_INSTRUCTION }],
      }],
    },
    { signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS) },
  );

  const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
  if (import.meta.env.DEV) console.log('[extractWithClaude] raw response:', rawText);

  return parseClaudeResponse(rawText);
}
