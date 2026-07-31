# Implementation Plan: Student Test-Taking Pipeline (Phase 2, Pass 1)

This plan details the technical steps to build the student test-taking flow, access control, routing split, question-type schema split, and client-side grading engine while strictly adhering to `product-guidelines.md` (exam-native visual styling, quiet tone, zero raw LaTeX leakage).

## Decisions Locked In
- **Routing Strategy**: Query parameter routing (`?mode=student`) switches between the Teacher Catalogue and Student Test-Taking flow in `App.jsx`, no new router dependency.
- **Password Isolation**: Student auth uses `STUDENT_PASSWORD` server-side and `student_access_password` in `localStorage`. Teacher `APP_PASSWORD` cannot unlock student mode and vice versa.
- **Question Type Split**: `short_answer` is replaced by two explicit types — `short_answer_numeric` (auto-gradable via `acceptedRange`) and `short_answer_text` (always routed to pending review, never auto-graded).
- **Numeric Range Ownership**: AI suggests `correctAnswer` + `acceptedRange` at parse time; teacher can view/edit both in `QuestionCard.jsx`. Missing/invalid range → `needsReview`, excluded from auto-grading.
- **Legacy Compatibility (deliberately breaking)**: Old bare `type: "short_answer"` questions are NOT auto-migrated to either new type. They're treated as unclassified, forced into `needsReview`, and require manual teacher reclassification.

## Proposed Changes

### Phase 1: Access & Routing Foundation
- [ ] Task: Student auth backend & route setup
  - [ ] Add `STUDENT_PASSWORD` handling from `process.env` in `server/index.js` and `api/index.js`.
  - [ ] Implement `POST /api/verify-student-password` in both server entrypoints.
  - [ ] Add `STUDENT_PASSWORD=teststudent123` to `.env.example`.
- [ ] Task: Client routing & access gate
  - [ ] Build `client/src/components/Student/StudentAccessGateModal.jsx` targeting `/api/verify-student-password` and `student_access_password` localStorage key.
  - [ ] Modify `client/src/App.jsx` to read `?mode=student` query param and conditionally render student flow vs. teacher catalogue.
- [ ] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify student password authentication and gate isolation.

### Phase 2: Question Type Schema Split
- [ ] Task: AI Parser & Docx normalization updates
  - [ ] Modify `server/routes/parse.js`: Update `SYSTEM_PROMPT` to emit `"mcq" | "short_answer_numeric" | "short_answer_text"` and `acceptedRange: [min, max]`.
  - [ ] Update `extractAndParseJson` to preserve `acceptedRange` without inventing defaults.
  - [ ] Modify `client/src/services/docxParserService.js`: Update non-MCQ fallback/demo data to `short_answer_text`.
- [ ] Task: Review evaluator & QuestionCard editor updates
  - [ ] Modify `client/src/services/reviewEvaluator.js`: Add review rules for `"Numeric Range Not Set"` (missing/invalid `acceptedRange` on numeric type) and `"Unclassified Answer Type"` (legacy bare `short_answer`).
  - [ ] Modify `client/src/components/Catalogue/QuestionCard.jsx`: Update type `<select>` for three explicit options (`mcq`, `short_answer_numeric`, `short_answer_text`) and add center-value + range inputs for `short_answer_numeric`.
- [ ] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify QuestionCard type switcher, range inputs, and review flag evaluator behavior.

### Phase 3: Test-Taking Shell
- [ ] Task: Student intro & name capture
  - [ ] Build `client/src/components/Student/StudentNameCapture.jsx` for free-text student name entry in session state.
  - [ ] Build `client/src/components/Student/TestIntroScreen.jsx` for test title, question count, and "Begin Test" action.
- [ ] Task: Read-only MathRenderer & question view
  - [ ] Modify `client/src/components/PreviewPanel/MathRenderer.jsx`: Add `readOnly` prop suppressing click-to-edit cursor/hover affordance while preserving KaTeX error fallback badge.
  - [ ] Build `client/src/components/Student/TestQuestionView.jsx`: Render single question with read-only MathRenderer, selectable MCQ choices, plain text short-answer input, Next/Previous controls, and `sessionStorage` mirroring.
  - [ ] Build `client/src/components/Student/TestReviewScreen.jsx`: Overview of answered/unanswered questions with jump-to links and explicit "Submit Test" action.
- [ ] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify test navigation, MathRenderer read-only mode, and sessionStorage progress recovery.

### Phase 4: Grading Engine & Result Screen
- [ ] Task: Core grading service
  - [ ] Build `client/src/services/gradingService.js`: Implement `gradeAttempt(questions, studentAnswers)`.
  - [ ] MCQ grading: exact option index match against `correctAnswer`.
  - [ ] `short_answer_numeric`: float parsing and inclusive membership check in `acceptedRange`. Invalid/missing range → `pendingReview`.
  - [ ] `short_answer_text` and legacy bare `short_answer`: route to `pendingReview`.
  - [ ] Edge case handling: `autoGraded.total === 0` handled explicitly without `0/0` or `NaN%`.
- [ ] Task: Result screen
  - [ ] Build `client/src/components/Student/TestResultScreen.jsx`: Score summary (only if `autoGraded.total > 0`), pending review count, per-question breakdown in exam-native styling.
- [ ] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify grading accuracy across MCQ, numerical range, and pending review cases.

### Phase 5: Integration, Edge Cases & Verification
- [ ] Task: Wire full student state machine into `App.jsx`
  - [ ] Connect state machine: Access Gate → Name Capture → Intro → Question View → Review → Result.
- [ ] Task: Comprehensive manual verification pass
  - [ ] All-MCQ test end-to-end check.
  - [ ] Mixed MCQ + `short_answer_numeric` check.
  - [ ] `short_answer_numeric` missing range check.
  - [ ] `short_answer_text` pending review check.
  - [ ] Legacy bare `short_answer` unclassified review flag check.
  - [ ] All-unclassified/text test zero-score check.
  - [ ] KaTeX error fallback in student view check.
  - [ ] Mid-test refresh `sessionStorage` recovery check.
  - [ ] Password gate isolation check (`APP_PASSWORD` vs `STUDENT_PASSWORD`).
  - [ ] `QuestionCard` type switcher check.
- [ ] Task: Phase 5 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Run `npm run build` in `client/`, confirm zero errors, update registry and docs.
