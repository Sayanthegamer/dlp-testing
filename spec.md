# Specification: Student Test-Taking Pipeline (Phase 2, Pass 1)

## Overview
Add a student-facing flow that lets a student take a published test, submit
answers, and see an auto-graded result — reusing the same question schema
and exam-native visual language established in Phase 1. This pass covers
**taking the test and seeing a result only**. It does not cover a teacher
results dashboard or server-persisted attempts (see Out of Scope).

## Background / Constraints from Existing Docs
- `product.md` explicitly scopes "no test-taking flow" out of Phase 1 but
  requires Phase 1 not to hardcode assumptions that would block this.
- `product-guidelines.md`'s exam-native visual language, zero-LaTeX rule,
  and "no separate edit mode" philosophy apply equally to the student view
  — the student view is read-only, not a stripped edit mode.
- `tech-stack.md`: no accounts/auth system exists; the teacher gate is a
  single shared `APP_PASSWORD` checked via header, not per-user auth.
- Deployment target is Vercel serverless (`vercel.json`, `api/index.js`)
  — no durable local disk, no DB currently wired up.

## Access Model
- Reuses the **same shared-password gate pattern** already built for
  teachers (`AccessGateModal.jsx`, `verifyPassword`, `authMiddleware` in
  `server/index.js` / `api/index.js`), but as a **separate password**:
  `STUDENT_PASSWORD` (new env var), distinct from `APP_PASSWORD`.
  - Rationale: teachers and students must not share a credential — a
    leaked student password shouldn't unlock the authoring/editing UI.
  - Reuses existing `/api/verify-password` shape but needs a `role` or
    a second endpoint (`/api/verify-student-password`) so the same code
    path doesn't accidentally accept either password for either role.
- No per-student identity/login. Student enters **only** a display name
  (free text, no verification) before starting — used solely to label
  the result screen ("Nice work, Priya!") and is NOT persisted or sent
  anywhere. This is cosmetic, not an account system.

## Persistence Model (This Pass)
- **Client-only.** No new server route for storing attempts or scores.
- Attempt state (in-progress answers) lives in React state for the
  duration of the session. Optionally mirrored to `sessionStorage` (not
  `localStorage`) so an accidental refresh doesn't wipe an in-progress
  attempt — but a closed tab/browser is allowed to lose it. This is a
  deliberate scope line: durable cross-device persistence is a backend
  problem this pass does not solve.
- Score/result exists only in the browser that took the test. The
  teacher has **no visibility** into student results from this pass.
  This is a known, explicitly accepted gap — see Out of Scope.

## Data Flow
1. Teacher's existing catalogue (`testTitle` + `questions[]`) is the
   source of truth. This pass reads it **directly** — no `publishedExam`
   snapshot layer yet (that's the Phase 2 Pass 2 work discussed
   separately). This means: if a teacher edits a question while a
   student is mid-test, the student's next render will reflect the
   edit. This is a known limitation, acceptable for this pass, and
   exactly the gap the future `publishedExam` snapshot is meant to close.
2. Student completes the access gate → enters display name → sees an
   intro/start screen (test title, question count, optional time
   estimate) → begins the test.
3. One question at a time (not a scrolling list like the teacher
   catalogue) — this is a deliberate UX split from the editor view,
   matching real exam-taking conventions (see UX section).
4. On submit, grading runs entirely client-side (see Grading Logic).
5. Result screen shows score, and per-question breakdown (correct/
   incorrect, with the correct answer revealed) — configurable later,
   hardcoded "always show correct answers" for this pass.

## Question Type Model (Revised)
The existing `type: "mcq" | "short_answer"` is split into three types:
- `"mcq"` — unchanged.
- `"short_answer_numeric"` — auto-gradable via a tolerance/range check.
- `"short_answer_text"` — never auto-graded, always routed to pending
  review (free-text math answers can't be reliably string-matched;
  see Grading Logic).

**No implicit type inference.** A question's type is always one of
these three explicit strings — nothing downstream (grading, review
flagging, UI) infers numeric-vs-text from the shape of
`correctAnswer`. This mirrors the existing product rule that the
system never silently assumes something it wasn't explicitly told.

### Backward Compatibility (Breaking, Deliberate)
Legacy questions with `type: "short_answer"` (pre-this-pass, no
numeric/text suffix) are **not** auto-migrated to either new type.
They are treated as **unclassified** and forced into `needsReview`
until a teacher explicitly reclassifies them as one or the other in
the `QuestionCard` UI. This is a deliberate choice, not an oversight:
silently defaulting legacy questions to "text" (ungraded) or "numeric"
(potentially wrongly auto-graded) would both violate the same
never-silently-assume principle driving the rest of this design.
Existing test data (`INITIAL_CATALOGUE` in `App.jsx`, the docx sample
in `handleLoadDocxSample`) will need one-time updates to use explicit
types where they currently use bare `short_answer`.

