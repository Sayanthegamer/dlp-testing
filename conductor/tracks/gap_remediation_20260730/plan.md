# Implementation Plan: Gap Remediation & Product Invariant Enforcement

## Phase 1: Backend Parsing Invariants & Model Updates
- [ ] Task: Model string verification & server updates
  - [ ] Update `server/routes/parse.js` model string references.
  - [ ] Remove default `correctAnswer: 0` fallback in `extractAndParseJson`; set to `null` if missing.
- [ ] Task: Response Schema Validation & Failover Hardening
  - [ ] Add explicit JSON schema validator function in `parse.js`.
  - [ ] Reject malformed schema responses in provider loop so secondary provider fallback fires cleanly.

## Phase 2: Client-side Deterministic Review Evaluator
- [ ] Task: Create `computeNeedsReview` utility
  - [ ] Implement evaluator checking KaTeX render status, option counts, stem length, and `correctAnswer` presence.
- [ ] Task: Update UI Components (`QuestionCard.jsx`, `QuestionCatalogue.jsx`)
  - [ ] Replace `confidenceScore < 75` check with deterministic `computeNeedsReview(question)`.
  - [ ] Display specific review triggers on the card badge (e.g. "Unset Correct Answer", "Math Render Error").

## Phase 3: Component Cleanup & Verification
- [ ] Task: Component cleanup
  - [ ] Delete `client/src/components/VisualMathEditor/MathToolbar.jsx`.
- [ ] Task: Phase Verification & Checkpoint
  - [ ] Run client and server builds; perform manual multi-input parsing check to verify review badges and correct answer behaviors.
