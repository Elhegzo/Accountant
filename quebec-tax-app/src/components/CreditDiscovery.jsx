import { useState, useEffect } from 'react';
import { calculateFederal, calculateQuebec, formatCurrency } from '../utils/taxCalculator';

function Tooltip({ text }) {
  return (
    <span className="tooltip-container ml-1 text-slate-500 cursor-help text-xs">
      ⓘ
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

function CreditItem({ emoji, title, description, detected = false }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${
      detected
        ? 'bg-green-900/15 border-green-700/40'
        : 'bg-slate-800/40 border-slate-700/40'
    }`}>
      <span className="text-xl shrink-0">{emoji}</span>
      <div>
        <p className={`font-medium text-sm ${detected ? 'text-green-300' : 'text-slate-300'}`}>{title}</p>
        <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ id, question, tooltip, children, value, onChange }) {
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-800/40 transition-colors">
        <input
          type="checkbox"
          checked={value === true || value === 'yes'}
          onChange={(e) => onChange(e.target.checked ? 'yes' : 'no')}
          className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
        />
        <div className="flex-1">
          <span className="text-slate-200 text-sm">{question}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
      </label>
      {(value === true || value === 'yes') && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700 bg-slate-900/30">
          {children}
        </div>
      )}
    </div>
  );
}

export default function CreditDiscovery({ documents, onComplete }) {
  const { t4, rl1, rl31, hasRl31 } = documents;

  const [answers, setAnswers] = useState({
    rrsp: 'no',
    rrspAmount: '',
    tuition: 'no',
    tuitionAmount: '',
    medical: 'no',
    medicalAmount: '',
    homeOffice: 'no',
    homeOfficeT2200: 'no',
    donations: 'no',
    donationsAmount: '',
  });

  const setAnswer = (key, val) => setAnswers((prev) => ({ ...prev, [key]: val }));

  const hasUnionDues = !!(t4?.box44);
  const hasPrivateHealth = !!(rl1?.boxJ || rl1?.box235);

  const credits = {
    rrsp: answers.rrsp === 'yes' ? parseFloat(answers.rrspAmount) || 0 : 0,
    medical: answers.medical === 'yes' ? parseFloat(answers.medicalAmount) || 0 : 0,
    donations: answers.donations === 'yes' ? parseFloat(answers.donationsAmount) || 0 : 0,
  };

  const federalCalc = calculateFederal(t4 || {}, rl1 || {}, credits);
  const quebecCalc = calculateQuebec(t4 || {}, rl1 || {}, credits);

  const totalRefund = federalCalc.refundOrOwing + quebecCalc.refundOrOwing;

  const handleContinue = () => {
    onComplete(credits);
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <span className="text-red-500">●●</span>
            <span>Step 2 of 4</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Credits & Deductions</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We've detected some credits automatically. Answer the questions below to find any you might have missed.
          </p>
        </div>

        {/* Auto-detected credits */}
        <div className="mb-8">
          <h2 className="text-white font-semibold text-sm uppercase tracking-widest mb-3 text-slate-400">
            Auto-Detected
          </h2>
          <div className="space-y-3">
            {hasRl31 && (
              <CreditItem
                emoji="🏠"
                title="Quebec Solidarity Tax Credit detected"
                description="Because you uploaded a Relevé 31 (rent slip), you likely qualify for the Quebec Solidarity Tax Credit — approximately $960/year paid quarterly."
                detected
              />
            )}
            {hasPrivateHealth && (
              <CreditItem
                emoji="🏥"
                title="Private health premiums detected (Relevé 1 Box J / 235)"
                description={`$${((rl1?.boxJ || 0) + (rl1?.box235 || 0)).toLocaleString('en-CA')} in employee-paid health premiums — deductible as a Quebec non-refundable credit.`}
                detected
              />
            )}
            {hasUnionDues && (
              <CreditItem
                emoji="💼"
                title="Union dues detected (T4 Box 44)"
                description={`$${(t4?.box44 || 0).toLocaleString('en-CA')} in union dues — deductible both federally (15%) and in Quebec (14%).`}
                detected
              />
            )}
            {!hasRl31 && !hasPrivateHealth && !hasUnionDues && (
              <p className="text-slate-500 text-sm py-2">No additional credits auto-detected from your slips.</p>
            )}
          </div>
        </div>

        {/* Manual checklist */}
        <div className="mb-8">
          <h2 className="text-white font-semibold text-sm uppercase tracking-widest mb-3 text-slate-400">
            Check for More Deductions
          </h2>
          <div className="space-y-3">
            {/* RRSP */}
            <ChecklistItem
              id="rrsp"
              question="Did you contribute to an RRSP in 2025?"
              tooltip="Check your RRSP contribution receipts from your bank or financial institution. Contributions made in the first 60 days of 2026 also count for 2025."
              value={answers.rrsp}
              onChange={(v) => setAnswer('rrsp', v)}
            >
              <div className="pt-3">
                <label className="text-slate-400 text-xs block mb-1.5">Total RRSP contributions in 2025 ($)</label>
                <input
                  type="number"
                  value={answers.rrspAmount}
                  onChange={(e) => setAnswer('rrspAmount', e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </ChecklistItem>

            {/* Tuition */}
            <ChecklistItem
              id="tuition"
              question="Did you pay tuition at a university or college in 2025?"
              tooltip="Look for a T2202 slip from your institution. The federal tuition credit is 15% of eligible amounts. You can transfer unused credits to a parent or carry them forward."
              value={answers.tuition}
              onChange={(v) => setAnswer('tuition', v)}
            >
              <div className="pt-3">
                <label className="text-slate-400 text-xs block mb-1.5">Total eligible tuition paid ($)</label>
                <input
                  type="number"
                  value={answers.tuitionAmount}
                  onChange={(e) => setAnswer('tuitionAmount', e.target.value)}
                  placeholder="e.g. 3200"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  Note: Enter tuition amount — we'll calculate the credit rate automatically.
                </p>
              </div>
            </ChecklistItem>

            {/* Medical */}
            <ChecklistItem
              id="medical"
              question="Did you have eligible medical expenses over $2,759 in 2025?"
              tooltip="Eligible expenses include prescriptions, dental work, vision (glasses/contacts), certain medical devices, and more. The federal credit applies to amounts above $2,759 or 3% of net income, whichever is less."
              value={answers.medical}
              onChange={(v) => setAnswer('medical', v)}
            >
              <div className="pt-3">
                <label className="text-slate-400 text-xs block mb-1.5">Total eligible medical expenses ($)</label>
                <input
                  type="number"
                  value={answers.medicalAmount}
                  onChange={(e) => setAnswer('medicalAmount', e.target.value)}
                  placeholder="e.g. 4000"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </ChecklistItem>

            {/* Home office */}
            <ChecklistItem
              id="homeOffice"
              question="Did you work from home in 2025?"
              tooltip="To claim home office expenses, you need a T2200 form signed by your employer. Without it, the CRA will not accept this deduction."
              value={answers.homeOffice}
              onChange={(v) => setAnswer('homeOffice', v)}
            >
              <div className="pt-3 space-y-2">
                <p className="text-slate-400 text-xs mb-2">Did your employer provide a signed T2200 form?</p>
                <div className="flex gap-3">
                  {['yes', 'no'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="homeOfficeT2200"
                        value={opt}
                        checked={answers.homeOfficeT2200 === opt}
                        onChange={() => setAnswer('homeOfficeT2200', opt)}
                        className="accent-red-500"
                      />
                      <span className="text-slate-300 text-sm capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
                {answers.homeOfficeT2200 === 'yes' && (
                  <p className="text-green-400 text-xs mt-2">
                    ✅ Good — you can claim home office expenses. Enter your eligible expenses (rent/mortgage portion, utilities, internet) in your NETFILE submission.
                  </p>
                )}
                {answers.homeOfficeT2200 === 'no' && (
                  <p className="text-yellow-400 text-xs mt-2">
                    ⚠️ Without a T2200, you cannot claim home office expenses federally. Ask your employer to sign one for 2025.
                  </p>
                )}
              </div>
            </ChecklistItem>

            {/* Charitable donations */}
            <ChecklistItem
              id="donations"
              question="Did you make any charitable donations in 2025 (not via payroll)?"
              tooltip="Include donations to registered Canadian charities. The first $200 gets a 15% federal credit; amounts above $200 get a 29% credit. Keep your receipts — CRA may ask for them."
              value={answers.donations}
              onChange={(v) => setAnswer('donations', v)}
            >
              <div className="pt-3">
                <label className="text-slate-400 text-xs block mb-1.5">Total charitable donations ($)</label>
                <input
                  type="number"
                  value={answers.donationsAmount}
                  onChange={(e) => setAnswer('donationsAmount', e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </ChecklistItem>
          </div>
        </div>

        {/* Refund Preview */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-semibold mb-4">Estimated Refund Preview</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-slate-400 text-xs mb-1">Federal</p>
              <p className={`text-xl font-bold ${federalCalc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {federalCalc.refundOrOwing >= 0 ? '+' : ''}{formatCurrency(federalCalc.refundOrOwing)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">Quebec</p>
              <p className={`text-xl font-bold ${quebecCalc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {quebecCalc.refundOrOwing >= 0 ? '+' : ''}{formatCurrency(quebecCalc.refundOrOwing)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">Total</p>
              <p className={`text-2xl font-extrabold ${totalRefund >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                {totalRefund >= 0 ? '+' : ''}{formatCurrency(totalRefund)}
              </p>
            </div>
          </div>
          {hasRl31 && (
            <div className="text-center border-t border-slate-700 pt-3 mt-3">
              <p className="text-slate-400 text-xs">
                🏠 Plus ~$240/quarter solidarity credit (paid separately by Revenu Québec)
              </p>
            </div>
          )}
          <p className="text-slate-500 text-xs text-center mt-3">
            Estimates update live as you answer questions above.
          </p>
        </div>

        {/* Continue */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            Calculate my taxes →
          </button>
        </div>
      </div>
    </div>
  );
}
