# Implementation Plan: Gap Remediation & Product Invariant Enforcement

## Phase 1: Backend Parsing Invariants & Model Updates
- [x] Task: Model string verification & server updates
  - [x] Update `server/routes/parse.js` model string references.
  - [x] Remove default `correctAnswer: 0` fallback in `extractAndParseJson`; set to `null` if missing.
- [x] Task: Response Schema Validation & Failover Hardening
  - [x] Add explicit JSON schema validator function in `parse.js`.
  - [x] Reject malformed schema responses in provider loop so secondary provider fallback fires cleanly.

## Phase 2: Client-side Deterministic Review Evaluator
- [x] Task: Create `computeNeedsReview` utility
  - [x] Implement evaluator checking KaTeX render status, option counts, stem length, and `correctAnswer` presence.
- [x] Task: Update UI Components (`QuestionCard.jsx`, `QuestionCatalogue.jsx`)
  - [x] Replace `confidenceScore < 75` check with deterministic `computeNeedsReview(question)`.
  - [x] Display specific review triggers on the card badge (e.g. "Unset Correct Answer", "Math Render Error").

## Phase 3: Component Cleanup & Verification
- [x] Task: Component cleanup
  - [x] Delete `client/src/components/VisualMathEditor/MathToolbar.jsx`.
- [x] Task: Phase Verification & Checkpoint
  - [x] Run client and server builds; perform manual multi-input parsing check to verify review badges and correct answer behaviors.

