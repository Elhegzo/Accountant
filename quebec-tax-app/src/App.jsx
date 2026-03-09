import { useState } from 'react';
import Landing from './components/Landing';
import DocumentUpload from './components/DocumentUpload';
import CreditDiscovery from './components/CreditDiscovery';
import CalculationReview from './components/CalculationReview';
import FilingGuidance from './components/FilingGuidance';

const PHASES = ['landing', 'upload', 'credits', 'calculation', 'filing'];

function ProgressBar({ phase }) {
  if (phase === 'landing') return null;
  const steps = ['Upload', 'Credits', 'Calculate', 'File'];
  const currentIdx = PHASES.indexOf(phase) - 1;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-white font-bold text-sm mr-4">
          <span className="text-lg">🍁</span>
          <span>QuébecTax 2025</span>
        </div>
        <div className="flex-1 flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < currentIdx ? 'bg-red-500' :
                  i === currentIdx ? 'bg-red-400' : 'bg-slate-700'
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`w-2 h-2 rounded-full mx-1 ${i < currentIdx ? 'bg-red-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {steps.map((step, i) => (
            <span
              key={step}
              className={`text-xs font-medium hidden sm:block ${
                i === currentIdx ? 'text-white' : i < currentIdx ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {i < currentIdx ? '✓ ' : ''}{step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState('landing');
  const [documents, setDocuments] = useState(null);
  const [credits, setCredits] = useState(null);
  const [calcResults, setCalcResults] = useState(null);

  const handleLandingStart = () => {
    setPhase('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadComplete = (docs) => {
    setDocuments(docs);
    setPhase('credits');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreditsComplete = (creditData) => {
    setCredits(creditData);
    setPhase('calculation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCalculationComplete = (results) => {
    setCalcResults(results);
    setPhase('filing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <ProgressBar phase={phase} />
      {phase !== 'landing' && <div className="h-16" />}

      {phase === 'landing' && (
        <Landing onStart={handleLandingStart} />
      )}
      {phase === 'upload' && (
        <DocumentUpload onComplete={handleUploadComplete} />
      )}
      {phase === 'credits' && documents && (
        <CreditDiscovery documents={documents} onComplete={handleCreditsComplete} />
      )}
      {phase === 'calculation' && documents && credits !== null && (
        <CalculationReview
          documents={documents}
          credits={credits}
          onComplete={handleCalculationComplete}
        />
      )}
      {phase === 'filing' && calcResults && (
        <FilingGuidance calcResults={calcResults} />
      )}
    </div>
  );
}
