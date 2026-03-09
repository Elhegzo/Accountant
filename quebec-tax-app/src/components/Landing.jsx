export default function Landing({ onStart }) {
  return (
    <div className="min-h-screen bg-[#0d1b2a] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍁</span>
          <span className="text-white font-bold text-lg tracking-tight">QuébecTax</span>
          <span className="text-xs text-slate-400 ml-1">2025</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
          100% client-side &middot; no data sent to servers
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <span>🍁</span>
            <span>Free · 2025 Tax Year · Montreal / Quebec</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
            File your 2025{' '}
            <span className="text-red-500">Quebec</span> taxes
            <br />
            <span className="text-slate-300">— free, in ~10 minutes.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Upload your <strong className="text-white">T4</strong> and{' '}
            <strong className="text-white">Relevé 1</strong>. We'll handle the math for both your{' '}
            <span className="text-blue-400">federal (CRA)</span> and{' '}
            <span className="text-red-400">Quebec (Revenu Québec)</span> returns.
          </p>

          {/* CTA */}
          <button
            onClick={onStart}
            className="btn-cta-pulse bg-red-600 hover:bg-red-500 text-white text-xl font-bold px-10 py-5 rounded-2xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Start Filing →
          </button>

          <p className="text-slate-500 text-sm mt-4">
            No login required &middot; No data saved &middot; Works on mobile
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20 px-4">
          {[
            {
              icon: '📄',
              title: 'Upload your slips',
              desc: 'T4, Relevé 1, and optionally a Relevé 31 (rent slip). We auto-detect and extract all fields.',
            },
            {
              icon: '🧮',
              title: 'We do the math',
              desc: 'Full step-by-step calculation for both CRA federal and Revenu Québec provincial returns.',
            },
            {
              icon: '✅',
              title: 'File confidently',
              desc: 'Step-by-step NETFILE guidance with your exact numbers pre-filled. You click submit.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/8 transition-colors"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-16 text-slate-500 text-sm">
          <span className="flex items-center gap-1.5"><span>🔒</span> No server — runs in your browser</span>
          <span className="flex items-center gap-1.5"><span>🇨🇦</span> 2025 CRA + Revenu Québec rates</span>
          <span className="flex items-center gap-1.5"><span>📱</span> Mobile friendly</span>
          <span className="flex items-center gap-1.5"><span>⚡</span> No account needed</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/10 text-center text-slate-600 text-xs">
        For informational purposes only. Not professional tax advice. Always verify your return before filing.
      </footer>
    </div>
  );
}