## Numeric Short-Answer Schema
New field on question objects, only meaningful when
`type === "short_answer_numeric"`:
```js
{
  type: "short_answer_numeric",
  correctAnswer: 2,          // AI-suggested or teacher-set center value
  acceptedRange: [1.99, 2.01], // [min, max], inclusive
  ...
}
```
- **AI suggests, teacher can override.** The parsing prompt
  (`SYSTEM_PROMPT` in `server/routes/parse.js`) is extended to ask for
  a numeric `correctAnswer` plus a small auto-derived tolerance
  (e.g. ±1% or ±0.01, whichever is larger, unless the AI has reason to
  suggest a wider range — e.g. a question that expects a rounded
  answer). The teacher-facing `QuestionCard` UI gets a new control to
  view/edit both the center value and the range directly — no raw
  JSON, no LaTeX, consistent with the rest of the editor.
- **Missing or invalid range blocks the question from being
  auto-gradable.** If `type === "short_answer_numeric"` but
  `acceptedRange` is absent, malformed (e.g. `min > max`), or
  `correctAnswer` isn't a finite number, the question is forced into
  `needsReview` with a specific reason ("Numeric range not set") —
  same mechanism as the existing `correctAnswer === null` MCQ case in
  `reviewEvaluator.js`, not a new one-off check.
