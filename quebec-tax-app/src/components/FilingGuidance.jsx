import { useState, useRef } from 'react';
import { formatCurrency } from '../utils/taxCalculator';

function Step({ number, text, checked, onCheck, children }) {
  return (
    <div className={`rounded-xl border transition-colors ${checked ? 'border-green-700/50 bg-green-900/10' : 'border-slate-700 bg-slate-800/40'}`}>
      <label className="flex items-start gap-3 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-green-500 shrink-0"
        />
        <div className="flex-1">
          <span className={`text-sm font-medium ${checked ? 'text-green-300 line-through decoration-green-700' : 'text-slate-200'}`}>
            <span className="text-slate-500 mr-2">Step {number}:</span>
            {text}
          </span>
          {children && !checked && (
            <div className="mt-2">{children}</div>
          )}
        </div>
        {checked && <span className="text-green-400 text-lg shrink-0">✓</span>}
      </label>
    </div>
  );
}

function FilingColumn({ title, flag, agency, steps, checkedSteps, onCheck }) {
  const allDone = steps.every((_, i) => checkedSteps[i]);
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      <div className={`px-5 py-4 border-b border-slate-700 flex items-center gap-3 ${allDone ? 'bg-green-900/20' : 'bg-slate-900/40'}`}>
        <span className="text-2xl">{flag}</span>
        <div>
          <p className="text-white font-bold">{title}</p>
          <p className="text-slate-400 text-xs">{agency}</p>
        </div>
        {allDone && <span className="ml-auto text-green-400 text-sm font-medium">✅ Complete</span>}
      </div>
      <div className="p-4 space-y-2">
        {steps.map((step, i) => (
          <Step
            key={i}
            number={i + 1}
            text={step.text}
            checked={!!checkedSteps[i]}
            onCheck={(v) => onCheck(i, v)}
          >
            {step.children}
          </Step>
        ))}
      </div>
    </div>
  );
}

