import { extractWithClaude } from './extractWithClaude';

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

/**
 * Classify an extraction error into a user-facing message.
 * Kept here so DocumentUpload.jsx stays free of error-handling logic.
 *
 * @param {Error} err
 * @returns {string}
 */
function describeError(err) {
  if (err.message === 'ANTHROPIC_API_KEY_MISSING') {
    return 'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in your .env file and restart the dev server.';
  }
  if (err.name === 'AbortError' || err.message?.includes('timed out')) {
    return 'Extraction timed out after 30 s. Please try again or enter values manually.';
  }
  const isAuthError =
    err.status === 401 ||
    err.status === 403 ||
    (err.message || '').toLowerCase().includes('auth');
  if (isAuthError) {
    return 'API key rejected (401/403). Double-check the key in your .env file and restart the dev server.';
  }
  return `Extraction failed: ${err.message || 'unknown error'}. Please enter your values manually.`;
}

/**
 * Process a single tax-slip file end-to-end.
 *
 * Validates the file type, delegates extraction to Claude, and normalises the
 * result into the document state shape used by DocumentUpload.
 *
 * @param {File}   file
 * @param {string} apiKey  Anthropic API key
 * @returns {Promise<{
 *   name: string,
 *   type: string,
 *   docType: 'T4'|'RL1'|'RL31'|'UNKNOWN',
 *   fields: Object,
 *   extractionError: string|null
 * }>}
 */
export async function processDocument(file, apiKey) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { error: 'Unsupported file type. Please upload a PDF, JPEG, or PNG.' };
  }

  try {
    const { docType, fields } = await extractWithClaude(file, apiKey);
    return {
      name: file.name,
      type: file.type,
      docType,
      fields,
      extractionError: null,
    };
  } catch (err) {
    console.error('[processDocument] extraction error:', err);
    return {
      name: file.name,
      type: file.type,
      docType: 'UNKNOWN',
      fields: {},
      extractionError: describeError(err),
    };
  }
}
