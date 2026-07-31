# Implementation Plan: Student Test-Taking Pipeline (Phase 2, Pass 1)

## Phase 1: Access & Routing Foundation
- [ ] Task: Student auth backend
  - [ ] Add `STUDENT_PASSWORD` to `.env.example` and server env handling.
  - [ ] Add `/api/verify-student-password` route (mirrors `/api/verify-password` but checks `STUDENT_PASSWORD`).
  - [ ] Extend server authentication handling to ensure student and teacher credentials remain strictly isolated.
- [ ] Task: Client routing split
  - [ ] Implement query parameter mode switch (`?mode=student`) in `App.jsx` without adding extra router dependencies.
  - [ ] Build `StudentAccessGateModal.jsx` using `/api/verify-student-password` and `student_access_password` localStorage key.
- [ ] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify server password check routes and client access gate isolation.

## Phase 2: Test-Taking Shell
- [ ] Task: Name capture + intro screen
  - [ ] `StudentNameCapture.jsx`: free-text name input, stored in component/session state.
  - [ ] `TestIntroScreen.jsx`: title, question count, "Begin Test" action in exam-native styling.
- [ ] Task: `MathRenderer` read-only mode
  - [ ] Add `readOnly` prop to `MathRenderer.jsx` to render without click-to-edit affordances and hover states.
  - [ ] Confirm KaTeX error fallback badge (`[Math Formula Needs Review]`) renders in read-only mode without latex leakage.
- [ ] Task: Single-question test view
  - [ ] `TestQuestionView.jsx`: renders one question via `MathRenderer` in read-only mode, MCQ options as selectable choices, short-answer as plain text input.
  - [ ] Next/Previous navigation with in-memory answer state keyed by question `id`.
  - [ ] Mirror in-progress answers to `sessionStorage` keyed per test/session.
- [ ] Task: Pre-submit review screen
  - [ ] `TestReviewScreen.jsx`: lists all questions with answered/unanswered status, jump-to navigation, and explicit "Submit Test" action.
- [ ] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify question navigation, answer entry, KaTeX error fallback, and sessionStorage progress recovery.

## Phase 3: Grading Engine
- [ ] Task: Core grading function
  - [ ] `client/src/services/gradingService.js`: pure function `gradeAttempt(questions, studentAnswers) -> { autoGraded: {score, total}, pendingReview: [questionIds], perQuestion: [...] }`.
  - [ ] MCQ grading: exact option index match against `correctAnswer`.
  - [ ] Numerical Short-Answer grading: numeric parsing & target range validation (e.g. `[min, max]`).
  - [ ] Non-numeric short-answers and `correctAnswer === null` questions: routed to `pendingReview`, excluded from `autoGraded` denominator.
  - [ ] Edge case handling: `autoGraded.total === 0` handled explicitly downstream without rendering `0/0` or `NaN%`.
  - [ ] Unit-style manual test cases covering all-MCQ, numerical short-answers, mixed, and `correctAnswer: null` questions.
- [ ] Task: Result screen
  - [ ] `TestResultScreen.jsx`: score summary (only if `autoGraded.total > 0`), pending-review count, per-question breakdown showing student's answer vs correct answer.
  - [ ] Visual styling adhering strictly to exam-native guidelines (quiet tone, no confetti).
- [ ] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify auto-grading accuracy across MCQ, numerical range, and pending review cases.

## Phase 4: Integration, Edge Cases & Verification
- [ ] Task: Wire into `App.jsx`
  - [ ] Conditionally render student flow vs existing teacher catalogue based on mode switch without disturbing teacher routes.
- [ ] Task: Comprehensive manual verification pass
  - [ ] End-to-end testing of all-MCQ, numerical short-answer, mixed, and null-answer tests.
  - [ ] Mid-test refresh verification (`sessionStorage`).
  - [ ] Password isolation check (`APP_PASSWORD` vs `STUDENT_PASSWORD`).
  - [ ] KaTeX error fallback rendering check.
- [ ] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Run client build, verify zero console errors, update `conductor/tracks.md` and registry.
