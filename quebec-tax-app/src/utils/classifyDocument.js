/**
 * Classify a document based on its extracted text content.
 * Returns 'T4', 'RL1', 'RL31', or 'UNKNOWN'
 */
export function classifyDocument(text) {
  if (!text) return 'UNKNOWN';

  const normalized = text.toUpperCase();

  // RL-31 check — most specific, check first
  if (
    normalized.includes('RELEVÉ 31') ||
    normalized.includes('RELEVE 31') ||
    normalized.includes('RL-31') ||
    normalized.includes('RL 31') ||
    normalized.includes('RENSEIGNEMENTS SUR L') ||
    normalized.includes('LOCATAIRE') ||
    (normalized.includes('LOGEMENT') && normalized.includes('REVENU QUÉBEC'))
  ) {
    return 'RL31';
  }

  // RL-1 check
  if (
    normalized.includes('RELEVÉ 1') ||
    normalized.includes('RELEVE 1') ||
    normalized.includes('RL-1') ||
    normalized.includes('REVENUS D\'EMPLOI') ||
    normalized.includes("REVENUS D'EMPLOI") ||
    (normalized.includes('CASE A') && normalized.includes('REVENU')) ||
    (normalized.includes('CASE A') && normalized.includes('QUÉBEC')) ||
    normalized.includes('REVENU QUÉBEC') && normalized.includes('CASE')
  ) {
    return 'RL1';
  }

  // T4 check
  if (
    normalized.includes('T4') ||
    normalized.includes('STATEMENT OF REMUNERATION PAID') ||
    normalized.includes('EMPLOYMENT INCOME') ||
    normalized.includes('BOX 14') ||
    (normalized.includes('CANADA REVENUE') && normalized.includes('EMPLOYMENT'))
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
