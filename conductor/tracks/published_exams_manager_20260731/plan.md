# Implementation Plan: Exam History & Published Tests Manager

Provide tuition teachers with complete visibility and administrative control over all published exam snapshots in the Teacher Dashboard.

## Phase 1: Backend Infrastructure & Status Enforcement
- [x] Task: Exam Storage & Listing Endpoint
  - [x] Add `GET /api/exams` route in `server/routes/exams.js` to return all published exam snapshots with calculated submission counts.
  - [x] Support `/tmp` serverless fallback file reading for production environments.
- [x] Task: Status Toggle Endpoint & Student Enforcement
  - [x] Add `PATCH /api/exams/:examId/status` route in `server/routes/exams.js` to update exam status (`active` | `closed`).
  - [x] Update `GET /api/exams/:id` to enforce status checks and reject access if `status === 'closed'`.
  - [x] Update student test-taking container in `App.jsx` to render an "Exam Closed by Instructor" message when an exam is closed.
- [x] Task: Phase Verification & Checkpoint

## Phase 2: Teacher Dashboard UI ("Published Exams" Tab)
- [x] Task: Dashboard Tab Switcher & Published Exams View
  - [x] Add Tab Switcher ("Candidate Submissions" | "Published Exams") inside `SubmissionsDashboardModal.jsx`.
  - [x] Create `PublishedExamsList.jsx` component displaying published exam cards/table with metadata (Title, Exam ID, Date, Questions, Submission Count, Status).
  - [x] Add "Copy Shareable Student Link" action button with feedback toast/tooltip.
  - [x] Add "Active / Closed" status toggle switch calling `PATCH /api/exams/:examId/status`.
- [x] Task: Phase Verification & Checkpoint

## Phase 3: Integration & Final Verification
- [x] Task: Monorepo Integration & Verification
  - [x] Run client production build (`npm run build`).
  - [x] Test end-to-end publishing flow, tab navigation, link copying, and closed test access blocking.
- [x] Task: Phase Verification & Checkpoint

