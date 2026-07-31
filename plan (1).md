# Implementation Plan: Student Test-Taking Pipeline (Phase 2, Pass 1)

This plan details the technical steps to build the student test-taking
flow, access control, routing split, question-type schema split, and
client-side grading engine while strictly adhering to
`product-guidelines.md` (exam-native visual styling, quiet tone, zero
raw LaTeX leakage).

## Decisions Locked In
> [!IMPORTANT]
> - **Routing Strategy**: Query parameter routing (`?mode=student`)
>   switches between the Teacher Catalogue and Student Test-Taking flow
>   in `App.jsx`, no new router dependency.
> - **Password Isolation**: Student auth uses `STUDENT_PASSWORD`
>   server-side and `student_access_password` in `localStorage`.
>   Teacher `APP_PASSWORD` cannot unlock student mode and vice versa.
> - **Question Type Split**: `short_answer` is replaced by two explicit
>   types — `short_answer_numeric` (auto-gradable via `acceptedRange`)
>   and `short_answer_text` (always routed to pending review, never
>   auto-graded).
> - **Numeric Range Ownership**: AI suggests `correctAnswer` +
>   `acceptedRange` at parse time; teacher can view/edit both in
>   `QuestionCard.jsx`. Missing/invalid range → `needsReview`, excluded
>   from auto-grading. (True publish-blocking is deferred until the
>   `publishedExam` snapshot layer exists — this pass only soft-flags.)
> - **Legacy Compatibility (deliberately breaking)**: Old bare
>   `type: "short_answer"` questions are NOT auto-migrated to either
>   new type. They're treated as unclassified, forced into
>   `needsReview`, and require manual teacher reclassification.

## Proposed Changes

---

### Phase 1: Access & Routing Foundation

#### [MODIFY] `server/index.js` and `api/index.js`
- Add `STUDENT_PASSWORD` handling from `process.env`.
- Implement `POST /api/verify-student-password` (mirrors
  `/api/verify-password` but checks `STUDENT_PASSWORD`). Note both
  `server/index.js` (local/standalone) and `api/index.js` (Vercel
  serverless entry) currently duplicate the teacher auth logic — this
  route needs to be added to both, matching the existing duplication
  pattern rather than introducing a shared-but-unused module this pass.

#### [MODIFY] `.env.example`
- Add `STUDENT_PASSWORD=your_student_password_here`.

#### [NEW] `client/src/components/Student/StudentAccessGateModal.jsx`
- Parallel to `AccessGateModal.jsx`, using `POST
  /api/verify-student-password`.
- Persists under `student_access_password`, isolated from the
  teacher's `app_access_password`.

#### [MODIFY] `client/src/App.jsx`
- Read `?mode=student` on mount. Conditionally render the student flow
  vs. the existing teacher catalogue. Existing teacher state/behavior
  must be unaffected when the param is absent.

---

### Phase 2: Question Type Schema Split

*(New phase — this work didn't exist in the original draft and must
land before the test-taking UI, since the UI depends on being able to
tell the three types apart.)*

#### [MODIFY] `server/routes/parse.js`
- Update `SYSTEM_PROMPT` schema description: replace `"mcq" |
  "short_answer"` with `"mcq" | "short_answer_numeric" |
  "short_answer_text"`. Instruct the model to emit `acceptedRange:
  [min, max]` alongside `correctAnswer` when it produces
  `short_answer_numeric`, with a sensible default tolerance if the
  source material doesn't imply one.
- Update `extractAndParseJson`'s per-question normalization: preserve
  `acceptedRange` when present; do NOT default/invent a range if the
  model omits one (leave it absent so `reviewEvaluator.js` catches it).

#### [MODIFY] `client/src/services/docxParserService.js`
- `processDocxLines`' fallback/demo object and the `isMcq`-false branch
  currently emit bare `type: "short_answer"`. Update to
  `"short_answer_text"` (docx extraction has no way to infer a numeric
  range from unstructured Word text, so text is the correct default
  for this path specifically — not a general legacy-compatibility
  shortcut).

#### [MODIFY] `client/src/services/reviewEvaluator.js`
- Add rule: `type === "short_answer_numeric"` with missing/malformed
  `acceptedRange` (absent, not an array of length 2, `min > max`, or
  non-finite numbers) → reason `"Numeric Range Not Set"`.
- Add rule: `type === "short_answer"` (bare, legacy) → reason
  `"Unclassified Answer Type"`.

#### [MODIFY] `client/src/components/Catalogue/QuestionCard.jsx`
- Type `<select>`: three options (`mcq`, `short_answer_numeric`,
  `short_answer_text`) instead of two. No bare `short_answer` option
  offered going forward — it only exists as a legacy value already
  present in old data.
- New control, shown only when `type === "short_answer_numeric"`:
  center value (`correctAnswer`) + range (`acceptedRange`) inputs.
  Plain numeric inputs, not LaTeX/math-syntax fields — consistent with
  the zero-LaTeX rule (this is a bare number, not a formula).

#### [MODIFY] `client/src/App.jsx`
- `INITIAL_CATALOGUE` seed data currently has no `short_answer`
  questions, so no change needed there — confirm this stays true, or
  update if seed data changes.
