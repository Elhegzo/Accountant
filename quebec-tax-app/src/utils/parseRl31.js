/**
 * Parse Relevé 31 fields from spatially-extracted PDF rows.
 *
 * RL-31 contains mixed field types:
 *   Box A  — unit/logement number   (alphanumeric text)
 *   Box B  — number of tenants      (integer)
 *   Box C  — address of dwelling    (text)
 *   —      — landlord / locateur    (text)
 *
 * Text fields use findTextNearLabel; Box B uses findAmountNearLabel since
 * it is a small integer (tenant count).
 */
import { findAmountNearLabel, findTextNearLabel } from './extractSpatialText';

/**
 * @param {Array} rows — spatial rows from extractPDFSpatial()
 * @returns {Object} extracted field values
 */
export function parseRl31(rows) {
  if (!rows || !rows.length) return {};

  const result = {};

  // Box A — unit / logement identifier (text, e.g. "301", "APT 2", "A")
  const boxA = findTextNearLabel(rows, [
    /num[eé]ro\s+de\s+logement/i,
    /unit\s+(number|no\.?)/i,
    /^case\s+a$/i,
    /^box\s+a$/i,
    /^A\s*[-–]\s*logement/i,
  ]);
  if (boxA) result.boxA = boxA;

  // Box B — number of tenants (numeric)
  // findAmountNearLabel rejects integers ≤ 99, so we use a custom inline search
  // (tenant count is typically 1–4, so we need a dedicated scan)
  const boxBValue = findTenantCount(rows);
  if (boxBValue !== null) result.boxB = boxBValue;

  // Box C — full address
  const boxC = findTextNearLabel(rows, [
    /adresse\s+du\s+logement/i,
    /address\s+of\s+dwelling/i,
    /^case\s+c$/i,
    /^box\s+c$/i,
  ]);
  if (boxC) result.boxC = boxC;

  // Landlord name
  const landlord = findTextNearLabel(rows, [
    /propri[eé]taire/i,
    /locateur/i,
    /landlord/i,
    /nom\s+du\s+propri[eé]taire/i,
  ]);
  if (landlord) result.landlordName = landlord;

  return result;
}

/**
 * Scan rows for a tenant-count label and return the adjacent small integer.
 * We can't use parseAmount for this because tenant counts (1–10) are below
 * the threshold that parseAmount uses to filter out box numbers.
 */
function findTenantCount(rows) {
  const labelPatterns = [
    /nombre\s+de\s+locataires?/i,
    /number\s+of\s+tenants?/i,
    /^case\s+b$/i,
    /^box\s+b$/i,
  ];

  for (let ri = 0; ri < rows.length; ri++) {
    const { items } = rows[ri];
    for (let ii = 0; ii < items.length; ii++) {
      if (!labelPatterns.some((p) => p.test(items[ii].str))) continue;

      // Look right in same row
      for (let j = ii + 1; j < items.length; j++) {
        const n = parseInt(items[j].str, 10);
        if (!isNaN(n) && n >= 1 && n <= 20) return n;
      }

      // Look in next row
      if (ri + 1 < rows.length) {
        for (const it of rows[ri + 1].items) {
          const n = parseInt(it.str, 10);
          if (!isNaN(n) && n >= 1 && n <= 20) return n;
        }
      }
    }
  }
  return null;
}

export const RL31_FIELD_LABELS = {
  boxA:        { label: 'Unit / Logement Number', box: 'A', description: 'Your apartment or unit identifier', isNumeric: false },
  boxB:        { label: 'Number of Tenants', box: 'B', description: 'Number of tenants listed on this Relevé 31', isNumeric: true },
  boxC:        { label: 'Address of Dwelling', box: 'C', description: 'Full address of the rental property', isNumeric: false },
  landlordName:{ label: 'Landlord Name', box: '—', description: 'Name of your landlord or property management company', isNumeric: false },
};
