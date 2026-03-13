/**
 * Spatial PDF text extraction using pdfjs-dist.
 *
 * Instead of dumping all text into a flat string (which loses layout context),
 * this module extracts each text item with its (x, y) coordinates, groups
 * items into visual rows, and sorts them left-to-right. This lets parsers
 * find a label and then reliably grab the value sitting to its right — the
 * same way a human reads a tax slip grid.
 */

const Y_TOLERANCE = 4; // px — items within this range share the same visual row

/**
 * Extract spatial text from a PDF file.
 * Returns { rows, flatText }
 *   rows     — Array of { y, items: [{str, x, width}] }, sorted top→bottom
 *   flatText — Reconstructed string for classification
 */
export async function extractPDFSpatial(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allRows = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items = content.items
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str.trim(),
        x: it.transform[4],
        // PDF y=0 is at the bottom; we negate so higher on page = larger value
        y: it.transform[5],
        width: it.width,
      }));

    allRows.push(...groupIntoRows(items));
  }

  // Reconstruct flat text preserving spatial (top→bottom, left→right) order
  const flatText = allRows
    .map((r) => r.items.map((it) => it.str).join(' '))
    .join('\n');

  return { rows: allRows, flatText };
}

/** Group text items into visual rows by proximity of their y coordinates. */
function groupIntoRows(items) {
  if (!items.length) return [];

  // Sort descending by y so we process the top of the page first
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows = [];

  for (const item of sorted) {
    const existing = rows.find((r) => Math.abs(r.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Sort items within each row left-to-right
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);

  return rows;
}

// ---------------------------------------------------------------------------
// Matching helpers used by all three parsers
// ---------------------------------------------------------------------------

/**
 * Parse a string as a dollar/numeric amount.
 * Returns the number, or null if the string is not a valid amount.
 * Rejects plain integers ≤ 99 that look like box numbers or years.
 */
export function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$\s,]/g, '');
  // Must look like a number (digits, optional decimal)
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  // Allow 0.00 but reject bare small integers that are likely box/form numbers
  // (exception: if there is a decimal point it is definitely a monetary value)
  if (!cleaned.includes('.') && num <= 99) return null;
  return num;
}

/**
 * Search spatial rows for a label matching any of labelPatterns, then return
 * the nearest numeric amount:
 *   1. To the right in the same row
 *   2. To the left in the same row (some PDFs put the value before the label)
 *   3. In the next 2 rows at a similar x position
 *
 * labelPatterns — array of RegExp tested against each item's str
 */
export function findAmountNearLabel(rows, labelPatterns) {
  for (let ri = 0; ri < rows.length; ri++) {
    const { items } = rows[ri];

    for (let ii = 0; ii < items.length; ii++) {
      if (!labelPatterns.some((p) => p.test(items[ii].str))) continue;

      // 1. Right in same row
      for (let j = ii + 1; j < items.length; j++) {
        const amt = parseAmount(items[j].str);
        if (amt !== null) return amt;
      }

      // 2. Left in same row — only accept values with a decimal (clear monetary)
      for (let j = 0; j < ii; j++) {
        const s = items[j].str.replace(/[$\s,]/g, '');
        if (/^\d+\.\d+$/.test(s)) {
          const amt = parseFloat(s);
          if (!isNaN(amt)) return amt;
        }
      }

      // 3. Next 2 rows at similar x position
      const labelX = items[ii].x;
      for (let nri = ri + 1; nri <= Math.min(ri + 2, rows.length - 1); nri++) {
        // Items at or to the right of the label
        const candidates = rows[nri].items.filter((it) => it.x >= labelX - 60);
        for (const c of candidates) {
          const amt = parseAmount(c.str);
          if (amt !== null) return amt;
        }
      }
    }
  }
  return null;
}

/**
 * Like findAmountNearLabel but returns raw text instead of a number.
 * Used for RL-31 fields (address, unit number, landlord name).
 */
export function findTextNearLabel(rows, labelPatterns) {
  for (let ri = 0; ri < rows.length; ri++) {
    const { items } = rows[ri];

    for (let ii = 0; ii < items.length; ii++) {
      if (!labelPatterns.some((p) => p.test(items[ii].str))) continue;

      // Right in same row
      const right = items
        .slice(ii + 1)
        .map((it) => it.str)
        .join(' ')
        .trim();
      if (right) return right;

      // Next row
      if (ri + 1 < rows.length) {
        const below = rows[ri + 1].items.map((it) => it.str).join(' ').trim();
        if (below) return below;
      }
    }
  }
  return null;
}
