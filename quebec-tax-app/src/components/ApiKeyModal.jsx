import { useState } from 'react';

const STORAGE_KEY = 'anthropic_api_key';

export function getStoredApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function storeApiKey(key) {
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
}

export default function ApiKeyModal({ onClose }) {
  const [key, setKey] = useState(getStoredApiKey());
  const [show, setShow] = useState(false);

  const handleSave = () => {
    const trimmed = key.trim();
    storeApiKey(trimmed);
    onClose(trimmed);
  };

  const handleClear = () => {
    storeApiKey('');
    setKey('');
    onClose('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose(getStoredApiKey());
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose(getStoredApiKey())}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🤖</span>
          <div>
            <h2 className="text-white text-lg font-bold">Claude AI Parsing</h2>
            <p className="text-slate-400 text-xs">Powered by the Anthropic API</p>
          </div>
        </div>

        <p className="text-slate-300 text-sm mb-3">
          Claude AI reads your tax slips visually — the same way it works in Claude chat — giving
          perfect extraction of every box value from scanned PDFs and images.
        </p>

        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 mb-4 text-xs text-slate-400 space-y-1">
          <p>🔒 Your key is stored only in <strong className="text-slate-300">your browser's local storage</strong>.</p>
          <p>📡 It is sent only directly to <strong className="text-slate-300">api.anthropic.com</strong> — never to any other server.</p>
          <p>
            🔑 Get your key at{' '}
            <span className="text-blue-400 font-mono">console.anthropic.com</span>
            {' '}→ API Keys.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="sk-ant-api03-..."
            autoFocus
            className="flex-1 bg-slate-900 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={() => setShow(!show)}
            className="text-slate-400 hover:text-white px-3 py-2 border border-slate-600 rounded-lg text-sm transition-colors"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Save & Enable AI Parsing
          </button>
          {getStoredApiKey() && (
            <button
              onClick={handleClear}
              className="text-red-400 hover:text-red-300 px-4 py-2 border border-red-900/50 hover:border-red-700 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => onClose(getStoredApiKey())}
            className="text-slate-400 hover:text-white px-4 py-2 border border-slate-600 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