- **"Blocks publish" — scoped to what exists today.** There is no
  publish gate yet (no `publishedExam` snapshot layer exists in this
  pass — see spec's Data Flow section). For now, "blocks publish"
  means: the question is flagged `needsReview` and the test-taking
  flow's own logic treats any `needsReview` question the same as an
  unset MCQ answer (accepted as an answer from the student, excluded
  from the auto-graded score). Once the `publishedExam` snapshot/
  validation-gate work (discussed separately, still unbuilt) lands,
  that gate should hard-block publish on this condition rather than
  just soft-flagging it — noting this explicitly so it isn't lost.

## Grading Logic
- **MCQ**: exact match against `question.correctAnswer` (index).
- **`short_answer_numeric`**: parse the student's input as a float
  (reject/treat-as-incorrect if it doesn't parse), check it falls
  within `acceptedRange` inclusive. If the question itself lacks a
  valid range (see above), it's excluded from auto-grading regardless
  of what the student entered — never silently graded against a
  missing/malformed range.
- **`short_answer_text`**: never auto-graded. Always routed to
  `pendingReview`, shown separately from the auto-graded score. This
  mirrors the existing product philosophy (`product.md` §4) of never
  having the system assert something it can't actually verify —
  string-matching free-text math answers is exactly that failure mode.
- **Unclassified legacy `short_answer`**: treated identically to a
  missing-range numeric question — `needsReview`, excluded from
  auto-grading, until reclassified.
- A test with **zero auto-gradable questions** (no MCQ, no valid
  `short_answer_numeric`) produces a result screen with no numeric
  score at all, only a completion confirmation + all answers flagged
  for review. This edge case must be handled explicitly, not left to
  produce "0/0" or `NaN%`.

## Questions Requiring `needsReview` at Publish Time
- If any question in the source catalogue has `correctAnswer === null`
  (per existing `reviewEvaluator.js`), that question **cannot be
  auto-graded** even if it's MCQ type. Student still answers it
  (so they get through the test), but it's excluded from the score
  and shown as "pending review" on the result screen — same treatment
  as short-answer questions above.
- This is the enforcement mechanism for the existing product rule
  ("correct answer never auto-selected") reaching all the way to the
  student-facing surface, not just the teacher editor.

## UX / Visual Requirements
- Extends `product-guidelines.md`'s exam-native aesthetic — same
  palette, same serif/grotesk split, no drop-shadow cards, no
  onboarding/confetti/sparkle-AI framing.
- One question per screen (not the teacher's stacked list) — Next/
  Previous navigation, a visible progress indicator ("Question 3 of
  12"), and a review screen before final submit showing which
  questions are unanswered.
- MCQ options rendered identically to the teacher view (lettered
  A/B/C/D, `MathRenderer` for math spans) but **not clickable-to-edit**
  — clicking selects an answer instead of opening the math popover.
  This requires `MathRenderer` to support a "read-only, click-to-select"
  mode distinct from its current "click-to-edit" mode.
- Zero-LaTeX rule applies identically: any KaTeX render error on the
  student side must show the same non-technical review-badge fallback
  already implemented in `MathRenderer.jsx`, not raw LaTeX.
- Result screen: exam-native, not a generic "quiz app" score card —
  no confetti, no percentage-in-giant-font gamification. Plain,
  paper-like summary consistent with the rest of the product.

## Functional Requirements
1. New student entry route/view, gated by `STUDENT_PASSWORD`.
2. Display-name capture screen (no validation, no persistence).
3. Test intro screen (title, question count).
4. Single-question-at-a-time test-taking view with Next/Previous and
   a pre-submit review screen listing unanswered questions.
5. Client-side grading engine implementing the rules above: MCQ exact
   match, `short_answer_numeric` range check, `short_answer_text` and
   unclassified-legacy always routed to pending review, zero-
   auto-gradable-questions edge case handled explicitly.
6. Result screen: score (auto-graded portion), pending-review count,
   per-question correct/incorrect + correct-answer reveal.
7. `MathRenderer` gains a read-only/selectable mode without breaking
   its existing edit-mode behavior in the teacher catalogue.
8. New env var `STUDENT_PASSWORD`, new/extended auth route, matching
   the existing `authMiddleware` pattern but scoped separately from
   the teacher `APP_PASSWORD`.
9. Question type model split: `"mcq" | "short_answer_numeric" |
   "short_answer_text"`, replacing the old two-type model. Legacy
   `"short_answer"` values are NOT auto-migrated — they're treated as
   unclassified and forced into `needsReview` until a teacher
   explicitly reclassifies them.
10. `QuestionCard.jsx` type switcher UI updated: three explicit type
    options instead of two, plus a new center-value + range editor
    control shown only when `short_answer_numeric` is selected.
11. `reviewEvaluator.js` extended with new review reasons: "Numeric
    Range Not Set" (invalid/missing `acceptedRange`) and
    "Unclassified Answer Type" (legacy bare `short_answer`).
12. `server/routes/parse.js`'s `SYSTEM_PROMPT` and
    `extractAndParseJson` updated so AI-parsed questions can produce
    `short_answer_numeric` with a suggested `correctAnswer` +
    `acceptedRange`, and `short_answer_text` where no numeric answer
    applies. `docxParserService.js`'s local fallback/demo data updated
    to use explicit types.

## Out of Scope for This Pass
- Teacher-visible results dashboard (explicitly deferred — results
  exist only in the student's own browser this pass).
- Server-persisted attempts, any database, any Vercel KV/Postgres
  wiring.
- The `publishedExam` snapshot/versioning layer discussed separately
  — this pass reads the live catalogue directly. The "blocks publish"
  behavior for missing numeric ranges is therefore soft (flagged
  `needsReview`) this pass, not a hard publish gate — see Numeric
  Short-Answer Schema section.
- Timers/time limits on the test.
- Per-student accounts, login, or identity verification.
- Retake logic, attempt limits, or attempt history.
- Partial credit, weighted scoring, or per-question point values
  (every question currently implicitly worth 1 point if auto-graded).
- Auto-migration of legacy `short_answer` questions — deliberately
  left unclassified, requiring manual teacher reclassification (see
  Backward Compatibility section).
- Non-numeric tolerance strategies (e.g. algebraic equivalence
  checking, symbolic math comparison) — `short_answer_numeric` is
  strictly a float-in-range check, nothing more sophisticated.

## Acceptance Criteria
- [ ] Student cannot reach the test-taking view without the student
      password (verified server-side, not just hidden client-side).
- [ ] Teacher's `APP_PASSWORD` does not grant student access and vice
      versa.
- [ ] A test with all MCQ questions and all `correctAnswer` set
      produces a correct numeric score with no manual review needed.
- [ ] A test with a mix of MCQ + `short_answer_numeric` (valid range)
      questions produces a correct combined auto-graded score.
- [ ] A `short_answer_numeric` question with a missing or malformed
      `acceptedRange` is excluded from auto-grading and flagged
      `needsReview` with reason "Numeric Range Not Set" — never
      silently graded against a broken range.
- [ ] A `short_answer_text` question is always routed to pending
      review regardless of what the student typed — never auto-graded.
- [ ] A legacy `type: "short_answer"` question (no suffix) is flagged
      `needsReview` with reason "Unclassified Answer Type" and
      excluded from auto-grading — not silently treated as text or
      numeric.
- [ ] A test where every question is unclassified/text/missing-range
      produces a completion screen with no numeric score, not `NaN`
      or `0/0`.
- [ ] A KaTeX render error on the student view shows the same
      non-technical fallback as the teacher view — never raw LaTeX.
- [ ] Refreshing mid-test does not lose in-progress answers (via
      `sessionStorage`); closing the tab is allowed to lose them.
- [ ] Editing a question in the teacher catalogue while a student is
      mid-test is a known, accepted limitation — not silently "fixed"
      by ad hoc caching that contradicts the "no snapshot yet" design.
- [ ] `QuestionCard.jsx`'s type switcher offers exactly the three
      explicit types (no bare `short_answer` selectable going
      forward), and the numeric range editor only appears for
      `short_answer_numeric`.
