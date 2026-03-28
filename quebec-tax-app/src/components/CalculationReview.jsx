import { useState } from 'react';
import { calculateFederal, calculateQuebec, formatCurrency } from '../utils/taxCalculator';

function Tooltip({ text }) {
  return (
    <span className="tooltip-container ml-1 text-slate-400 cursor-help text-xs">
      ⓘ
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

function EditableLine({ label, value, onChange, tooltip, indent = false, bold = false, separator = false, isTotal = false }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');

  const startEdit = () => {
    setLocalVal(Math.abs(value ?? 0).toString());
    setEditing(true);
  };

  const commit = () => {
    const num = parseFloat(localVal);
    if (!isNaN(num)) onChange(num);
    setEditing(false);
  };

  if (separator) {
    return <div className={`border-t ${isTotal ? 'border-slate-400 my-1' : 'border-slate-700/50 my-0.5'}`} />;
  }

  const isNegative = value < 0;
  const absVal = Math.abs(value ?? 0);

  return (
    <div className={`flex items-center justify-between py-1.5 gap-2 group ${indent ? 'pl-4' : ''} ${bold ? 'font-bold' : ''}`}>
      <div className="flex items-center text-sm min-w-0 flex-1">
        <span className={`${bold ? 'text-white' : 'text-slate-300'} truncate`}>
          {label}
        </span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="shrink-0">
        {editing ? (
          <input
            autoFocus
            type="number"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="w-28 bg-slate-900 border border-blue-500 text-white text-sm px-2 py-0.5 rounded outline-none text-right font-mono"
          />
        ) : (
          <button
            onClick={onChange ? startEdit : undefined}
            className={`font-mono text-sm px-1 rounded transition-colors ${
              onChange
                ? 'hover:bg-slate-700/50 cursor-text group-hover:text-blue-300'
                : 'cursor-default'
            } ${
              isNegative ? 'text-red-300' : bold ? 'text-white' : 'text-slate-200'
            }`}
            title={onChange ? 'Click to edit' : undefined}
          >
            {isNegative ? '−' : ''}{formatCurrency(absVal)}
          </button>
        )}
      </div>
    </div>
  );
}

function TaxColumn({ title, jurisdiction, calc, onOverride }) {
  const isFederal = jurisdiction === 'federal';

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 font-mono text-sm">
      {/* Column header */}
      <div className={`flex items-center gap-2 mb-5 pb-3 border-b border-slate-700`}>
        <span className="text-2xl">{isFederal ? '🇨🇦' : '⚜️'}</span>
        <div>
          <p className="text-white font-bold text-base">{title}</p>
          <p className="text-slate-400 text-xs">{isFederal ? 'CRA — T1 Return' : 'Revenu Québec — TP-1 Return'}</p>
        </div>
      </div>

      {isFederal ? (
        <>
          <EditableLine
            label="Employment Income (line 15000)"
            value={calc.employmentIncome}
            tooltip="T4 Box 14 — your total employment income before deductions"
            onChange={(v) => onOverride('box14', v)}
          />
          {calc.enhancedQppDeduction > 0 && (
            <EditableLine
              label="− Enhanced QPP Deduction (line 22215)"
              value={-calc.enhancedQppDeduction}
              indent
              tooltip="Enhanced QPP2 contributions are deducted from income, not claimed as a credit"
            />
          )}
          {calc.rrspDeduction > 0 && (
            <EditableLine
              label="− RRSP Deduction"
              value={-calc.rrspDeduction}
              indent
              tooltip="Your RRSP contributions reduce your taxable income dollar-for-dollar"
            />
          )}
          <EditableLine separator bold />
          <EditableLine
            label="= Net / Taxable Income (line 26000)"
            value={calc.taxableIncome}
            bold
            tooltip="The income amount on which federal tax is calculated"
          />
          <EditableLine separator />
          <EditableLine
            label="Gross Federal Tax"
            value={calc.grossTax}
            tooltip="Tax calculated by applying federal progressive brackets to your taxable income"
          />
          <EditableLine
            label="− Basic Personal Credit"
            value={-calc.bpaAmount * calc.creditRate}
            indent
            tooltip={`Every Canadian gets a non-refundable credit of $${calc.bpaAmount.toLocaleString('en-CA')} × 14.5%`}
          />
          <EditableLine
            label="− QPP Credit (base only, line 30800)"
            value={-calc.baseQppAmount * calc.creditRate}
            indent
            tooltip="Only the BASE QPP contribution qualifies for a 14.5% federal non-refundable credit"
          />
          <EditableLine
            label="− EI Premiums Credit (line 31200)"
            value={-calc.eiAmount * calc.creditRate}
            indent
            tooltip="Your Employment Insurance premiums qualify for a 14.5% federal credit"
          />
          <EditableLine
            label="− Canada Employment Credit (line 31260)"
            value={-calc.employmentAmount * calc.creditRate}
            indent
            tooltip={`A flat $${calc.employmentAmount.toLocaleString('en-CA')} employment credit at 14.5%`}
          />
          {calc.ppipAmount > 0 && (
            <EditableLine
              label="− PPIP Credit (line 31210)"
              value={-calc.ppipAmount * calc.creditRate}
              indent
              tooltip="Provincial Parental Insurance Plan premiums — 14.5% federal credit"
            />
          )}
          {calc.medicalExpenses > 0 && (
            <EditableLine
              label="Medical Expenses (line 33099)"
              value={calc.medicalExpenses}
              indent
              tooltip={`T4 Box 85 employee health premiums. Net credit after threshold: ${formatCurrency(calc.medicalCreditAmount)}`}
            />
          )}
          {calc.donationsCredit > 0 && (
            <EditableLine
              label="− Charitable Donations Credit"
              value={-calc.donationsCredit}
              indent
              tooltip="First $200 of donations: 14.5% credit. Amounts above $200: 29% credit"
            />
          )}
          {calc.topUpCredit > 0 && (
            <EditableLine
              label="− Top-Up Tax Credit (line 34990)"
              value={-calc.topUpCredit}
              indent
              tooltip="Temporary credit compensating for the 15% → 14.5% rate change on credits above the first bracket"
            />
          )}
          <EditableLine separator />
          <EditableLine
            label="= Total Credits (line 33800)"
            value={calc.totalCredits}
            bold
            tooltip="Non-refundable credits at 14.5% + donations + top-up"
          />
          <EditableLine separator />
          <EditableLine
            label="Federal Tax (line 40600)"
            value={calc.taxAfterCredits}
            bold
            tooltip="Federal tax remaining after applying all non-refundable credits"
          />
          <EditableLine
            label="− Quebec Abatement 16.5% (line 44000)"
            value={-calc.quebecAbatement}
            tooltip="Quebec residents receive a 16.5% reduction because Quebec funds its own social programs independently."
          />
          <EditableLine separator bold />
          <EditableLine
            label="= Net Federal Tax"
            value={calc.netFederalTax}
            bold
            tooltip="Your actual federal tax liability after all credits and the Quebec abatement"
          />
          <EditableLine separator />
          <EditableLine
            label="Tax Already Withheld (Box 22)"
            value={-calc.taxAlreadyPaid}
            tooltip="Federal income tax your employer already remitted to CRA on your behalf"
          />
          <div className={`border-t-2 mt-2 pt-2 ${calc.refundOrOwing >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between py-1">
              <span className={`font-extrabold text-base ${calc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calc.refundOrOwing >= 0 ? 'REFUND (line 48400)' : 'BALANCE OWING'}
              </span>
              <span className={`font-extrabold text-xl font-mono ${calc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(Math.abs(calc.refundOrOwing))}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <EditableLine
            label="Employment Income (line 101)"
            value={calc.employmentIncome}
            tooltip="Relevé 1 Box A — your total Quebec employment income"
            onChange={(v) => onOverride('boxA', v)}
          />
          <EditableLine separator />
          <EditableLine
            label="− Workers Deduction (line 201)"
            value={-calc.employmentDeduction}
            indent
            tooltip={`A flat $${calc.employmentDeduction.toLocaleString('en-CA')} employment deduction for all Quebec employees`}
          />
          {calc.enhancedQppDeduction > 0 && (
            <EditableLine
              label="− Enhanced QPP Deduction (line 248)"
              value={-calc.enhancedQppDeduction}
              indent
              tooltip="Enhanced QPP2 contributions deducted from Quebec income"
            />
          )}
          {calc.rrspDeduction > 0 && (
            <EditableLine
              label="− RRSP Deduction"
              value={-calc.rrspDeduction}
              indent
              tooltip="RRSP contributions also reduce your Quebec taxable income"
            />
          )}
          {calc.unionDues > 0 && (
            <EditableLine
              label="− Union Dues"
              value={-calc.unionDues}
              indent
              tooltip="Union membership fees are deductible from Quebec income"
            />
          )}
          <EditableLine separator bold />
          <EditableLine
            label="= Net Quebec Income (line 275)"
            value={calc.netIncome}
            bold
            tooltip="The income amount on which Quebec provincial tax is calculated"
          />
          <EditableLine separator />
          <EditableLine
            label="Tax on Taxable Income (line 401)"
            value={calc.grossTax}
            tooltip="Tax calculated by applying Quebec progressive brackets (14%–25.75%) to net income"
          />
          <EditableLine
            label="− Basic Personal Credit (line 350)"
            value={-calc.bpaCredit}
            indent
            tooltip={`Quebec basic personal amount: $${calc.bpaAmount.toLocaleString('en-CA')} × 14% = ${formatCurrency(calc.bpaCredit)}`}
          />
          {calc.medicalCredit > 0 && (
            <EditableLine
              label="− Medical Expenses Credit (line 389)"
              value={-calc.medicalCredit}
              indent
              tooltip={`${formatCurrency(calc.medicalEligible)} eligible medical expenses × 20% = ${formatCurrency(calc.medicalCredit)}`}
            />
          )}
          <EditableLine separator />
          <EditableLine
            label="= Non-Refundable Credits (line 399)"
            value={calc.totalNonRefundableCredits}
            bold
            tooltip="Total Quebec non-refundable credits"
          />
          <EditableLine separator bold />
          <EditableLine
            label="= Tax Payable (line 450)"
            value={calc.taxPayable}
            bold
            tooltip="Your Quebec tax liability after all non-refundable credits"
          />
          <EditableLine separator />
          <EditableLine
            label="Tax Withheld (line 451)"
            value={-calc.taxAlreadyPaid}
            tooltip="Quebec income tax your employer already remitted to Revenu Québec"
          />
          {calc.qppOverpayment > 0 && (
            <EditableLine
              label="QPP Overpayment (line 452)"
              value={-calc.qppOverpayment}
              indent
              tooltip="You overpaid QPP contributions — the excess is refunded"
            />
          )}
          {calc.workPremium > 0 && (
            <EditableLine
              label="Work Premium (line 456)"
              value={-calc.workPremium}
              indent
              tooltip="Quebec refundable tax credit for low-to-moderate income workers (Schedule P)"
            />
          )}
          <div className={`border-t-2 mt-2 pt-2 ${calc.refundOrOwing >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between py-1">
              <span className={`font-extrabold text-base ${calc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calc.refundOrOwing >= 0 ? 'REFUND (line 478)' : 'BALANCE OWING'}
              </span>
              <span className={`font-extrabold text-xl font-mono ${calc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(Math.abs(calc.refundOrOwing))}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CalculationReview({ documents, credits, onComplete }) {
  const { t4: rawT4, rl1: rawRl1, hasRl31 } = documents;
  const [overrides, setOverrides] = useState({ t4: {}, rl1: {} });
  const [accepted, setAccepted] = useState(false);

  const t4 = { ...rawT4, ...overrides.t4 };
  const rl1 = { ...rawRl1, ...overrides.rl1 };

  const federalCalc = calculateFederal(t4, rl1, credits);
  const quebecCalc = calculateQuebec(t4, rl1, credits);

  const onT4Override = (key, val) => setOverrides((prev) => ({ ...prev, t4: { ...prev.t4, [key]: val } }));
  const onRl1Override = (key, val) => setOverrides((prev) => ({ ...prev, rl1: { ...prev.rl1, [key]: val } }));

  const totalRefund = federalCalc.refundOrOwing + quebecCalc.refundOrOwing;

  const handleContinue = () => {
    if (!accepted) return;
    onComplete({ federalCalc, quebecCalc, t4, rl1, hasRl31 });
  };

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <span className="text-red-500">●●●</span>
            <span>Step 3 of 4</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Your Tax Calculations</h1>
          <p className="text-slate-400 text-sm">
            Click any dollar amount to edit it. Every line has a{' '}
            <span className="text-slate-300">ⓘ tooltip</span> with a plain-English explanation.
          </p>
        </div>

        {/* Summary bar */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-6 py-4 mb-8 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex gap-6">
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Federal Refund</p>
              <p className={`font-bold text-lg ${federalCalc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {federalCalc.refundOrOwing >= 0 ? '+' : ''}{formatCurrency(federalCalc.refundOrOwing)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Quebec Refund</p>
              <p className={`font-bold text-lg ${quebecCalc.refundOrOwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {quebecCalc.refundOrOwing >= 0 ? '+' : ''}{formatCurrency(quebecCalc.refundOrOwing)}
              </p>
            </div>
            {hasRl31 && (
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Solidarity Credit</p>
                <p className="font-bold text-lg text-blue-400">~$960/yr</p>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs mb-0.5">Combined Total</p>
            <p className={`font-extrabold text-2xl ${totalRefund >= 0 ? 'text-green-300' : 'text-red-400'}`}>
              {totalRefund >= 0 ? '+' : ''}{formatCurrency(totalRefund)}
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TaxColumn
            title="Federal Return (T1)"
            jurisdiction="federal"
            calc={federalCalc}
            onOverride={onT4Override}
          />
          <TaxColumn
            title="Quebec Return (TP-1)"
            jurisdiction="quebec"
            calc={quebecCalc}
            onOverride={onRl1Override}
          />
        </div>

        {/* Solidarity credit note */}
        {hasRl31 && (
          <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="text-blue-300 font-semibold text-sm">Quebec Solidarity Tax Credit</p>
              <p className="text-slate-400 text-xs mt-1">
                Based on your Relevé 31, you likely qualify for approximately{' '}
                <strong className="text-white">$960/year</strong> in solidarity credit, paid in{' '}
                <strong className="text-white">quarterly installments of ~$240</strong> by Revenu Québec.
                This is separate from your provincial tax refund.
              </p>
            </div>
          </div>
        )}

        {/* Balance owing note */}
        {(federalCalc.refundOrOwing < 0 || quebecCalc.refundOrOwing < 0) && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6">
            <p className="text-red-300 font-semibold text-sm mb-1">Balance Owing</p>
            <p className="text-slate-400 text-xs">
              {federalCalc.refundOrOwing < 0 && (
                <>Federal: You owe {formatCurrency(Math.abs(federalCalc.refundOrOwing))} — pay at{' '}
                <a href="https://www.canada.ca/en/revenue-agency/services/payments-cra.html" target="_blank" rel="noreferrer" className="text-blue-400 underline">canada.ca/payments</a>. </>
              )}
              {quebecCalc.refundOrOwing < 0 && (
                <>Quebec: You owe {formatCurrency(Math.abs(quebecCalc.refundOrOwing))} — pay at{' '}
                <a href="https://www.revenuquebec.ca" target="_blank" rel="noreferrer" className="text-blue-400 underline">revenuquebec.ca</a>.</>
              )}
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-5 mb-6">
          <p className="text-amber-300 font-semibold text-sm mb-2">
            Important Disclaimer
          </p>
          <p className="text-amber-200/70 text-sm leading-relaxed mb-4">
            These calculations are estimates based on standard 2025 tax rates. You are responsible for
            verifying all values before filing. This tool does not provide professional tax advice.
            Individual circumstances (multiple employers, self-employment income, investment income,
            non-standard deductions) may affect your actual tax owing.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-500"
            />
            <span className="text-amber-200 text-sm">
              I understand and accept responsibility for verifying these calculations before filing.
            </span>
          </label>
        </div>

        {/* Continue */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!accepted}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
              accepted
                ? 'bg-red-600 hover:bg-red-500 text-white hover:scale-105 active:scale-95'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Generate my filing summary →
          </button>
        </div>
      </div>
    </div>
  );
}
