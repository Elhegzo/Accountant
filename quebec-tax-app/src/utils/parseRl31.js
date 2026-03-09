/**
 * Extract Relevé 31 box values from extracted text.
 */
export function parseRl31(text) {
  if (!text) return {};

  const result = {};
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  // Box A — unit/logement number
  const boxAMatch = normalized.match(/(?:case a|box a|logement)[:\s]+([^\n,]+)/i);
  if (boxAMatch) result.boxA = boxAMatch[1].trim();

  // Box B — number of tenants
  const boxBMatch = normalized.match(/(?:case b|box b|nombre de locataires?|number of tenants?)[:\s]+(\d+)/i);
  if (boxBMatch) result.boxB = parseInt(boxBMatch[1], 10);

  // Box C — address parts
  const addressMatch = normalized.match(/(?:case c|box c|adresse|address)[:\s]+([^\n]+)/i);
  if (addressMatch) {
    result.boxC = addressMatch[1].trim();
    // Try to parse city
    const cityMatch = result.boxC.match(/([A-Za-z\s]+),?\s*([A-Z]{2})\s*([\w\d]{6})/);
    if (cityMatch) {
      result.boxC_city = cityMatch[1].trim();
      result.boxC_province = cityMatch[2];
      result.boxC_postal = cityMatch[3];
    }
  }

  // Landlord name
  const landlordMatch = normalized.match(/(?:propriétaire|landlord|locateur)[:\s]+([^\n]+)/i);
  if (landlordMatch) result.landlordName = landlordMatch[1].trim();

  return result;
}

export const RL31_FIELD_LABELS = {
  boxA: { label: 'Unit / Logement Number', box: 'A', description: 'Your apartment or unit identifier' },
  boxB: { label: 'Number of Tenants', box: 'B', description: 'Number of tenants listed on this Relevé 31' },
  boxC: { label: 'Address of Dwelling', box: 'C', description: 'Full address of the rental property' },
  landlordName: { label: 'Landlord Name', box: '—', description: 'Name of your landlord or property management company' },
};
