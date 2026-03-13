import { useState, useCallback, useRef } from 'react';
import { classifyDocument, DOCUMENT_LABELS } from '../utils/classifyDocument';
import { parseT4, T4_FIELD_LABELS } from '../utils/parseT4';
import { parseRl1, RL1_FIELD_LABELS } from '../utils/parseRl1';
import { parseRl31, RL31_FIELD_LABELS } from '../utils/parseRl31';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

function Tooltip({ text }) {
  return (
    <span className="tooltip-container ml-1 text-slate-500 cursor-help">
      ⓘ
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

/**
 * Returns true if the text looks like real tax form data
 * (has dollar amounts and relevant keywords).
 */
function looksLikeTaxData(text) {
  if (!text || text.trim().length < 30) return false;
  const hasDollarAmounts = /\d{3,}[.,]\d{2}/.test(text);
  const hasKeywords =
    /(employment|income|revenus|cotisation|imp.t|t4|relev|remuneration|r.mun.ration|revenu|quebec|canada)/i.test(
      text
    );
  return hasDollarAmounts && hasKeywords;
}

/**
 * Render all pages of a PDF to canvases at the given scale.
 * Returns an array of HTMLCanvasElement.
 */
async function renderPDFToCanvases(pdf, scale = 3.0) {
  const canvases = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

/**
 * Run Tesseract OCR on an array of canvases.
 * Reuses a single worker across all pages for efficiency.
 */
async function ocrCanvases(canvases) {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  let text = '';
  for (const canvas of canvases) {
    const result = await worker.recognize(canvas);
    text += result.data.text + '\n';
  }
  await worker.terminate();
  return text;
}

/**
 * Extract text from a PDF.
 *
 * Strategy:
 *  1. Try pdfjs native text extraction (fast, works for digital PDFs).
 *  2. If the result doesn't look like real tax data (e.g. scanned/reordered
 *     PDFs from Adobe Acrobat), render each page to a high-res canvas and
 *     run Tesseract OCR on the visual output instead.
 */
async function extractTextFromPDF(file) {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // --- Step 1: native text extraction ---
    let nativeText = '';
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      pages.push(page);
      const content = await page.getTextContent();
      nativeText += content.items.map((item) => item.str).join(' ') + '\n';
    }

    if (looksLikeTaxData(nativeText)) {
      return { text: nativeText, confidence: 'high' };
    }

    // --- Step 2: render to canvas → OCR ---
    // (Handles scanned PDFs where embedded text order is garbled or missing)
    const canvases = [];
    for (const page of pages) {
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      canvases.push(canvas);
    }

    const ocrText = await ocrCanvases(canvases);
    return { text: ocrText, confidence: ocrText.trim().length > 100 ? 'high' : 'low' };
  } catch (err) {
    console.error('PDF extraction error:', err);
    return { text: '', confidence: 'low', error: err.message };
  }
}

async function extractTextFromImage(file) {
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    const url = URL.createObjectURL(file);
    const result = await worker.recognize(url);
    await worker.terminate();
    URL.revokeObjectURL(url);
    return {
      text: result.data.text,
      confidence: result.data.confidence > 70 ? 'high' : 'low',
    };
  } catch (err) {
    console.error('OCR error:', err);
    return { text: '', confidence: 'low', error: err.message };
  }
}

async function processFile(file) {
  const isPDF = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  if (!isPDF && !isImage) {
    return { error: 'Unsupported file type. Please upload a PDF, JPEG, or PNG.' };
  }

  const extraction = isPDF
    ? await extractTextFromPDF(file)
    : await extractTextFromImage(file);

  const docType = classifyDocument(extraction.text);

  let fields = {};
  if (docType === 'T4') fields = parseT4(extraction.text);
  else if (docType === 'RL1') fields = parseRl1(extraction.text);
  else if (docType === 'RL31') fields = parseRl31(extraction.text);

  return {
    name: file.name,
    type: file.type,
    docType,
    text: extraction.text,
    confidence: extraction.confidence,
    fields,
  };
}

