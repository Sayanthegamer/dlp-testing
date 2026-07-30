# Specification: Gap Remediation & Product Invariant Enforcement

## Overview
Align model configurations, ingestion schemas, review logic, and client components with the product invariants and architecture guidelines specified in `product.md` and `tech-stack.md`.

## Functional Requirements
1. **Model Versions & Constants**:
   - Update model strings in server config (`parse.js`) to active provider model identifiers.
2. **Deterministic `needsReview` Logic**:
   - Remove dependency on AI self-reported `confidenceScore` and model-asserted `needsReview` flags for UI highlighting.
   - Implement client-side `computeNeedsReview(question)` evaluator checking:
     - Is `correctAnswer` unset (`null`/`undefined`)?
     - For MCQ: Are `options` length < 2 or empty?
     - Does any `<math>` span in `questionText` or `options` throw a KaTeX parsing error?
     - Is question stem text missing or extremely short?
   - Update UI badges in `QuestionCard.jsx` to indicate concrete review reasons rather than raw confidence percentages.
3. **Correct Answer Auto-Selection Invariant**:
   - Update `extractAndParseJson` in `server/routes/parse.js`:
     - If `correctAnswer` is not explicitly present in model output, set `correctAnswer: null` (do NOT default to index `0`).
     - Flag question for user review when `correctAnswer` is `null`.
4. **Hardened JSON Schema Validation & Failover**:
   - Validate returned JSON shape from AI calls against required schema fields (`testTitle`, `questions` array with `id`, `questionText`, `options`, `mathSpans`) before accepting response.
   - If primary provider fails or returns invalid JSON schema shape, execute fallback provider retry before resorting to demo response.
5. **Dead Component Cleanup**:
   - Audit `MathToolbar.jsx` vs. `FloatingMathPopover.jsx`. Remove unreferenced `MathToolbar.jsx` to prevent component drift and duplicate code logic.

## Acceptance Criteria
- [ ] No default index `0` applied to missing `correctAnswer` in backend proxy.
- [ ] UI highlights questions with amber `needsReview` badge strictly when concrete review conditions are triggered.
- [ ] KaTeX rendering errors trigger immediate `needsReview = true` flag.
- [ ] Server proxy verifies JSON structure prior to returning success.
- [ ] Unused duplicate component `MathToolbar.jsx` is deleted cleanly.
