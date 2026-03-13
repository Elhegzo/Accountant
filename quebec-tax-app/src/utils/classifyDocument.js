/**
 * Classify a document based on its extracted text content.
 * Returns 'T4', 'RL1', 'RL31', or 'UNKNOWN'.
 *
 * Works with both clean digital text and OCR output (which may drop
 * accented characters like é → e, or produce minor spelling errors).
 */
export function classifyDocument(text) {
  if (!text) return 'UNKNOWN';

  // Strip accents so OCR output like "Releve" matches "Relevé"
  const normalized = text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove combining diacritics

  // RL-31 — most specific, check first
  if (
    /RELEV[EE]\s*31/.test(normalized) ||
    normalized.includes('RL-31') ||
    normalized.includes('RL 31') ||
    normalized.includes('RENSEIGNEMENTS SUR L') ||
    normalized.includes('LOCATAIRE') ||
    (normalized.includes('LOGEMENT') && normalized.includes('REVENU QUEBEC'))
  ) {
    return 'RL31';
  }

  // RL-1
  if (
    /RELEV[EE]\s*1\b/.test(normalized) ||
    normalized.includes('RL-1') ||
    normalized.includes('REVENUS D EMPLOI') ||
    normalized.includes("REVENUS D'EMPLOI") ||
    (normalized.includes('CASE A') && normalized.includes('REVENU')) ||
    (normalized.includes('CASE A') && normalized.includes('QUEBEC')) ||
    (normalized.includes('REVENU QUEBEC') && normalized.includes('CASE')) ||
    // Characteristic RL-1 box labels that don't appear on T4
    (normalized.includes('CASE E') && normalized.includes('CASE A')) ||
    (normalized.includes('CASE G') && normalized.includes('CASE A'))
  ) {
    return 'RL1';
  }

  // T4
  if (
    /\bT4\b/.test(normalized) ||
    normalized.includes('STATEMENT OF REMUNERATION PAID') ||
    normalized.includes('REMUNERATION PAID') ||
    normalized.includes('EMPLOYMENT INCOME') ||
    normalized.includes('BOX 14') ||
    (normalized.includes('CANADA REVENUE') && normalized.includes('EMPLOYMENT')) ||
    (normalized.includes('CPP') && normalized.includes('BOX')) ||
    (normalized.includes('EI PREMIUMS') && normalized.includes('BOX'))
  ) {
    return 'T4';
  }

  return 'UNKNOWN';
}

export const DOCUMENT_LABELS = {
  T4: 'T4 — Statement of Remuneration Paid',
  RL1: 'Relevé 1 — Employment Income',
  RL31: 'Relevé 31 — Rental Dwelling Info',
  UNKNOWN: 'Unknown Document',
};
