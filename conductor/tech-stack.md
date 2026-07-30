# Technology Stack

## Frontend Layer
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS (custom exam-paper palette — see
  product-guidelines.md)
- **Math Rendering**: KaTeX 0.16
- **Document Parsing**: JSZip 3.10 (for unzipping .docx to reach
  `word/document.xml`)
- **Icons**: Lucide React

The frontend NEVER holds, stores, requests, or transmits any AI provider
API key. There is no API key input field, drawer, settings screen, or
`.env` reference anywhere in client code. All AI calls go through the
backend proxy described below.

## Backend Layer
- **Runtime**: Node.js + Express 4.19
- **Role**: thin proxy between the frontend and AI providers. The
  frontend calls backend routes like `POST /api/parse-question` (text),
  `POST /api/parse-question-image` (photo); the backend attaches
  provider API keys server-side (from environment variables, never
  committed, never sent to the client) and returns parsed/normalized
  JSON back to the frontend.
- **AI Engines**:
  - Google Gemini API — `gemini-3.5-flash-lite` via `@google/generative-ai`
    (primary — fast/cheap, good for high-volume text + image parsing)
  - Anthropic Claude API — `claude-sonnet-5` via `@anthropic-ai/sdk`
    (fallback, or for cases needing stronger reasoning — e.g. messier
    handwriting, ambiguous option/answer structure)
  - Pin whichever exact model strings are current at build time by
    checking each provider's docs — don't hardcode a specific dated
    snapshot without verifying it's still current, since these get
    deprecated.
- **Failover**: if the primary provider call fails or errors, retry
  once against the fallback provider before surfacing an error to the
  frontend.
- **Structured output**: every AI parsing call must force strict-JSON-only
  output matching the shared schema (see product.md's internal schema) —
  the backend should validate the shape of what comes back before
  returning it to the frontend, and reject/retry on malformed JSON rather
  than passing it through.

## Deployment
- This is a real hosted website for this phase, not a local-only dev
  app — deploy frontend + backend so it's reachable by a URL for testing
  outside of a local dev environment.
- No user accounts/auth in this phase, but keep backend routes structured
  so per-teacher scoping can be added later without a rewrite (e.g. don't
  treat "the one global question list" as a hardcoded assumption baked
  into route logic).

## Tooling & Dev Environment
- **Monorepo Scripts**: Concurrently (running server :5000 and client
  :3000 in dev)
- **Server Reloading**: Nodemon