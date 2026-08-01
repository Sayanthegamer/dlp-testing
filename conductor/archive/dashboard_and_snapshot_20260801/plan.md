# Implementation Plan: Teacher Submissions Dashboard & Published Exam Snapshot Layer

## Phase 1: Backend Data & API Persistence
- [x] Task: Extend `server/routes/exams.js` to support versioned exam publishing and fetching by ID/published status.
- [x] Task: Extend `server/routes/submissions.js` to add `POST /api/submissions/:id/grade` for updating teacher review scores.
- [x] Task: Write unit tests in `server/tests/exams_submissions.test.js` using `vitest` to verify exam publishing, student submission, and teacher review endpoints.

## Phase 2: Published Exam Snapshot Layer (`publishedExam`)
- [x] Task: Add "Publish Exam" modal and action in `client/src/components/TeacherDashboard/PublishExamModal.jsx` / `App.jsx`.
- [x] Task: Update `client/src/services/apiService.js` to publish exam snapshots to `POST /api/exams/publish`.
- [x] Task: Update `client/src/components/Student/StudentAccessGateModal.jsx` and student test flow to load published exam snapshots from `GET /api/exams/:id` instead of live draft state.

## Phase 3: Teacher Submissions & Results Dashboard
- [x] Task: Create `client/src/components/TeacherDashboard/PublishedExamsList.jsx` and `SubmissionsDashboardModal.jsx`.
- [x] Task: Support scoring `short_answer_text` and overriding scores in `SubmissionsDashboardModal.jsx`.
- [x] Task: Add "Submissions" tab to top navigation (`Navbar.jsx`) and view switching in `App.jsx`.

## Phase 4: Verification & Final Polish
- [x] Task: Run end-to-end flow test (Publish Exam -> Student Takes Test -> Teacher Reviews & Scores in Dashboard).
- [x] Task: Run unit tests with `vitest` to ensure clean pass.
