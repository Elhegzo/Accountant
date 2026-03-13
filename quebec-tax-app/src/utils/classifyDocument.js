/**
 * Classify a tax document purely from its text content.
 *
 * Uses a weighted scoring system: each matched keyword adds points to a
 * document-type bucket. The type with the highest score wins, provided it
 * clears a minimum confidence threshold. Filename is never consulted —
 * classification is content-only so it works for any user-uploaded file.
 */
export function classifyDocument(text) {
  if (!text || !text.trim()) return 'UNKNOWN';

  const u = text.toUpperCase();

  const scores = { T4: 0, RL1: 0, RL31: 0 };

  // ── RL-31 signals ──────────────────────────────────────────────────────────
  // Very strong: explicit form identifier
  if (/RELEV[EÉ]\s*31/.test(u) || u.includes('RL-31') || u.includes('RL 31')) scores.RL31 += 10;
  // Strong: rental-dwelling header
  if (u.includes('RENSEIGNEMENTS SUR LE LOGEMENT') || u.includes('RENSEIGNEMENTS SUR L')) scores.RL31 += 8;
  // Medium: rental-specific vocabulary (not present on T4 or RL-1)
  if (u.includes('LOGEMENT')) scores.RL31 += 4;
  if (u.includes('LOCATAIRE')) scores.RL31 += 4;
  if (u.includes('LOYER') || u.includes('PROPRIÉTAIRE') || u.includes('PROPRIETAIRE')) scores.RL31 += 3;

  // ── RL-1 signals ───────────────────────────────────────────────────────────
  // Very strong: explicit form identifier
  if (/RELEV[EÉ]\s*1\b/.test(u) || u.includes('RL-1 ') || u.includes('RL-1\n') || u.includes('FEUILLET RL')) scores.RL1 += 10;
  // Strong: Quebec employment income label (appears on RL-1, not T4)
  if (u.includes("REVENUS D'EMPLOI") || u.includes('REVENUS D\u2019EMPLOI') || u.includes("REVENUS D`EMPLOI")) scores.RL1 += 6;
  // Strong: Quebec-specific box labels
  if (u.includes('COTISATIONS AU RRQ')) scores.RL1 += 5;
  if (u.includes('RQAP') || u.includes('QPIP')) scores.RL1 += 4;
  if (u.includes('IMPÔT DU QUÉBEC') || u.includes('IMPOT DU QUEBEC')) scores.RL1 += 5;
  // Medium: Revenu Québec issuer + box reference
  if ((u.includes('REVENU QUÉBEC') || u.includes('REVENU QUEBEC')) && u.includes('CASE')) scores.RL1 += 4;
  // Medium: combination of two RL-1 boxes
  if (u.includes('CASE A') && u.includes('CASE E')) scores.RL1 += 4;
  if (u.includes('CASE B') || u.includes('CASE G') || u.includes('CASE H') || u.includes('CASE I')) scores.RL1 += 2;

  // ── T4 signals ─────────────────────────────────────────────────────────────
  // Very strong: explicit form identifier
  if (/\bT4\s+(SLIP|FEUILLET)\b/.test(u) || u.includes('FEUILLETON T4')) scores.T4 += 10;
  if (u.includes('T4 ') && (u.includes('2024') || u.includes('2025') || u.includes('2023'))) scores.T4 += 3;
  // Strong: CRA form title
  if (u.includes('STATEMENT OF REMUNERATION PAID')) scores.T4 += 9;
  if (u.includes('ÉTAT DE LA RÉMUNÉRATION PAYÉE') || u.includes('ETAT DE LA REMUNERATION')) scores.T4 += 9;
  // Strong: CRA issuer
  if (u.includes('CANADA REVENUE AGENCY') || u.includes('AGENCE DU REVENU DU CANADA')) scores.T4 += 6;
  // Medium: federal-specific deductions (CPP not RRQ)
  if (u.includes('CPP CONTRIBUTIONS') || u.includes('COTISATIONS AU RPC')) scores.T4 += 4;
  if (u.includes('EMPLOYMENT INSURANCE') || u.includes("COTISATIONS À L'AE") || u.includes("COTISATIONS A L'AE")) scores.T4 += 3;
  if (u.includes('INCOME TAX DEDUCTED') || u.includes('IMPÔT SUR LE REVENU RETENU')) scores.T4 += 3;
  // Light: generic employment keyword (shared with RL-1, so low weight)
  if (u.includes('EMPLOYMENT INCOME')) scores.T4 += 2;

  // ── Decision ───────────────────────────────────────────────────────────────
  const max = Math.max(scores.T4, scores.RL1, scores.RL31);
  if (max < 4) return 'UNKNOWN'; // Not confident enough

  if (scores.RL31 === max) return 'RL31';
  if (scores.RL1 === max) return 'RL1';
  return 'T4';
}

export const DOCUMENT_LABELS = {
  T4: 'T4 — Statement of Remuneration Paid',
  RL1: 'Relevé 1 — Employment Income',
  RL31: 'Relevé 31 — Rental Dwelling Info',
  UNKNOWN: 'Unknown Document',
};
