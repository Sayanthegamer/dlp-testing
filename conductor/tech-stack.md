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
- **Database & Persistence**: Supabase PostgreSQL (`@supabase/supabase-js`) for persistent multi-tenant storing of teacher accounts, exams, questions, submissions, and active rolling code sessions.
- **Authentication**: Supabase Auth (Email/Password & JWT) for Teacher login/registration + Dynamic 6-digit Rolling Passcode session validation for Student test entry.
- **Media Storage**: Supabase Storage Buckets (`diagram-media`) for serving cropped diagram images via public CDN URLs.
- **Role**: proxy between the frontend, Supabase database, and AI providers.
- **AI Engines**:
  - Google Gemini API — `gemini-3.5-flash-lite` via `@google/generative-ai`
    (primary — fast/cheap, good for high-volume text + image parsing)
  - Anthropic Claude API — `claude-sonnet-5` via `@anthropic-ai/sdk`
    (fallback, or for cases needing stronger reasoning — e.g. messier
    handwriting, ambiguous option/answer structure)
- **Failover**: if the primary provider call fails or errors, retry
  once against the fallback provider before surfacing an error to the
  frontend.
- **Structured output**: every AI parsing call forces strict-JSON-only
  output matching the shared schema.

## Deployment
- Hosted full-stack application deployed on Vercel serverless / Node environment with Supabase cloud backend database and CDN storage.

## Tooling & Dev Environment
- **Monorepo Scripts**: Concurrently (running server :5000 and client :3000 in dev)
- **Server Reloading**: Nodemon