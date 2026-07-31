# Specification: Teacher Results & Submissions Dashboard

## 1. Overview
This track implements the server-side persistence for student test submissions and builds a dedicated Teacher Results & Submissions Dashboard in the Teacher Portal. It allows teachers to view student test attempts, inspect itemized scorecards, and manually grade text short-answer questions (or unclassified items) to finalize official scores.

## 2. User Stories
- **As a Student**: When I submit my test, my responses and score are saved securely to the server so my teacher can view and evaluate my performance.
- **As a Teacher**: I want to view a central list of all student submissions, filter candidates who need manual grading, inspect detailed student answers, grade text short-answer questions, and finalize official scores.

## 3. Functional Requirements

### 3.1 Backend API & Persistence (`server/routes/submissions.js` or `server/index.js`)
- `POST /api/submissions`: Public endpoint to store a completed student test attempt.
  - Payload schema:
    ```json
    {
      "id": "sub_1700000000_abc123",
      "testTitle": "Mathematics Practice Test",
      "studentName": "Priya Sharma",
      "submittedAt": "2026-07-31T12:00:00.000Z",
      "autoGraded": { "score": 2, "total": 2, "percentage": 100 },
      "pendingCount": 1,
      "status": "pending_review", // "pending_review" | "reviewed"
      "questions": [...],
      "studentAnswers": { "q1": 0, "q2": "3.1", "q3": "Step by step solution..." },
      "manualGrades": { "q3": { "status": "correct", "score": 1, "comment": "Good working!" } },
      "finalScore": { "score": 3, "total": 3, "percentage": 100 }
    }
    ```
  - Storage: Persisted locally in `server/data/submissions.json` (server file fallback with automatic directory creation).
- `GET /api/submissions`: Protected endpoint requiring teacher authorization header (`APP_PASSWORD`). Returns list of all submissions sorted descending by `submittedAt`.
- `POST /api/submissions/:id/grade`: Protected endpoint requiring teacher auth header (`APP_PASSWORD`). Accepts updated `manualGrades` for a submission, recalculates `finalScore`, updates `status` to `"reviewed"`, and saves to storage.

### 3.2 Student Flow Backend Submission
- In `TestReviewScreen.jsx` / `App.jsx`, when a student completes their test, automatically send `POST /api/submissions`.
- Handle offline/fallback mode gracefully if server is unreachable (store local fallback badge on result screen).

### 3.3 Teacher Submissions Dashboard UI
- Add a **"Submissions & Results"** view button in the Teacher Navbar / Header.
- **Access Control**: Opens teacher auth gate if not already authenticated.
- **Submissions List View**:
  - Filter tabs: **All Submissions**, **Needs Review**, **Completed**.
  - Candidate table showing Candidate Name, Test Title, Date/Time, Auto Score, Pending Review Tally, Overall Status badge.
- **Submission Inspection & Manual Grading Modal / Detail Panel**:
  - Displays student candidate details & overall score summary.
  - Itemized list of all questions with student's response.
  - For questions requiring manual review (`short_answer_text` or unclassified), provides action buttons:
    - **Mark Correct (+1)**
    - **Mark Incorrect (0)**
    - Optional feedback comment text input.
  - Live recalculation of Total Final Score.
  - **"Save & Finalize Grades"** CTA button that posts updates to `/api/submissions/:id/grade`.

## 4. Non-Functional Requirements
- **Exam-Native Visual Design**: Paper background `#FAF7F0`, Source Serif 4 headers, crisp status badges (Emerald for Reviewed/Correct, Amber for Pending, Red for Incorrect).
- **Zero LaTeX Exposure**: All math in student responses and question stems must be typeset cleanly via `MathRenderer`.
- **Zero Raw API Key Exposure**: All endpoints use existing environment password isolation (`APP_PASSWORD`).

## 5. Out of Scope
- Multi-teacher accounts / database auth (single teacher `APP_PASSWORD` per tech-stack).
- Email notifications.
