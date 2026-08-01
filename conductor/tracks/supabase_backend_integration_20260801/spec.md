# Specification: Supabase Backend Integration (`supabase_backend_integration`)

## 1. Overview
Transition the tuition test platform from ephemeral `/tmp/` local file storage and single-password security to a full-stack, cloud-persistent Supabase backend infrastructure. This track introduces Supabase PostgreSQL database persistence, Supabase Auth for teachers, Supabase Storage for cropped diagram images, and a Teacher-Controlled Dynamic Rolling Code system for secure student test access without requiring student accounts.

## 2. Functional Requirements

### 2.1 Supabase Database Persistence
- Create and manage PostgreSQL tables:
  - `teachers`: Stores teacher profiles, preferences, and auth linkage.
  - `exams`: Stores exam metadata, status (`draft`, `published`, `archived`), passing score, time limits, and published question snapshot JSON.
  - `questions`: Stores individual question blocks, MCQ option keys, numerical tolerance ranges `[min, max]`, review status (`needsReview`), and cropped diagram metadata.
  - `submissions`: Stores student test responses, student name, time taken, score breakdown, auto-graded marks, and submission timestamps.
  - `exam_sessions`: Tracks active rolling code sessions, active rolling code hash/passcode, generation timestamp, and expiration interval.

### 2.2 Teacher Authentication & Multi-Tenant Isolation
- Integrate Supabase Auth (`@supabase/supabase-js`) on the backend/frontend for teacher login & registration (Email/Password).
- Apply Row Level Security (RLS) policies on Supabase tables so each teacher can only view, edit, publish, and view submissions for their own exams.

### 2.3 Dynamic Rolling Code Student Access System
- **Teacher Session Control:** Teachers can start an active exam session from the `TeacherDashboard` or `PublishExamModal`.
- **Rolling Passcode:** Generates a dynamic 6-digit rolling code (refreshes automatically or on-demand by the teacher).
- **Student Entry:** Students navigate to the test link, enter their Name + current live Rolling Code.
- **Session Validation:** Server validates the rolling code against active `exam_sessions`. If valid, student receives test payload; if code has rolled/expired or session is ended, access is denied.

### 2.4 Supabase Storage for Diagrams & Attachments
- Create a public Supabase Storage bucket (`diagram-media`).
- Update `diagramCropService.js` to upload cropped PNG buffers directly to Supabase Storage and store public CDN URLs on question records instead of giant base64 strings.

### 2.5 Express Server API Proxy Layer
- Expose secure server endpoints in `server/routes/`:
  - `POST /api/auth/teacher` - Teacher authentication & session token check.
  - `POST /api/exams/save-draft` - Save/update exam draft.
  - `POST /api/exams/publish` - Publish exam & initialize snapshot in Supabase.
  - `POST /api/exams/session/start` - Generate/start rolling code session.
  - `POST /api/exams/student-access` - Validate student rolling code & fetch test payload.
  - `POST /api/submissions/submit` - Grade and record student submission in Supabase.
  - `GET /api/teacher/dashboard` - Fetch teacher's exams, active sessions, and student analytics.

## 3. Non-Functional Requirements & Security
- **Zero API Key Leakage:** Supabase Service Role Keys and Gemini API keys remain strictly on the Express backend (`server/.env`).
- **Serverless Ephemeral Storage Removal:** Replace all `/tmp/` JSON file read/write operations with Supabase client queries.
- **Fail-Soft Error Handling:** Graceful error messages if Supabase connection is lost or network drops.

## 4. Acceptance Criteria
1. Teachers can register and log in via Supabase Auth.
2. Draft exams and published exam snapshots persist across server restarts in Supabase PostgreSQL tables.
3. Cropped diagram images are stored in Supabase Storage buckets and served via public CDN URLs.
4. Teachers can start a test session with a dynamic 6-digit Rolling Code.
5. Students can take and submit tests using their Name + active Rolling Code without creating accounts.
6. Submissions and auto-graded results persist in Supabase and display on the Teacher Analytics Dashboard.
7. `npm test` on server and `npm run build` on client complete with zero errors.

## 5. Out of Scope
- Direct payment gateway integration.
- Student long-term account management (intentionally avoided per user decision).
