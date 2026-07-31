# Implementation Plan: Published Exam Snapshots & Shareable Test URLs

This plan details the technical tasks for creating frozen exam snapshots and 1-click shareable URLs for student test-taking.

## Proposed Phases & Tasks

### Phase 1: Backend Exam Snapshot API & Storage
- [ ] Task: Create Exams route handler
  - [ ] Add `server/routes/exams.js` implementing `POST /api/exams/publish` (protected by `APP_PASSWORD`) and `GET /api/exams/:id` (public).
  - [ ] Implement file storage in `server/data/exams.json` with `/tmp/exams.json` fallback for Vercel serverless environment.
  - [ ] Mount `examsRoutes` in `server/index.js` and `api/index.js`.
- [ ] Task: Phase 1 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify `node -c` syntax on server files.

### Phase 2: Teacher Publish UI & Copy Link Modal
- [ ] Task: Add Publish button & modal
  - [ ] Add `publishExam(payload)` helper in `client/src/services/apiService.js`.
  - [ ] Add `client/src/components/TeacherDashboard/PublishExamModal.jsx` with 1-click copy link action.
  - [ ] Add "Publish Exam" button in `Navbar.jsx`.
- [ ] Task: Phase 2 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify exam publishing and link copying feedback.

### Phase 3: Student Flow Frozen Exam Integration
- [ ] Task: Wire `testId` query param in student flow
  - [ ] Add `fetchExamSnapshot(testId)` helper in `client/src/services/apiService.js`.
  - [ ] Update `client/src/App.jsx` to parse `?mode=student&testId=...` and fetch frozen exam payload.
  - [ ] Include `testId` in student submission payloads.
- [ ] Task: Phase 3 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Verify student link opens exact frozen exam snapshot.

### Phase 4: Build, Test & Registry Synchronization
- [ ] Task: Comprehensive build check
  - [ ] Run `npm --prefix client run build` and confirm zero errors.
- [ ] Task: Phase 4 Verification & Checkpoint (Refer to workflow.md)
  - [ ] Mark track completed and update registry.
