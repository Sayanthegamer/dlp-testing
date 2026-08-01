# Implementation Plan: Supabase Backend Integration (`supabase_backend_integration`)

## Phase 1: Database Setup & Supabase Client Initialization
- [x] Task: Install `@supabase/supabase-js` dependency in `server/package.json` and `client/package.json`.
- [x] Task: Add Supabase environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) to `server/.env.example` and `server/.env`.
- [x] Task: Create `server/services/supabaseClient.js` service initialized with service role key for backend DB operations.
- [x] Task: Write SQL migration script / schema file (`server/db/schema.sql`) for PostgreSQL tables: `teachers`, `exams`, `questions`, `submissions`, `exam_sessions`.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 2: Teacher Auth & Multi-Tenant Security
- [x] Task: Implement Supabase Auth routes in `server/routes/auth.js` (signup, login, session check).
- [x] Task: Update `client/src/services/apiService.js` to handle teacher auth tokens and login states.
- [x] Task: Update `client/src/components/Common/AccessGateModal.jsx` and Navbar to integrate Supabase Auth for teachers.
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 3: Supabase Storage Integration for Diagrams
- [ ] Task: Create public `diagram-media` bucket initialization in `server/services/supabaseClient.js`.
- [ ] Task: Update `server/services/diagramCropService.js` to upload cropped PNG buffers to Supabase Storage and return CDN URLs instead of storing local base64 files.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 4: Exam Persistence & Dynamic Rolling Code System
- [ ] Task: Refactor `server/routes/exams.js` to store drafts and published exam snapshots directly in Supabase PostgreSQL tables (replacing `/tmp/` file storage).
- [ ] Task: Implement Rolling Code Session engine in `server/routes/exams.js` (`POST /api/exams/session/start` and `POST /api/exams/student-access`).
- [ ] Task: Update `client/src/components/TeacherDashboard/PublishExamModal.jsx` to allow starting a Rolling Code session and displaying the active 6-digit rolling code.
- [ ] Task: Update `client/src/components/Student/StudentAccessGateModal.jsx` to validate student Name + Rolling Code against backend.
- [ ] Task: Refactor `server/routes/submissions.js` to save auto-graded student submissions to Supabase PostgreSQL.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).

## Phase 5: End-to-End Verification & Build Check
- [ ] Task: Run automated server tests (`npm test` in `server/`) updated for Supabase backend mock/integration.
- [ ] Task: Run production client build (`npm run build` in `client/`) to confirm zero compilation errors.
- [ ] Task: Verify full workflow: Teacher login -> Exam Creation -> Diagram Crop & Supabase Storage upload -> Publish -> Start Rolling Code Session -> Student Name + Rolling Code login -> Submit -> Grade -> Teacher Analytics Dashboard display.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md).
