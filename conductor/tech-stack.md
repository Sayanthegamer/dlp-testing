# Technology Stack

## Frontend Layer
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS (custom exam paper palette)
- **Math Rendering**: KaTeX 0.16
- **Document Parsing**: JSZip 3.10 (OMML XML unzipping)
- **Icons**: Lucide React

## Backend Layer
- **Runtime**: Node.js + Express 4.19
- **AI Engines**:
  - Google Gemini API (`gemini-3.5-flash-lite`) via `@google/generative-ai`
  - Anthropic Claude API (`claude-3-5-sonnet`) via `@anthropic-ai/sdk`
- **Failover**: Automatic multi-provider API key fallback

## Tooling & Dev Environment
- **Monorepo Scripts**: Concurrently (running server :5000 and client :3000)
- **Server Reloading**: Nodemon
