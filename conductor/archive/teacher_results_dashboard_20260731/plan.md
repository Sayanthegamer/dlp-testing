# Implementation Plan: Teacher Results & Submissions Dashboard

This plan details the technical tasks for persisting student test submissions to the backend and building a Teacher Results & Submissions Dashboard for inspecting attempts and manually grading pending text short-answer questions.

## Proposed Phases & Tasks

### Phase 1: Backend Persistence & API Endpoints
- [x] Task: Create Submissions route handler
  - [x] Add `server/routes/submissions.js` handling `POST /api/submissions`, `GET /api/submissions`, and `POST /api/submissions/:id/grade`.
  - [x] Mount routes in `server/index.js` and `api/index.js` (for Vercel serverless compatibility).
  - [x] Implement file storage in `server/data/submissions.json` with helper functions for read/write/update operations.
  - [x] Require `APP_PASSWORD` auth header for `GET` and `POST /grade` endpoints.
- [x] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify `node -c` syntax on server files and test API endpoints via server startup.

### Phase 2: Student Submission Integration
- [x] Task: Wire student submission payload dispatch
  - [x] Update `client/src/services/apiService.js` with `submitStudentTest(payload)`.
  - [x] Update `client/src/App.jsx` and `TestResultScreen.jsx` to dispatch `submitStudentTest` upon exam submission.
  - [x] Add "Submitted to Teacher" status indicator badge on `TestResultScreen.jsx`.
- [x] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify student submission dispatches payload to `/api/submissions` and persists data.

### Phase 3: Teacher Submissions Dashboard UI
- [x] Task: Build Teacher Submissions View
  - [x] Add `client/src/components/TeacherDashboard/SubmissionsDashboardModal.jsx`.
  - [x] Add Submissions navigation button in `Navbar.jsx` with unreviewed count badge.
  - [x] Build submissions summary table with filters: All, Needs Review, Completed.
  - [x] Build candidate submission inspector with itemized answer view, manual grade controls (Mark Correct +1 / Mark Incorrect 0), feedback comments, and "Save & Finalize Grades" CTA.
- [x] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify manual grading flow, score recalculation, and status update to "Reviewed".

### Phase 4: Verification, Build & Integration
- [x] Task: Comprehensive test pass
  - [x] Verify full student submission -> teacher dashboard -> manual grading -> final score update cycle.
  - [x] Run `npm --prefix client run build` and confirm zero errors.
- [x] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [x] Synchronize registry and mark track complete.
