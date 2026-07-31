# Implementation Plan: Teacher Results & Submissions Dashboard

This plan details the technical tasks for persisting student test submissions to the backend and building a Teacher Results & Submissions Dashboard for inspecting attempts and manually grading pending text short-answer questions.

## Proposed Phases & Tasks

### Phase 1: Backend Persistence & API Endpoints
- [ ] Task: Create Submissions route handler
  - [ ] Add `server/routes/submissions.js` handling `POST /api/submissions`, `GET /api/submissions`, and `POST /api/submissions/:id/grade`.
  - [ ] Mount routes in `server/index.js` and `api/index.js` (for Vercel serverless compatibility).
  - [ ] Implement file storage in `server/data/submissions.json` with helper functions for read/write/update operations.
  - [ ] Require `APP_PASSWORD` auth header for `GET` and `POST /grade` endpoints.
- [ ] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify `node -c` syntax on server files and test API endpoints via server startup.

### Phase 2: Student Submission Integration
- [ ] Task: Wire student submission payload dispatch
  - [ ] Update `client/src/services/apiService.js` with `submitTestAttempt(payload)`.
  - [ ] Update `client/src/App.jsx` and `TestResultScreen.jsx` to dispatch `submitTestAttempt` upon exam submission.
  - [ ] Add "Submitted to Teacher" status indicator badge on `TestResultScreen.jsx`.
- [ ] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify student submission dispatches payload to `/api/submissions` and persists data.

### Phase 3: Teacher Submissions Dashboard UI
- [ ] Task: Build Teacher Submissions View
  - [ ] Add `client/src/components/TeacherDashboard/SubmissionsDashboardModal.jsx`.
  - [ ] Add Submissions navigation button in `Navbar.jsx` with unreviewed count badge.
  - [ ] Build submissions summary table with filters: All, Needs Review, Completed.
  - [ ] Build candidate submission inspector with itemized answer view, manual grade controls (Mark Correct +1 / Mark Incorrect 0), feedback comments, and "Save & Finalize Grades" CTA.
- [ ] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify manual grading flow, score recalculation, and status update to "Reviewed".

### Phase 4: Verification, Build & Integration
- [ ] Task: Comprehensive test pass
  - [ ] Verify full student submission -> teacher dashboard -> manual grading -> final score update cycle.
  - [ ] Run `npm --prefix client run build` and confirm zero errors.
- [ ] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Synchronize registry and mark track complete.
