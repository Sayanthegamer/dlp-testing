# Project Guidelines & Rules

# Gemini Model Configuration Invariant
- **Model Invariant**: NEVER change, sanitize, fallback-rewrite, or substitute `gemini-3.5-flash-lite` for Gemini API calls across `server/routes/parse.js`, `server/index.js`, `api/index.js`, `.env`, or `.env.example`.
- **Model Identifiers**: The project environment specifically targets `gemini-3.5-flash-lite`. Do not infer that `3.5-flash-lite` is invalid or attempt to replace it with other model names.