- `handleLoadDocxSample`'s hardcoded sample question is `type: "mcq"`,
  unaffected.
- `handleAddQuestion`'s new-question template is `type: "mcq"`,
  unaffected — no default short-answer template exists yet to update.

---

### Phase 3: Test-Taking Shell

#### [NEW] `client/src/components/Student/StudentNameCapture.jsx`
- Free-text student name input, exam-native layout. No validation, no
  persistence beyond the current session.

#### [NEW] `client/src/components/Student/TestIntroScreen.jsx`
- Displays test title, question count, "Begin Test" button.

#### [MODIFY] `client/src/components/PreviewPanel/MathRenderer.jsx`
*(Correcting file path from earlier draft — this file lives under
`PreviewPanel/`, not `Catalogue/`.)*
- Add a `readOnly` prop that suppresses the click-to-edit cursor/hover
  affordance used in the teacher catalogue.
- Confirm the existing KaTeX-error fallback badge (`[Math Formula
  Needs Review]`, from the Phase 1 fix) renders identically in
  read-only mode — this must not regress.

#### [NEW] `client/src/components/Student/TestQuestionView.jsx`
- Renders one question via `MathRenderer` (`readOnly`), MCQ options as
  selectable (not editable) lettered choices, `short_answer_numeric`
  and `short_answer_text` both as a plain text input (the UI doesn't
  need to distinguish them visually — the distinction only matters for
  grading, not for how the student answers).
- Next/Previous navigation, in-memory answer state keyed by question
  `id`.
- `sessionStorage` mirroring of in-progress answers.

#### [NEW] `client/src/components/Student/TestReviewScreen.jsx`
- Lists all questions with answered/unanswered status, jump-to-question
  links, explicit "Submit Test" action.

---

### Phase 4: Grading Engine

#### [NEW] `client/src/services/gradingService.js`
- `gradeAttempt(questions, studentAnswers) -> { autoGraded: {score,
  total}, pendingReview: [questionIds], perQuestion: [...] }`.
- MCQ: exact index match.
- `short_answer_numeric` with valid `acceptedRange`: parse student
  input as float, check inclusive range membership. Unparseable input
  → incorrect (not excluded — the question itself is gradable, the
  student just didn't give a valid number).
- `short_answer_numeric` with invalid/missing `acceptedRange`: routed
  to `pendingReview`, same as text.
- `short_answer_text`: always `pendingReview`.
- Bare legacy `short_answer`: always `pendingReview`.
- `autoGraded.total === 0` handled explicitly (no score line
  downstream, not `0/0`/`NaN`).

#### [NEW] `client/src/components/Student/TestResultScreen.jsx`
- Score summary (only if `autoGraded.total > 0`), pending-review
  count/list, per-question breakdown (student answer vs. correct
  answer/range) for auto-graded questions.
- Exam-native styling — no confetti, no gamified giant percentage,
  consistent with `PrintViewModal.jsx`'s restrained tone.

---

### Phase 5: Integration, Edge Cases & Verification

#### [MODIFY] `client/src/App.jsx`
- Wire the full student state machine: Access Gate → Name Capture →
  Intro → Question View → Review → Result.

#### Manual Verification
1. **End-to-end all-MCQ test** — correct score, no review needed.
2. **Mixed MCQ + valid `short_answer_numeric`** — correct combined
   auto-graded score.
3. **`short_answer_numeric` with missing/malformed range** — excluded
   from auto-grading, flagged "Numeric Range Not Set", student can
   still answer it, doesn't appear as right/wrong.
4. **`short_answer_text`** — always pending review regardless of
   student input.
5. **Legacy bare `short_answer`** — flagged "Unclassified Answer
   Type", excluded from auto-grading, doesn't crash the UI.
6. **All-unclassified/text/missing-range test** — completion screen,
   no numeric score, no `NaN`/`0/0`.
7. **KaTeX render error on student view** — same non-technical
   fallback as teacher view, confirmed in `readOnly` mode specifically.
8. **Session recovery** — refresh mid-test, answers restored via
   `sessionStorage`.
9. **Password gate isolation** — teacher password rejected on student
   gate and vice versa.
10. **`QuestionCard` type switcher** — confirm exactly three selectable
    types, numeric range editor appears/disappears correctly on type
    change, and existing legacy-typed questions display their
    "Unclassified" review reason without erroring.

#### Phase Verification & Checkpoint
- Run `npm run build` in `client/`, confirm zero new errors.
- Update `conductor/tracks.md` and `conductor/index.md` per workflow
  rules once this track is committed.

## Notes for Future Passes (Not This Pass)
- Hard publish-blocking on "Numeric Range Not Set" once the
  `publishedExam` snapshot/validation-gate work lands — this pass only
  soft-flags via `needsReview`.
- Teacher-visible results dashboard, server-persisted attempts — both
  explicitly out of scope per `spec.md`.
- A bulk "reclassify all unclassified short-answer questions" tool
  might be worth adding once real question banks accumulate legacy
  data — not scoped here, flagging as a likely future ask given the
  deliberately-breaking migration choice made this pass.
