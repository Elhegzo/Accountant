# QuébecTax 2025 — CLAUDE.md

## What This App Does

A free, client-side web app that helps Quebec residents file their 2025 taxes (CRA federal + Revenu Québec provincial) without an accountant or login.

**Workflow:** Upload tax documents (T4, Relevé 1, Relevé 31) → Claude extracts data via vision API → User reviews/edits values → App calculates taxes → App provides step-by-step NETFILE filing guidance.

All processing is client-side. No data is stored or sent to any server except the Claude API for document extraction.

---

## Tech Stack

- **React 19** + **Vite 7** — UI and build
- **Tailwind CSS 4** — styling
- **@anthropic-ai/sdk** — Claude vision API for document extraction
- **pdfjs-dist** — PDF → image conversion before sending to Claude
- **Vitest** — unit testing

---

## Project Structure

```
quebec-tax-app/
├── src/
│   ├── components/         # UI components (one per app phase)
│   │   ├── Landing.jsx
│   │   ├── DocumentUpload.jsx
│   │   ├── CreditDiscovery.jsx
│   │   ├── CalculationReview.jsx
│   │   └── FilingGuidance.jsx
│   ├── utils/              # Business logic
│   │   ├── extractWithClaude.js   # Claude API call + response parsing
│   │   ├── documentProcessor.js   # File → normalized fields
│   │   ├── taxCalculator.js       # Federal & Quebec tax math
│   │   ├── parseT4.js / parseRl1.js / parseRl31.js
│   │   └── __tests__/             # Unit tests
│   ├── constants/
│   │   ├── taxRates2025.js        # Tax brackets
│   │   └── credits2025.js         # Credit rates & thresholds
│   └── App.jsx             # Phase routing (Landing → Upload → Credits → Calculation → Filing)
├── index.html
├── vite.config.js
└── package.json
```

---

## Commands

```bash
# Install
npm install

# Dev server (localhost:5173)
npm run dev

# Production build → dist/
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Tests
npm run test
npm run test:watch
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Yes | Anthropic API key (`sk-ant-api03-...`) |

- Set in `.env` for local dev (already in `.gitignore`)
- Set in Vercel → Settings → Environment Variables for production
- The `VITE_` prefix is required — Vite bakes it into the bundle at build time
- Without this key, document extraction fails; users must enter values manually

---

## Key Conventions

**Field naming:** Box identifiers (e.g. `"14"`, `"B.A"`) are converted to camelCase keys via `toFieldKey()` → `"box14"`, `"boxBA"`.

**PDF handling:** PDFs are rendered to PNG images at 2× scale via pdfjs-dist, then base64-encoded and sent to Claude. The PDF.js worker is loaded from CDN (not bundled) — see `vite.config.js`.

**Tax calculation:** Pure functions in `taxCalculator.js`. Progressive brackets are applied iteratively; non-refundable credits are fixed percentages of amounts.

**Phase routing:** App state lives in `App.jsx` and advances linearly through phases: `landing → upload → credits → calculation → filing`.

---

## Deployment

Hosted on **Vercel**. Pushing to `main` triggers an automatic redeploy. The API key must be set in Vercel's environment variables (not just `.env`) for production builds to work.

---

## Caveats

- Tax calculations are for informational purposes only — not professional tax advice
- Only supports 2025 tax year rates
- Only supports Quebec residents (dual federal + provincial filing)
