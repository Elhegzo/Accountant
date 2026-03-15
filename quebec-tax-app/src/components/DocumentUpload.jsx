import { useState, useCallback, useRef } from 'react';
import { processDocument, FIELD_DEFS } from '../utils/documentProcessor';

const DOCUMENT_LABELS = { T4: 'T4', RL1: 'Relevé 1', RL31: 'Relevé 31' };

// ---------------------------------------------------------------------------
// API key helpers
// VITE_ANTHROPIC_API_KEY works as a local-dev override, but Vite bakes it
// into the JS bundle — never use it for a public deployment.
// For production, users enter their key here and it lives only in
// sessionStorage (cleared automatically when the tab is closed).
// ---------------------------------------------------------------------------

const SESSION_KEY = 'anthropicApiKey';

function readApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || sessionStorage.getItem(SESSION_KEY) || '';
}

function saveApiKey(key) {
  if (key) sessionStorage.setItem(SESSION_KEY, key);
  else sessionStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// ApiKeyBanner — shown when no key is present
// ---------------------------------------------------------------------------

function ApiKeyBanner({ onSave }) {
  const [draft, setDraft] = useState('');
  const [show,  setShow]  = useState(false);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    saveApiKey(trimmed);
    onSave(trimmed);
  };

  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-6 text-sm">
      <p className="text-yellow-300 font-medium mb-2">
        🔑 Enter your Anthropic API key to enable automatic extraction
      </p>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          placeholder="sk-ant-api03-…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 bg-slate-900 border border-slate-600 text-white text-sm px-3 py-1.5 rounded outline-none focus:border-yellow-500"
        />
        <button
          onClick={() => setShow((s) => !s)}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 transition-colors"
        >
          {show ? 'hide' : 'show'}
        </button>
        <button
          onClick={handleSave}
          className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
        >
          Save
        </button>
      </div>
      <p className="text-slate-500 text-xs mt-2">
        Stored only in this browser tab — cleared when you close the tab. Never sent to our servers.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({ text }) {
  return (
    <span className="tooltip-container ml-1 text-slate-500 cursor-help">
      ⓘ
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — one editable row in the Box | Description | Amount table
// ---------------------------------------------------------------------------

function FieldRow({ row, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const hasValue = row.value !== undefined && row.value !== null && row.value !== '';

  const displayValue = () => {
    if (!hasValue) return 'Enter value';
    if (row.isNumeric) {
      return `$${Number(row.value).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
    }
    return String(row.value);
  };

  const startEditing = () => {
    setDraft(hasValue ? String(row.value) : '');
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft === '') {
      onChange(undefined);
      return;
    }
    if (row.isNumeric) {
      const num = parseFloat(draft.replace(/[$,\s]/g, ''));
      if (!isNaN(num)) onChange(num);
    } else {
      onChange(draft);
    }
  };

  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-2 pr-4 text-slate-400 text-xs font-mono w-12">{row.box}</td>
      <td className="py-2 pr-4 text-slate-300 text-sm">
        {row.description}
        {row.tooltip && <Tooltip text={row.tooltip} />}
      </td>
      <td className="py-2 text-right w-40">
        {editing ? (
          <input
            autoFocus
            type={row.isNumeric ? 'number' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-full bg-slate-900 border border-blue-500 text-white text-sm px-2 py-1 rounded outline-none"
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
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// DocumentCard — one card per uploaded file
// ---------------------------------------------------------------------------

function DocumentCard({ doc, index, onRowChange, onTypeChange, onRemove }) {
  const typeColors = {
    T4:      'text-blue-400 bg-blue-900/20 border-blue-700/50',
    RL1:     'text-red-400 bg-red-900/20 border-red-700/50',
    RL31:    'text-green-400 bg-green-900/20 border-green-700/50',
    UNKNOWN: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
  };

  const hasRows = doc.displayRows?.length > 0;

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
            <span className={`text-xs font-medium px-2 py-1 rounded border ${typeColors[doc.docType]}`}>
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

      {/* Error banner */}
      {doc.extractionError && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-700/50 text-red-300 text-sm">
          ⚠️ {doc.extractionError}
        </div>
      )}

      {/* Fields table */}
      {doc.docType !== 'UNKNOWN' && (
        <div className="px-4 py-3">
          {!hasRows ? (
            <p className="text-slate-400 text-sm py-2">No fields extracted.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="pb-2 text-left text-xs text-slate-500 font-medium w-12">Box</th>
                  <th className="pb-2 text-left text-xs text-slate-500 font-medium">Description</th>
                  <th className="pb-2 text-right text-xs text-slate-500 font-medium w-40">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.displayRows.map((row, i) => (
                  <FieldRow
                    key={row.key || i}
                    row={row}
                    onChange={(val) => onRowChange(index, i, val)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentUpload — main step component
// ---------------------------------------------------------------------------

export default function DocumentUpload({ onComplete }) {
  const [docs,           setDocs]           = useState([]);
  const [processing,     setProcessing]     = useState(false);
  const [processingFile, setProcessingFile] = useState('');
  const [dragOver,       setDragOver]       = useState(false);
  const [apiKey,         setApiKey]         = useState(readApiKey);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(
    async (files) => {
      const supported = [];
      for (const file of files) {
        if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
          alert(`"${file.name}" is not supported. Please upload a PDF or image file.`);
        } else {
          supported.push(file);
        }
      }
      if (!supported.length) return;

      setProcessing(true);
      setProcessingFile(supported.map((f) => f.name).join(', '));

      // Process all supported files concurrently.
      const settled = await Promise.allSettled(
        supported.map((file) => processDocument(file, apiKey))
      );

      const newDocs = [];
      for (const outcome of settled) {
        if (outcome.status === 'rejected') {
          alert(`Unexpected error: ${outcome.reason}`);
          continue;
        }
        const result = outcome.value;
        if (result.error) {
          alert(`Error: ${result.error}`);
        } else {
          // Attach a stable id so React can key the card without using array index.
          newDocs.push({ ...result, id: crypto.randomUUID() });
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

  // Update a single row's value and keep the fields object in sync.
  const onRowChange = (docIdx, rowIdx, newValue) => {
    setDocs((prev) =>
      prev.map((d, i) => {
        if (i !== docIdx) return d;
        const updatedRows   = d.displayRows.map((row, ri) =>
          ri === rowIdx ? { ...row, value: newValue } : row
        );
        const updatedFields = { ...d.fields, [d.displayRows[rowIdx].key]: newValue };
        return { ...d, displayRows: updatedRows, fields: updatedFields };
      })
    );
  };

  // When the user manually picks a doc type on the error fallback, populate
  // the table with empty rows from the field definitions for that type.
  const onTypeChange = (docIdx, newType) => {
    const defs      = FIELD_DEFS[newType] || {};
    const emptyRows = Object.entries(defs).map(([key, def]) => ({
      key,
      box:         def.box,
      description: def.label,
      value:       undefined,
      tooltip:     def.description,
      isNumeric:   def.isNumeric !== false,
    }));
    setDocs((prev) =>
      prev.map((d, i) =>
        i === docIdx
          ? { ...d, docType: newType, displayRows: emptyRows, fields: {} }
          : d
      )
    );
  };

  const onRemove = (docIdx) => setDocs((prev) => prev.filter((_, i) => i !== docIdx));

  const onDrop = useCallback(
    (e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); },
    [handleFiles]
  );
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileInput = (e) => { handleFiles(Array.from(e.target.files)); e.target.value = ''; };

  const t4Doc   = docs.find((d) => d.docType === 'T4');
  const rl1Doc  = docs.find((d) => d.docType === 'RL1');
  const rl31Doc = docs.find((d) => d.docType === 'RL31');

  const canContinue  = t4Doc && rl1Doc;
  const missingBox14 = t4Doc  && !t4Doc.fields?.box14;
  const missingBoxE  = rl1Doc && !rl1Doc.fields?.boxE;

  const handleContinue = () => {
    if (!canContinue) return;
    onComplete({
      t4:      t4Doc?.fields   || {},
      rl1:     rl1Doc?.fields  || {},
      rl31:    rl31Doc?.fields || null,
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

        {/* API Key Banner */}
        {!apiKey && <ApiKeyBanner onSave={setApiKey} />}

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
            accept=".pdf,image/*"
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
              <p className="text-white text-lg font-semibold mb-1">Drop your tax slips here</p>
              <p className="text-slate-400 text-sm mb-3">
                or click to browse — PDF, JPEG, or PNG
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
                key={doc.id || doc.name}
                doc={doc}
                index={i}
                onRowChange={onRowChange}
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
