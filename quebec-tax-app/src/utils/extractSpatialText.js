/**
 * Spatial PDF text extraction using pdfjs-dist.
 *
 * Two sources of content are merged into a single set of visual rows:
 *
 *   1. Static text items  — page.getTextContent()
 *      Labels, headings, form instructions. These are what the previous
 *      flat-string approach used exclusively, which is why values were missing:
 *      CRA / Revenu Québec PDFs store the actual filled-in amounts inside
 *      AcroForm widget annotations, not as plain text items.
 *
 *   2. AcroForm field values — page.getAnnotations()
 *      Every Widget annotation that has a non-empty fieldValue is treated as
 *      a text item positioned at the centre of the annotation's bounding rect.
 *      These items are flagged with isFormField: true so matching helpers can
 *      prioritise them over static text.
 *
 * Both sets are grouped into visual rows sorted top→bottom / left→right, giving
 * parsers a layout-aware view where "value is to the right of its label" holds.
 */

const Y_TOLERANCE = 6; // px — items within this y-range share the same visual row

/**
 * Extract spatial content from a PDF file.
 * Returns { rows, flatText }
 *   rows     — Array of { y, items: [{str, x, width, isFormField}] }
 *   flatText — Reconstructed string for document classification
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

    // ── 1. Static text (labels, instructions, headings) ──────────────────────
    const content = await page.getTextContent();
    const textItems = content.items
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str.trim(),
        x: it.transform[4],
        y: it.transform[5], // baseline y; PDF y=0 is at bottom
        width: it.width,
        isFormField: false,
      }));

    // ── 2. AcroForm field values (the actual data users care about) ───────────
    const annotations = await page.getAnnotations();
    const formItems = annotations
      .filter(
        (a) =>
          a.subtype === 'Widget' &&
          a.fieldValue !== undefined &&
          a.fieldValue !== null &&
          String(a.fieldValue).trim().length > 0
      )
      .map((a) => ({
        str: String(a.fieldValue).trim(),
        x: a.rect[0],
        // Use vertical centre of the annotation rectangle so it aligns with
        // nearby text baselines when Y_TOLERANCE grouping is applied
        y: (a.rect[1] + a.rect[3]) / 2,
        width: a.rect[2] - a.rect[0],
        isFormField: true,
        fieldName: a.fieldName || '',
      }));

    allRows.push(...groupIntoRows([...textItems, ...formItems]));
  }

  // Reconstruct flat text: form field values are included so the classifier
  // can see document-type signals even when they only appear in form fields
  const flatText = allRows
    .map((r) => r.items.map((it) => it.str).join(' '))
    .join('\n');

  return { rows: allRows, flatText };
}

/** Group text items into visual rows by proximity of y coordinates. */
function groupIntoRows(items) {
  if (!items.length) return [];

  // Descending y → top of page first (PDF y=0 is at the bottom)
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
 * Parse a string as a monetary/numeric amount.
 * strict=true  — rejects bare integers ≤ 99 (likely box numbers)
 * strict=false — accepts any non-negative number (used for form field values
 *                which are always intentional, e.g. $4 EI premiums)
 */
function parseAmountInternal(str, strict) {
  if (!str) return null;
  const cleaned = str.replace(/[$\s,]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  if (strict && !cleaned.includes('.') && num <= 99) return null;
  return num;
}

export function parseAmount(str) {
  return parseAmountInternal(str, true);
}

/**
 * Search spatial rows for a label matching any of labelPatterns, then return
 * the nearest numeric amount.
 *
 * Search order:
 *   1. Form field items (isFormField=true) to the right in the same row — lenient parsing
 *   2. Regular text amounts to the right in the same row — strict parsing
 *   3. Left side of same row (decimal-only, to avoid picking up box numbers)
 *   4. Next 2 rows at a similar x position — form fields first, then text
 */
export function findAmountNearLabel(rows, labelPatterns) {
  for (let ri = 0; ri < rows.length; ri++) {
    const { items } = rows[ri];

    for (let ii = 0; ii < items.length; ii++) {
      if (!labelPatterns.some((p) => p.test(items[ii].str))) continue;

      const rightItems = items.slice(ii + 1);

      // 1. Form field to the right (highest priority — lenient amount parsing)
      for (const it of rightItems) {
        if (it.isFormField) {
          const amt = parseAmountInternal(it.str, false);
          if (amt !== null) return amt;
        }
      }

      // 2. Regular text amount to the right
      for (const it of rightItems) {
        if (!it.isFormField) {
          const amt = parseAmountInternal(it.str, true);
          if (amt !== null) return amt;
        }
      }

      // 3. Left side — only accept values with a decimal (unambiguously monetary)
      for (let j = 0; j < ii; j++) {
        const s = items[j].str.replace(/[$\s,]/g, '');
        if (/^\d+\.\d+$/.test(s)) {
          const amt = parseFloat(s);
          if (!isNaN(amt)) return amt;
        }
      }

      // 4. Next 2 rows at similar x position — form fields first
      const labelX = items[ii].x;
      for (let nri = ri + 1; nri <= Math.min(ri + 2, rows.length - 1); nri++) {
        const candidates = rows[nri].items.filter((it) => it.x >= labelX - 60);

        for (const c of candidates) {
          if (c.isFormField) {
            const amt = parseAmountInternal(c.str, false);
            if (amt !== null) return amt;
          }
        }
        for (const c of candidates) {
          if (!c.isFormField) {
            const amt = parseAmountInternal(c.str, true);
            if (amt !== null) return amt;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Like findAmountNearLabel but returns raw text (for RL-31 address/name fields).
 *
 * Priority:
 *   1. Form field items to the right in the same row
 *   2. Short regular-text items (≤ 80 chars) that don't look like instructions
 *   3. Next row — form fields first, then short text
 */
export function findTextNearLabel(rows, labelPatterns) {
  for (let ri = 0; ri < rows.length; ri++) {
    const { items } = rows[ri];

    for (let ii = 0; ii < items.length; ii++) {
      if (!labelPatterns.some((p) => p.test(items[ii].str))) continue;

      const rightItems = items.slice(ii + 1);

      // 1. Form field value (most reliable)
      const formField = rightItems.find((it) => it.isFormField && it.str.length > 0);
      if (formField) return formField.str;

      // 2. Short non-instruction text to the right
      const shortText = rightItems.find(
        (it) => !it.isFormField && !looksLikeInstruction(it.str)
      );
      if (shortText) return shortText.str;

      // 3. Next row
      if (ri + 1 < rows.length) {
        const nextItems = rows[ri + 1].items;
        const nextForm = nextItems.find((it) => it.isFormField && it.str.length > 0);
        if (nextForm) return nextForm.str;

        const nextShort = nextItems.find(
          (it) => !it.isFormField && !looksLikeInstruction(it.str)
        );
        if (nextShort) return nextShort.str;
      }
    }
  }
  return null;
}

/**
 * Heuristic: return true if the string looks like a form instruction sentence
 * rather than a data value (address, name, unit number, etc.).
 */
function looksLikeInstruction(str) {
  if (!str) return true;
  if (str.length > 60) return true;
  const lower = str.toLowerCase().trim();
  // Common French/English instruction openers
  return /^(vous|si |le |la |les |l'|pour |dans |que |qui |ce |cet|une |un |à |au |aux |de |du |the |if |this |your |enter |please )/.test(lower);
}
