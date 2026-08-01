# Specification: Teacher Submissions Dashboard & Published Exam Snapshot Layer

## Overview
This track implements two core features:
1. **Published Exam Snapshot Layer (`publishedExam`)**: Freezes an exam package when a teacher publishes it, creating an immutable snapshot so students take a fixed exam version even if the teacher subsequently edits the draft in the catalogue.
2. **Teacher Submissions Dashboard**: Adds a dedicated dashboard tab in the Teacher interface allowing teachers to view all student exam attempts, inspect detailed individual scorecards, manually review/score subjective `short_answer_text` questions, and track class performance metrics.

---

## Functional Requirements

### 1. Published Exam Snapshot Layer (`publishedExam`)
- **Publish Action**: Adding a "Publish Exam" button in `Catalogue/ExamList.jsx` or `App.jsx`.
- **Snapshot Creation**:
  - When published, creates a `publishedExam` object with:
    - `id`: Unique exam identifier (e.g. `exam_1710000000000`)
    - `title`: Exam title
    - `version`: Version integer (e.g. `1`)
    - `publishedAt`: ISO timestamp
    - `questions`: Immutable copy of questions array (with types, options, `correctAnswer`, and `acceptedRange`)
- **Server Persistence**: Saved via `POST /api/exams` to `/tmp/exams.json` (Vercel serverless) or `server/data/exams.json` (Express server).
- **Student Exam Fetching**:
  - Student mode (`?mode=student`) loads published exams via `GET /api/exams` instead of reading live editable draft state.

### 2. Teacher Submissions & Results Dashboard
- **Dashboard UI Tab**: Integrated into Teacher top navigation (`Navbar.jsx` / `App.jsx`).
- **Submissions List**:
  - Table displaying: Student Name, Exam Title, Score (percentage + points), Submission Date, Status (`Graded` vs `Needs Review`).
- **Manual Review Modal (`ReviewSubmissionModal.jsx`)**:
  - Displays student responses alongside target solutions.
  - Highlights `short_answer_text` and `needsReview` items for teacher scoring.
  - Allows teacher to approve/override points and submit updated scores via `PATCH /api/submissions/:id`.
- **Class Analytics**:
  - Top summary cards: Total Attempts, Average Score %, Pass Rate, Pending Reviews.

---

## Technical Specifications & Endpoints
- **APIs Used**:
  - `GET /api/exams` & `POST /api/exams`
  - `GET /api/submissions` & `POST /api/submissions`
  - `PATCH /api/submissions/:id` (Updates student score and review status)
- **Data Persistence**:
  - Exams: `server/data/exams.json` (or `/tmp/exams.json`)
  - Submissions: `server/data/submissions.json` (or `/tmp/submissions.json`)

---

## Acceptance Criteria
- [ ] Publishing an exam creates a locked versioned snapshot accessible by students.
- [ ] Editing a question in the teacher editor after publishing does NOT affect in-progress student exams.
- [ ] Student test submissions post directly to `/api/submissions` and are stored on the server.
- [ ] Teacher Dashboard lists all student submissions with status badges (`Graded` / `Needs Review`).
- [ ] Teacher can open a submission modal, manually review free-text math answers, adjust marks, and save changes.
- [ ] Tests pass clean using `vitest` unit tests.