function FieldEditor({ fieldKey, value, fieldDef, onChange }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value ?? '');

  const commit = () => {
    const num = parseFloat(String(localVal).replace(/,/g, ''));
    onChange(fieldKey, isNaN(num) ? localVal : num);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50 gap-2">
      <div className="flex items-center text-sm text-slate-300 min-w-0 flex-1">
        <span className="text-slate-500 text-xs mr-2 shrink-0">Box {fieldDef.box}</span>
        <span className="truncate">{fieldDef.label}</span>
        <Tooltip text={fieldDef.description} />
      </div>
      <div className="shrink-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              className="w-28 bg-slate-900 border border-blue-500 text-white text-sm px-2 py-1 rounded outline-none"
              value={localVal}
              onChange={(e) => setLocalVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="0"
            />
          </div>
        ) : (
          <button
            onClick={() => { setLocalVal(value ?? ''); setEditing(true); }}
            className={`text-sm font-mono px-2 py-0.5 rounded transition-colors ${
              value === undefined || value === null || value === ''
                ? 'text-yellow-400 bg-yellow-900/20 border border-yellow-700/50'
                : 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
            }`}
          >
            {value !== undefined && value !== null && value !== ''
              ? `$${Number(value).toLocaleString('en-CA')}`
              : 'Enter value'}
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentCard({ doc, index, onFieldChange, onTypeChange, onRemove }) {
  const typeColors = {
    T4: 'text-blue-400 bg-blue-900/20 border-blue-700/50',
    RL1: 'text-red-400 bg-red-900/20 border-red-700/50',
    RL31: 'text-green-400 bg-green-900/20 border-green-700/50',
    UNKNOWN: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
  };

  const fieldLabels = {
    T4: T4_FIELD_LABELS,
    RL1: RL1_FIELD_LABELS,
    RL31: RL31_FIELD_LABELS,
    UNKNOWN: {},
  };

  const labels = fieldLabels[doc.docType] || {};
  const fieldKeys = Object.keys(doc.fields || {});

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/60 border-b border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-slate-400 text-lg">
            {doc.type === 'application/pdf' ? '📄' : '🖼️'}
          </span>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{doc.name}</p>
            <p className="text-slate-500 text-xs">
              {doc.confidence === 'low' ? '⚠️ Low confidence — please verify values' : '✅ Extracted'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {doc.docType === 'UNKNOWN' ? (
            <select
              value={doc.docType}
              onChange={(e) => onTypeChange(index, e.target.value)}
              className="bg-slate-700 border border-yellow-700/50 text-yellow-300 text-xs px-2 py-1 rounded"
            >
              <option value="UNKNOWN">⚠️ Identify document</option>
              <option value="T4">T4</option>
              <option value="RL1">Relevé 1</option>
              <option value="RL31">Relevé 31</option>
            </select>
          ) : (
            <span className={`text-xs font-medium px-2 py-1 rounded border ${typeColors[doc.docType]}`}>
              {doc.docType === 'T4' && '✅ T4 detected'}
              {doc.docType === 'RL1' && '✅ Relevé 1 detected'}
              {doc.docType === 'RL31' && '✅ Relevé 31 detected'}
            </span>
          )}
          <button
            onClick={() => onRemove(index)}
            className="text-slate-500 hover:text-red-400 text-sm ml-1 transition-colors"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Fields */}
      {doc.docType !== 'UNKNOWN' && (
        <div className="px-4 py-2">
          {fieldKeys.length === 0 ? (
            <p className="text-yellow-400 text-sm py-3">
              ⚠️ No fields extracted automatically. Please enter values manually below.
            </p>
          ) : null}

          {Object.entries(labels).map(([key, def]) => (
            <FieldEditor
              key={key}
              fieldKey={key}
              value={doc.fields?.[key]}
              fieldDef={def}
              onChange={(k, v) => onFieldChange(index, k, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentUpload({ onComplete }) {
  const [docs, setDocs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    setProcessing(true);
    const newDocs = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert(`"${file.name}" is not a supported format. Please upload PDF, JPEG, or PNG files.`);
        continue;
      }
      setProcessingFile(file.name);
      const result = await processFile(file);
      if (!result.error) {
        newDocs.push(result);
      } else {
        alert(`Error processing "${file.name}": ${result.error}`);
      }
    }

    setDocs((prev) => {
      const combined = [...prev];
      for (const newDoc of newDocs) {
        const existingIdx = combined.findIndex(
          (d) => d.docType === newDoc.docType && newDoc.docType !== 'UNKNOWN'
        );
        if (existingIdx >= 0 && newDoc.docType !== 'UNKNOWN') {
          const replace = window.confirm(
            `We already have a ${DOCUMENT_LABELS[newDoc.docType]}. Replace it?`
          );
          if (replace) combined[existingIdx] = newDoc;
        } else {
          combined.push(newDoc);
        }
      }
      return combined;
    });

    setProcessing(false);
    setProcessingFile('');
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const onFileInput = (e) => {
    handleFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const onFieldChange = (docIdx, key, value) => {
    setDocs((prev) =>
      prev.map((d, i) =>
        i === docIdx ? { ...d, fields: { ...d.fields, [key]: value } } : d
      )
    );
  };

  const onTypeChange = (docIdx, newType) => {
    setDocs((prev) =>
      prev.map((d, i) =>
        i === docIdx
          ? {
              ...d,
              docType: newType,
              fields:
                newType === 'T4' ? parseT4(d.text)
                : newType === 'RL1' ? parseRl1(d.text)
                : newType === 'RL31' ? parseRl31(d.text)
                : {},
            }
          : d
      )
    );
  };

  const onRemove = (docIdx) => {
    setDocs((prev) => prev.filter((_, i) => i !== docIdx));
  };

  const t4Doc = docs.find((d) => d.docType === 'T4');
  const rl1Doc = docs.find((d) => d.docType === 'RL1');
  const rl31Doc = docs.find((d) => d.docType === 'RL31');

  const canContinue = t4Doc && rl1Doc;
  const missingBox14 = t4Doc && !t4Doc.fields?.box14;
  const missingBoxE = rl1Doc && !rl1Doc.fields?.boxE;

  const handleContinue = () => {
    if (!canContinue) return;
    onComplete({
      t4: t4Doc?.fields || {},
      rl1: rl1Doc?.fields || {},
      rl31: rl31Doc?.fields || null,
      hasRl31: !!rl31Doc,
    });
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <span className="text-red-500">●</span>
            <span>Step 1 of 4</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Your Tax Slips</h1>
          <p className="text-slate-400">
            Upload your <strong className="text-white">T4</strong> (federal) and{' '}
            <strong className="text-white">Relevé 1</strong> (Quebec). Optionally add a{' '}
            <strong className="text-white">Relevé 31</strong> if you rent your home.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-8 ${
            dragOver
              ? 'border-red-500 bg-red-900/10'
              : 'border-slate-600 hover:border-slate-400 bg-slate-800/30 hover:bg-slate-800/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onFileInput}
            className="hidden"
          />

          {processing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-300 text-sm">
                Processing: <span className="text-white">{processingFile}</span>
              </p>
              <p className="text-slate-500 text-xs">Analyzing document — this may take a moment…</p>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-4">📂</div>
              <p className="text-white text-lg font-semibold mb-1">Drop your tax slips here</p>
              <p className="text-slate-400 text-sm mb-3">
                or click to browse &mdash; PDF, JPEG, or PNG
              </p>
              <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-500">
                <span className="bg-slate-700 px-2 py-0.5 rounded">T4</span>
                <span className="bg-slate-700 px-2 py-0.5 rounded">Relevé 1</span>
                <span className="bg-slate-700 px-2 py-0.5 rounded">Relevé 31 (optional)</span>
              </div>
            </>
          )}
        </div>

        {/* Document Cards */}
        {docs.length > 0 && (
          <div className="space-y-4 mb-8">
            {docs.map((doc, i) => (
              <DocumentCard
                key={i}
                doc={doc}
                index={i}
                onFieldChange={onFieldChange}
                onTypeChange={onTypeChange}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}

        {/* Validation messages */}
        {t4Doc && !rl1Doc && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 mb-4 text-blue-300 text-sm">
            ℹ️ T4 detected. Please also upload your <strong>Relevé 1</strong> (from Revenu Québec) to continue.
          </div>
        )}
        {missingBox14 && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
            ⛔ <strong>T4 Box 14 (Employment Income)</strong> is required. Please enter this value above.
          </div>
        )}
        {missingBoxE && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
            ⛔ <strong>Relevé 1 Box E (Quebec income tax withheld)</strong> is required. Please enter this value above.
          </div>
        )}

        {/* Discrepancy notice */}
        {t4Doc && rl1Doc && t4Doc.fields?.box14 && rl1Doc.fields?.boxA &&
          Math.abs((t4Doc.fields.box14 || 0) - (rl1Doc.fields.boxA || 0)) > 100 && (
          <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4 mb-4 text-slate-300 text-sm">
            ℹ️ Your T4 income (${(t4Doc.fields.box14 || 0).toLocaleString('en-CA')}) differs from your
            Relevé 1 income (${(rl1Doc.fields.boxA || 0).toLocaleString('en-CA')}). Small differences
            are normal due to taxable benefits.
          </div>
        )}

        {/* Continue CTA */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!canContinue || missingBox14 || missingBoxE || processing}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
              canContinue && !missingBox14 && !missingBoxE
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:scale-105 active:scale-95'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Looks good, continue →
          </button>
        </div>
      </div>
    </div>
  );
}
