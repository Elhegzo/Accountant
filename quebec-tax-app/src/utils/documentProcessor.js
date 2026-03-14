import { extractWithClaude } from './extractWithClaude';
import { T4_FIELD_LABELS } from './parseT4';
import { RL1_FIELD_LABELS } from './parseRl1';
import { RL31_FIELD_LABELS } from './parseRl31';

/**
 * Lookup table: internal document type → field definitions.
 * Exported so DocumentUpload can populate empty rows on manual-entry fallback.
 */
export const FIELD_DEFS = {
  T4:   T4_FIELD_LABELS,
  RL1:  RL1_FIELD_LABELS,
  RL31: RL31_FIELD_LABELS,
};

/**
 * Convert a box identifier (as printed on the form) to the field key used
 * throughout the app and tax calculator (e.g. "14" → "box14", "B.A" → "boxBA").
 *
 * @param {string} box
 * @returns {string}
 */
export function toFieldKey(box) {
  if (box === 'landlordName') return 'landlordName';
  return 'box' + box.replace(/\./g, '');
}

/**
 * Convert Claude's raw array of { box, description, value } rows into the
 * document state shape the rest of the app uses:
 *
 *   displayRows — array used by the UI table (Box | Description | Amount)
 *   fields      — keyed object used by the tax calculator { box14: 41870 }
 *
 * Where we have a known field definition for a box, we use our own label and
 * tooltip so the text stays consistent regardless of how Claude phrased it.
 */
function buildDocumentState(file, docType, rawFields) {
  const defs = FIELD_DEFS[docType] || {};

  const displayRows = rawFields.map((row) => {
    const key    = toFieldKey(row.box);
    const def    = defs[key];

    // Use our definition's label when available so copy is always consistent.
    const description = def?.label ?? row.description;
    const isNumeric   = def ? def.isNumeric !== false : !isNaN(parseFloat(row.value));
    const parsed      = isNumeric ? parseFloat(row.value) : row.value;
    const value       = isNumeric && !isNaN(parsed) ? parsed : row.value;

    return {
      key,
      box:         row.box,
      description,
      value,
      tooltip:   def?.description ?? null,
      isNumeric,
    };
  });

  // Build the keyed fields object for the tax calculator.
  const fields = {};
  for (const row of displayRows) {
    if (row.value !== null && row.value !== undefined && row.value !== '') {
      fields[row.key] = row.value;
    }
  }

  return {
    name:           file.name,
    type:           file.type,
    docType,
    fields,       // { box14: 41870, … }   — consumed by taxCalculator
    displayRows,  // [{ key, box, description, value, tooltip, isNumeric }]
    extractionError: null,
  };
}

/**
 * Map an API/SDK error to a plain user-facing message.
 * @param {Error} err
 * @returns {string}
 */
function describeError(err) {
  if (err.message === 'ANTHROPIC_API_KEY_MISSING') {
    return 'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in your .env file and restart the dev server.';
  }
  if (err.name === 'AbortError' || (err.message ?? '').includes('timed out')) {
    return 'Extraction timed out after 30 s. Please try again or enter your values manually.';
  }
  const isAuthError =
    err.status === 401 ||
    err.status === 403 ||
    (err.message ?? '').toLowerCase().includes('auth');
  if (isAuthError) {
    return 'API key rejected (401/403). Double-check the key in your .env file and restart the dev server.';
  }
  return "We couldn't read this file. Please enter your values manually.";
}

/**
 * Process a single tax-slip file end-to-end.
 *
 * Validates the file type, delegates extraction to Claude, and shapes the
 * result into the document state consumed by DocumentUpload.
 *
 * @param {File}   file
 * @param {string} apiKey  Anthropic API key
 * @returns {Promise<Object>} Document state object
 */
export async function processDocument(file, apiKey) {
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    return { error: 'Unsupported file type. Please upload a PDF or image file.' };
  }

  try {
    const { docType, fields } = await extractWithClaude(file, apiKey);
    return buildDocumentState(file, docType, fields);
  } catch (err) {
    console.error('[processDocument] extraction error:', err);
    return {
      name:            file.name,
      type:            file.type,
      docType:         'UNKNOWN',
      fields:          {},
      displayRows:     [],
      extractionError: describeError(err),
    };
  }
}
