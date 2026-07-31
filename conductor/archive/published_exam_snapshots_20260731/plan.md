# Implementation Plan: Published Exam Snapshots & Shareable Test URLs

This plan details the technical tasks for creating frozen exam snapshots and 1-click shareable URLs for student test-taking.

## Proposed Phases & Tasks

### Phase 1: Backend Exam Snapshot API & Storage
- [x] Task: Create Exams route handler
  - [x] Add `server/routes/exams.js` implementing `POST /api/exams/publish` (protected by `APP_PASSWORD`) and `GET /api/exams/:id` (public).
  - [x] Implement file storage in `server/data/exams.json` with `/tmp/exams.json` fallback for Vercel serverless environment.
  - [x] Mount `examsRoutes` in `server/index.js` and `api/index.js`.
- [x] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify `node -c` syntax on server files.

### Phase 2: Teacher Publish UI & Copy Link Modal
- [x] Task: Add Publish button & modal
  - [x] Add `publishExam(payload)` helper in `client/src/services/apiService.js`.
  - [x] Add `client/src/components/TeacherDashboard/PublishExamModal.jsx` with 1-click copy link action.
  - [x] Add "Publish Exam" button in `Navbar.jsx`.
- [x] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify exam publishing and link copying feedback.

### Phase 3: Student Flow Frozen Exam Integration
- [x] Task: Wire `testId` query param in student flow
  - [x] Add `fetchExamSnapshot(testId)` helper in `client/src/services/apiService.js`.
  - [x] Update `client/src/App.jsx` to parse `?mode=student&testId=...` and fetch frozen exam payload.
  - [x] Include `testId` in student submission payloads.
- [x] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [x] Verify student link opens exact frozen exam snapshot.

### Phase 4: Build, Test & Registry Synchronization
- [x] Task: Comprehensive build check
  - [x] Run `npm --prefix client run build` and confirm zero errors.
- [x] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [x] Mark track completed and update registry.