export default function FilingGuidance({ calcResults }) {
  const { federalCalc, quebecCalc, t4, rl1, hasRl31 } = calcResults;

  const [federalChecked, setFederalChecked] = useState({});
  const [quebecChecked, setQuebecChecked] = useState({});
  const [federalConfirmNum, setFederalConfirmNum] = useState('');
  const [quebecConfirmNum, setQuebecConfirmNum] = useState('');
  const [done, setDone] = useState(false);

  const printRef = useRef(null);

  const onFederalCheck = (i, v) => setFederalChecked((prev) => ({ ...prev, [i]: v }));
  const onQuebecCheck = (i, v) => setQuebecChecked((prev) => ({ ...prev, [i]: v }));

  const federalDone = [0,1,2,3,4,5,6].every((i) => federalChecked[i]);
  const quebecDone = [0,1,2,3,4,5,6].every((i) => quebecChecked[i]);
  const allDone = federalDone && quebecDone;

  const federalLine15000 = t4?.box14 || 0;
  const federalRefund = federalCalc?.refundOrOwing || 0;
  const quebecRefund = quebecCalc?.refundOrOwing || 0;

  const federalSteps = [
    { text: 'Go to canada.ca/taxes — log in to My Account (or create one)' },
    { text: 'Select "File a return" → NETFILE → choose a certified software or use a CRA partner' },
    { text: 'Enter your SIN and date of birth to verify your identity' },
    {
      text: `When asked for Line 15000 (Total Income) — enter: ${formatCurrency(federalLine15000)}`,
      children: (
        <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-green-300">
          Line 15000: {formatCurrency(federalLine15000)}
        </div>
      ),
    },
    { text: 'Review the pre-filled amounts from your T4 and confirm all entries match' },
    { text: 'Submit — you will receive a confirmation number immediately' },
    {
      text: 'Save your CRA confirmation number:',
      children: (
        <input
          type="text"
          value={federalConfirmNum}
          onChange={(e) => setFederalConfirmNum(e.target.value)}
          placeholder="e.g. 123456789ABC"
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 font-mono"
        />
      ),
    },
  ];

  const quebecSteps = [
    { text: 'Go to revenuquebec.ca — log in to Mon dossier (or create one)' },
    { text: 'Select "Produire une déclaration" → NetFile Québec' },
    { text: 'Enter your NAS (Social Insurance Number) to verify your identity' },
    {
      text: 'Enter your amounts as shown in your Quebec summary below',
      children: (
        <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 space-y-1 text-sm font-mono">
          <p className="text-slate-300">Box A (Employment income): <span className="text-green-300">{formatCurrency(rl1?.boxA || 0)}</span></p>
          <p className="text-slate-300">Box E (Quebec tax withheld): <span className="text-green-300">{formatCurrency(rl1?.boxE || 0)}</span></p>
        </div>
      ),
    },
    { text: 'Review and confirm all entries match your Relevé 1' },
    { text: 'Submit — you will receive a confirmation number immediately' },
    {
      text: 'Save your Revenu Québec confirmation number:',
      children: (
        <input
          type="text"
          value={quebecConfirmNum}
          onChange={(e) => setQuebecConfirmNum(e.target.value)}
          placeholder="e.g. QC-2025-XXXXXXXX"
          className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 font-mono"
        />
      ),
    },
  ];

  const handlePrint = () => {
    window.print();
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center text-white px-4">
        <div className="max-w-xl text-center">
          <div className="text-7xl mb-6">🎉</div>
          <h1 className="text-4xl font-extrabold mb-4">You're done!</h1>
          <p className="text-xl text-slate-300 mb-2">Your 2025 taxes are filed.</p>
          <p className="text-slate-400 text-sm mb-8">
            Keep your confirmation numbers safe — CRA and Revenu Québec may contact you if they have questions.
          </p>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-left mb-8 font-mono text-sm space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Your Filing Summary</p>
            <p className="text-slate-300">Federal Refund: <span className={federalRefund >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(Math.abs(federalRefund))} {federalRefund >= 0 ? '✅' : '⚠️'}</span></p>
            <p className="text-slate-300">Quebec Refund: <span className={quebecRefund >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(Math.abs(quebecRefund))} {quebecRefund >= 0 ? '✅' : '⚠️'}</span></p>
            {hasRl31 && <p className="text-slate-300">Solidarity Credit: <span className="text-blue-400 font-bold">~$960/yr</span></p>}
            {federalConfirmNum && <p className="text-slate-300">CRA Confirmation: <span className="text-white">{federalConfirmNum}</span></p>}
            {quebecConfirmNum && <p className="text-slate-300">RQ Confirmation: <span className="text-white">{quebecConfirmNum}</span></p>}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handlePrint}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              🖨️ Print / Save as PDF
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-medium border border-slate-700 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <span className="text-red-500">●●●●</span>
            <span>Step 4 of 4</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">File Your Returns</h1>
          <p className="text-slate-400 text-sm">
            Check off each step as you complete it. Your key numbers are shown in the panel below.
          </p>
        </div>

        {/* Key Numbers Panel */}
        <div className="bg-slate-800/60 border border-slate-600 rounded-2xl p-6 mb-8">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">📋 Your Key Filing Numbers — Copy These</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Line 15000 (Total Income)', value: formatCurrency(federalLine15000), color: 'text-white' },
              { label: 'Federal Refund Expected', value: formatCurrency(Math.abs(federalRefund)), color: federalRefund >= 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Quebec Refund Expected', value: formatCurrency(Math.abs(quebecRefund)), color: quebecRefund >= 0 ? 'text-green-400' : 'text-red-400' },
              ...(hasRl31 ? [{ label: 'Solidarity Credit (quarterly)', value: '~$240', color: 'text-blue-400' }] : []),
            ].map((item) => (
              <div key={item.label} className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">{item.label}</p>
                <p className={`font-bold text-xl font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column filing guides */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <FilingColumn
            title="Federal Filing (CRA)"
            flag="🇨🇦"
            agency="Canada Revenue Agency — NETFILE"
            steps={federalSteps}
            checkedSteps={federalChecked}
            onCheck={onFederalCheck}
          />
          <FilingColumn
            title="Quebec Filing (Revenu Québec)"
            flag="⚜️"
            agency="Revenu Québec — NetFile Québec"
            steps={quebecSteps}
            checkedSteps={quebecChecked}
            onCheck={onQuebecCheck}
          />
        </div>

        {/* Important links */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 mb-8">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Useful Links</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { label: 'CRA My Account', url: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/account-individuals.html' },
              { label: 'CRA NETFILE', url: 'https://www.canada.ca/en/revenue-agency/services/e-services/e-filing-individuals/netfile-overview.html' },
              { label: 'Revenu Québec — Mon dossier', url: 'https://www.revenuquebec.ca/en/online-services/mon-dossier-pour-les-citoyens/' },
              { label: 'NetFile Québec', url: 'https://www.revenuquebec.ca/en/online-services/filing-and-remittance/individuals/netfile-quebec/' },
              ...(federalRefund < 0 ? [{ label: 'Pay CRA balance owing', url: 'https://www.canada.ca/en/revenue-agency/services/payments-cra.html' }] : []),
              ...(quebecRefund < 0 ? [{ label: 'Pay Revenu Québec balance', url: 'https://www.revenuquebec.ca/en/online-services/payment/' }] : []),
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>🔗</span> {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Done CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => setDone(true)}
            disabled={!allDone}
            className={`px-10 py-5 rounded-2xl font-extrabold text-xl shadow-2xl transition-all ${
              allDone
                ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95 btn-cta-pulse'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {allDone ? "🎉 I'm done filing!" : `Complete all steps to finish (${Object.values(federalChecked).filter(Boolean).length + Object.values(quebecChecked).filter(Boolean).length}/14)`}
          </button>
        </div>
      </div>
    </div>
  );
}
