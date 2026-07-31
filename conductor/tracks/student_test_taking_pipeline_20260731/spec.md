# Specification: Student Test-Taking Pipeline (Phase 2, Pass 1)

## Overview
This track delivers Phase 2 (Pass 1) of the Student Test-Taking Pipeline. It introduces student access controls, simple query parameter routing (`?mode=student`), an exam-native student test-taking shell, and a client-side grading engine with support for MCQ auto-grading and numerical range checking.

## Functional Requirements

### 1. Access & Routing Foundation
- **Server Environment & Endpoint**:
  - Add `STUDENT_PASSWORD` support in environment configurations (`.env.example` and server config).
  - Add `/api/verify-student-password` route mirroring `/api/verify-password` but evaluating against `STUDENT_PASSWORD`.
  - Isolate authentication checks so student credentials cannot unlock teacher flows and vice versa.
- **Client Routing**:
  - Implement a query parameter switch (`?mode=student`) in `App.jsx` without adding external routing dependencies.
- **Student Access Gate Modal**:
  - Implement `StudentAccessGateModal.jsx` targeting `/api/verify-student-password` and persisting access token under `student_access_password` key in `localStorage` to avoid collision with `app_access_password`.

### 2. Test-Taking Shell
- **Student Name Capture**:
  - `StudentNameCapture.jsx`: Free-text student name input, stored in component and session state.
- **Test Intro Screen**:
  - `TestIntroScreen.jsx`: Displays test title, question count, and a clear "Begin Test" CTA in exam-native visual styling.
- **Read-Only MathRenderer**:
  - Extend `MathRenderer.jsx` with a `readOnly` prop to suppress click-to-edit interactions and hover controls while retaining the KaTeX error badge (`[Math Formula Needs Review]`).
- **Single-Question View**:
  - `TestQuestionView.jsx`: Renders one question at a time using read-only `MathRenderer`.
  - MCQ choices rendered as selectable (non-editable) lettered options.
  - Short-answer / numerical questions rendered with a plain text input.
  - Next and Previous navigation control maintaining answer state in memory keyed by question `id`.
  - Mirror in-progress answers into `sessionStorage` per test session to persist across page refreshes.
- **Pre-Submit Review Screen**:
  - `TestReviewScreen.jsx`: Displays overview of answered vs. unanswered questions with direct jump navigation to any question and an explicit "Submit Test" CTA.

### 3. Grading Engine & Result Screen
- **Core Grading Service**:
  - `client/src/services/gradingService.js`: Pure function `gradeAttempt(questions, studentAnswers) -> { autoGraded: {score, total}, pendingReview: [questionIds], perQuestion: [...] }`.
  - MCQ grading: Exact index match against `correctAnswer`.
  - Numerical Short-Answer grading: Evaluates numeric student input against target numeric range (e.g., checking if parsed float falls within target min-max range or tolerance).
  - Ambiguous short-answers / `correctAnswer === null`: Routed to `pendingReview` and excluded from `autoGraded` denominator.
  - Edge case handling: Explicitly handle `autoGraded.total === 0` downstream without displaying `0/0` or `NaN%`.
- **Result Screen**:
  - `TestResultScreen.jsx`: Renders score summary (if `autoGraded.total > 0`), pending review count, and question-by-question breakdown showing student's answer vs correct answer for auto-graded items.
  - Styled according to `product-guidelines.md` (exam-native, quiet tone, no confetti).

### 4. Integration & Verification
- Seamless conditional rendering switch in `App.jsx`.
- End-to-end testing covering all-MCQ, numerical range, mixed, null-answer, and refresh recovery cases.

## Non-Functional Requirements
- Visual styling must adhere strictly to exam-native guidelines (`#FAF7F0` paper background, `#232323` soft black ink, `#DCD5C4` rules, Source Serif 4 typography).
- Zero raw LaTeX leakage under any condition.
