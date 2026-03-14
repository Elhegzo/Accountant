import { useState, useCallback, useRef } from 'react';
import { extractWithClaude } from '../utils/extractWithClaude';
import { T4_FIELD_LABELS } from '../utils/parseT4';
import { RL1_FIELD_LABELS } from '../utils/parseRl1';
import { RL31_FIELD_LABELS } from '../utils/parseRl31';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const DOCUMENT_LABELS = { T4: 'T4', RL1: 'Relevé 1', RL31: 'Relevé 31' };

/**
 * Required fields that must always have a visible row so the user can fill
 * them in even when the API didn't extract a value.
 */
const REQUIRED_FIELDS = {
  T4:  ['box14'],
  RL1: ['boxE'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Tooltip({ text }) {
  return (
    <span className="tooltip-container ml-1 text-slate-500 cursor-help">
      ⓘ
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

/**
 * Call Claude to extract fields from a single file.
 * Returns a document object; on API failure returns one with extractionError set.
 */
async function processFile(file, apiKey) {
  const isPDF = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  if (!isPDF && !isImage) {
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
    console.error('Claude extraction error:', err);
    const isKeyMissing = err.message === 'ANTHROPIC_API_KEY_MISSING';
    const isAuthError  = err.status === 401 || err.status === 403 ||
                         (err.message || '').toLowerCase().includes('auth');
    const extractionError = isKeyMissing
      ? 'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in your .env file and restart the dev server.'
      : isAuthError
      ? 'API key rejected (401/403). Double-check the key in your .env file and restart the dev server.'
      : `Extraction failed: ${err.message || 'unknown error'}. Please enter your values manually.`;
    return {
      name: file.name,
      type: file.type,
      docType: 'UNKNOWN',
      fields: {},
      extractionError,
    };
  }
}

// ---------------------------------------------------------------------------
// FieldEditor — single editable row
// ---------------------------------------------------------------------------

function FieldEditor({ fieldKey, value, fieldDef, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isNumeric = fieldDef.isNumeric !== false;
  const hasValue = value !== undefined && value !== null && value !== '';

  const displayValue = () => {
    if (!hasValue) return 'Enter value';
    if (isNumeric)
      return `$${Number(value).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
    return String(value);
  };

  const startEditing = () => {
    setDraft(hasValue ? String(value) : '');
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft === '') {
      onChange(fieldKey, undefined);
      return;
    }
    if (isNumeric) {
      const num = parseFloat(draft.replace(/[$,\s]/g, ''));
      if (!isNaN(num)) onChange(fieldKey, num);
    } else {
      onChange(fieldKey, draft);
    }
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
          <input
            autoFocus
            type={isNumeric ? 'number' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-36 bg-slate-900 border border-blue-500 text-white text-sm px-2 py-1 rounded outline-none"
          />
        ) : (
          <button
            onClick={startEditing}
            className={`text-sm font-mono px-2 py-0.5 rounded transition-colors ${
              !hasValue
                ? 'text-yellow-400 bg-yellow-900/20 border border-yellow-700/50 hover:bg-yellow-900/40'
                : 'text-green-300 bg-green-900/20 hover:bg-green-900/40'
            }`}
          >
            {displayValue()}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentCard — one card per uploaded file
// ---------------------------------------------------------------------------

function DocumentCard({ doc, index, onFieldChange, onTypeChange, onRemove }) {
  const typeColors = {
    T4:      'text-blue-400 bg-blue-900/20 border-blue-700/50',
    RL1:     'text-red-400 bg-red-900/20 border-red-700/50',
    RL31:    'text-green-400 bg-green-900/20 border-green-700/50',
    UNKNOWN: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
  };

  const fieldLabels = {
    T4:      T4_FIELD_LABELS,
    RL1:     RL1_FIELD_LABELS,
    RL31:    RL31_FIELD_LABELS,
    UNKNOWN: {},
  };

  const labels = fieldLabels[doc.docType] || {};
  const requiredKeys = REQUIRED_FIELDS[doc.docType] || [];

  /**
   * Which rows to render:
   *   • extraction error → show all labels so user can fill everything in manually
   *   • extraction OK    → only show extracted keys + always-required keys
   */
  const visibleEntries = Object.entries(labels).filter(([key]) => {
    if (doc.extractionError) return true;
    return key in (doc.fields || {}) || requiredKeys.includes(key);
  });

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
              {doc.extractionError ? '⚠️ Manual entry' : '✅ Extracted'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Classification — always automatic; dropdown only shown on extraction failure */}
          {doc.docType === 'UNKNOWN' ? (
            <select
              value={doc.docType}
              onChange={(e) => onTypeChange(index, e.target.value)}
              className="bg-slate-700 border border-yellow-700/50 text-yellow-300 text-xs px-2 py-1 rounded"
            >
              <option value="UNKNOWN">Select type…</option>
              <option value="T4">T4</option>
              <option value="RL1">Relevé 1</option>
              <option value="RL31">Relevé 31</option>
            </select>
          ) : (
            <span
              className={`text-xs font-medium px-2 py-1 rounded border ${typeColors[doc.docType]}`}
            >
              {doc.docType === 'T4'   && '✅ T4 detected'}
              {doc.docType === 'RL1'  && '✅ Relevé 1 detected'}
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

      {/* Extraction error banner */}
      {doc.extractionError && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-700/50 text-red-300 text-sm">
          ⚠️ {doc.extractionError}
        </div>
      )}

      {/* Field rows */}
      {doc.docType !== 'UNKNOWN' && (
        <div className="px-4 py-2">
          {visibleEntries.length === 0 && (
            <p className="text-slate-400 text-sm py-3">No fields extracted.</p>
          )}
          {visibleEntries.map(([key, def]) => (
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

// ---------------------------------------------------------------------------
// DocumentUpload — main step component
// ---------------------------------------------------------------------------

export default function DocumentUpload({ onComplete }) {
  const [docs, setDocs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // API key: env var (silent) → localStorage fallback
  const apiKey =
    import.meta.env.VITE_ANTHROPIC_API_KEY ||
    localStorage.getItem('anthropicApiKey') ||
    '';

  const handleFiles = useCallback(
    async (files) => {
      setProcessing(true);
      const newDocs = [];

      for (const file of files) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          alert(
            `"${file.name}" is not a supported format. Please upload PDF, JPEG, or PNG files.`
          );
          continue;
        }
        setProcessingFile(file.name);
        const result = await processFile(file, apiKey);
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
              `We already have a ${DOCUMENT_LABELS[newDoc.docType] || newDoc.docType}. Replace it?`
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
    },
    [apiKey]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
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

  // Type can be corrected manually when extraction fails (docType === 'UNKNOWN')
  const onTypeChange = (docIdx, newType) => {
    setDocs((prev) =>
      prev.map((d, i) => (i === docIdx ? { ...d, docType: newType } : d))
    );
  };

  const onRemove = (docIdx) => {
    setDocs((prev) => prev.filter((_, i) => i !== docIdx));
  };

  const t4Doc  = docs.find((d) => d.docType === 'T4');
  const rl1Doc = docs.find((d) => d.docType === 'RL1');
  const rl31Doc = docs.find((d) => d.docType === 'RL31');

  const canContinue  = t4Doc && rl1Doc;
  const missingBox14 = t4Doc  && !t4Doc.fields?.box14;
  const missingBoxE  = rl1Doc && !rl1Doc.fields?.boxE;

  const handleContinue = () => {
    if (!canContinue) return;
    onComplete({
      t4:     t4Doc?.fields  || {},
      rl1:    rl1Doc?.fields || {},
      rl31:   rl31Doc?.fields || null,
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
              <p className="text-slate-500 text-xs">Extracting with AI…</p>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-4">📂</div>
              <p className="text-white text-lg font-semibold mb-1">
                Drop your tax slips here
              </p>
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
            ℹ️ T4 detected. Please also upload your <strong>Relevé 1</strong> (from Revenu
            Québec) to continue.
          </div>
        )}
        {missingBox14 && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
            ⛔ <strong>T4 Box 14 (Employment Income)</strong> is required. Please enter this
            value above.
          </div>
        )}
        {missingBoxE && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
            ⛔ <strong>Relevé 1 Box E (Quebec income tax withheld)</strong> is required. Please
            enter this value above.
          </div>
        )}

        {/* Income discrepancy notice */}
        {t4Doc && rl1Doc && t4Doc.fields?.box14 && rl1Doc.fields?.boxA &&
          Math.abs((t4Doc.fields.box14 || 0) - (rl1Doc.fields.boxA || 0)) > 100 && (
            <div className="bg-slate-700/40 border border-slate-600 rounded-xl p-4 mb-4 text-slate-300 text-sm">
              ℹ️ Your T4 income ($
              {(t4Doc.fields.box14 || 0).toLocaleString('en-CA')}) differs from your Relevé 1
              income (${(rl1Doc.fields.boxA || 0).toLocaleString('en-CA')}). Small differences
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
