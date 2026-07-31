# Implementation Plan: Exam History & Published Tests Manager

Provide tuition teachers with complete visibility and administrative control over all published exam snapshots in the Teacher Dashboard.

## Phase 1: Backend Infrastructure & Status Enforcement
- [ ] Task: Exam Storage & Listing Endpoint
  - [ ] Add `GET /api/exams` route in `server/routes/exams.js` to return all published exam snapshots with calculated submission counts.
  - [ ] Support `/tmp` serverless fallback file reading for production environments.
- [ ] Task: Status Toggle Endpoint & Student Enforcement
  - [ ] Add `PATCH /api/exams/:examId/status` route in `server/routes/exams.js` to update exam status (`active` | `closed`).
  - [ ] Update `GET /api/exams/:examId` to enforce status checks and reject access if `status === 'closed'`.
  - [ ] Update student test-taking container in `App.jsx` to render an "Exam Closed by Instructor" message when an exam is closed.
- [ ] Task: Phase Verification & Checkpoint

## Phase 2: Teacher Dashboard UI ("Published Exams" Tab)
- [ ] Task: Dashboard Tab Switcher & Published Exams View
  - [ ] Add Tab Switcher ("Candidate Submissions" | "Published Exams") inside `SubmissionsDashboardModal.jsx`.
  - [ ] Create `PublishedExamsList.jsx` component displaying published exam cards/table with metadata (Title, Exam ID, Date, Questions, Submission Count, Status).
  - [ ] Add "Copy Shareable Student Link" action button with feedback toast/tooltip.
  - [ ] Add "Active / Closed" status toggle switch calling `PATCH /api/exams/:examId/status`.
- [ ] Task: Phase Verification & Checkpoint

## Phase 3: Integration & Final Verification
- [ ] Task: Monorepo Integration & Verification
  - [ ] Run client production build (`npm run build`).
  - [ ] Test end-to-end publishing flow, tab navigation, link copying, and closed test access blocking.
- [ ] Task: Phase Verification & Checkpoint
