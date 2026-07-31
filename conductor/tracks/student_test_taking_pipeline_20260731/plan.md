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
- [x] Task: Student auth backend & route setup
  - [x] Add `STUDENT_PASSWORD` handling from `process.env` in `server/index.js` and `api/index.js`.
  - [x] Implement `POST /api/verify-student-password` in both server entrypoints.
  - [x] Add `STUDENT_PASSWORD=your_student_password_here` to `server/.env.example`.
- [x] Task: Client routing & access gate
  - [x] Build `client/src/components/Student/StudentAccessGateModal.jsx` targeting `/api/verify-student-password` and `student_access_password` localStorage key.
  - [x] Modify `client/src/App.jsx` to read `?mode=student` query param and conditionally render student flow vs. teacher catalogue.
- [x] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify student password authentication and gate isolation.

### Phase 2: Question Type Schema Split
- [x] Task: AI Parser & Docx normalization updates
  - [x] Modify `server/routes/parse.js`: Update `SYSTEM_PROMPT` to emit `"mcq" | "short_answer_numeric" | "short_answer_text"` and `acceptedRange: [min, max]`.
  - [x] Update `extractAndParseJson` to preserve `acceptedRange` without inventing defaults.
  - [x] Modify `client/src/services/docxParserService.js`: Update non-MCQ fallback/demo data to `short_answer_text`.
- [x] Task: Review evaluator & QuestionCard editor updates
  - [x] Modify `client/src/services/reviewEvaluator.js`: Add review rules for `"Numeric Range Not Set"` (missing/invalid `acceptedRange` on numeric type) and `"Unclassified Answer Type"` (legacy bare `short_answer`).
  - [x] Modify `client/src/components/Catalogue/QuestionCard.jsx`: Update type `<select>` for three explicit options (`mcq`, `short_answer_numeric`, `short_answer_text`) and add center-value + range inputs for `short_answer_numeric`.
- [x] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify QuestionCard type switcher, range inputs, and review flag evaluator behavior.

### Phase 3: Test-Taking Shell
- [x] Task: Student intro & name capture
  - [x] Build `client/src/components/Student/StudentNameCapture.jsx` for free-text student name entry in session state.
  - [x] Build `client/src/components/Student/TestIntroScreen.jsx` for test title, question count, and "Begin Test" action.
- [x] Task: Read-only MathRenderer & question view
  - [x] Modify `client/src/components/PreviewPanel/MathRenderer.jsx`: Add `readOnly` prop suppressing click-to-edit cursor/hover affordance while preserving KaTeX error fallback badge.
  - [x] Build `client/src/components/Student/TestQuestionView.jsx`: Render single question with read-only MathRenderer, selectable MCQ choices, plain text short-answer input, Next/Previous controls, and `sessionStorage` mirroring.
  - [x] Build `client/src/components/Student/TestReviewScreen.jsx`: Overview of answered/unanswered questions with jump-to links and explicit "Submit Test" action.
- [x] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify test navigation, MathRenderer read-only mode, and sessionStorage progress recovery.

### Phase 4: Grading Engine & Result Screen
- [x] Task: Core grading service
  - [x] Build `client/src/services/gradingService.js`: Implement `gradeAttempt(questions, studentAnswers)`.
  - [x] MCQ grading: exact option index match against `correctAnswer`.
  - [x] `short_answer_numeric`: float parsing and inclusive membership check in `acceptedRange`. Invalid/missing range → `pendingReview`.
  - [x] `short_answer_text` and legacy bare `short_answer`: route to `pendingReview`.
  - [x] Edge case handling: `autoGraded.total === 0` handled explicitly without `0/0` or `NaN%`.
- [x] Task: Result screen
  - [x] Build `client/src/components/Student/TestResultScreen.jsx`: Score summary (only if `autoGraded.total > 0`), pending review count, per-question breakdown in exam-native styling.
- [x] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify grading accuracy across MCQ, numerical range, and pending review cases.

### Phase 5: Integration, Edge Cases & Verification
- [x] Task: Wire full student state machine into `App.jsx`
  - [x] Connect state machine: Access Gate → Name Capture → Intro → Question View → Review → Result.
- [x] Task: Comprehensive manual verification pass
  - [x] All-MCQ test end-to-end check.
  - [x] Mixed MCQ + `short_answer_numeric` check.
  - [x] `short_answer_numeric` missing range check.
  - [x] `short_answer_text` pending review check.
  - [x] Legacy bare `short_answer` unclassified review flag check.
  - [x] All-unclassified/text test zero-score check.
  - [x] KaTeX error fallback in student view check.
  - [x] Mid-test refresh `sessionStorage` recovery check.
  - [x] Password gate isolation check (`APP_PASSWORD` vs `STUDENT_PASSWORD`).
  - [x] `QuestionCard` type switcher check.
- [x] Task: Phase 5 Verification & Checkpoint (Refer to workflow.md)
  - [x] Run `npm run build` in `client/`, confirm zero errors, update registry and docs.
