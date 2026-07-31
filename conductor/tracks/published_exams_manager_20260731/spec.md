# Specification: Exam History & Published Tests Manager

## 1. Overview
Provide tuition teachers with complete visibility and administrative control over all published exam snapshots. Teachers can view past exams, copy shareable student test URLs at any time, see candidate submission metrics per exam, and toggle exam status (Active vs. Closed/Deactivated) to prevent student access after test deadlines.

## 2. Functional Requirements

### Backend Infrastructure (`server/routes/exams.js`)
- **GET `/api/exams`**: Fetch all published exam snapshots stored in `server/data/exams.json` (or `/tmp/exams.json` serverless fallback). Returns array of exam objects: `{ examId, testTitle, questionCount, createdAt, status ('active' | 'closed'), submissionCount }`.
- **PATCH `/api/exams/:examId/status`**: Toggle exam status (`active` <-> `closed`). Updates storage and returns updated exam status object.
- **GET `/api/exams/:examId` Enforcement**: If an exam's status is `closed`, reject student test load with `{ success: false, isClosed: true, error: 'This exam is closed by the instructor.' }`.

### Teacher Dashboard UI (`SubmissionsDashboardModal.jsx` & `PublishedExamsList.jsx`)
- **Dual Tab Switcher**: "Candidate Submissions" vs. "Published Exams".
- **Published Exams List Panel**:
  - Displays published exam cards with metadata (Test Title, Exam ID, Date, Question Count, Total Student Submissions, and Status Badge).
  - Search / Filter bar for finding past exams by title.
  - **Copy Shareable Student Link** action button (copies `?examId=...&mode=student` to clipboard with a toast notification).
  - **Active / Closed Toggle Switch**: Interactive switch to activate or deactivate student test-taking.

### Student Experience (`App.jsx` & `TestIntroScreen.jsx`)
- When a student opens a link to a closed exam (`?examId=...`), render a friendly "Exam Closed by Instructor" message preventing submission.

## 3. Non-Functional Requirements
- **Performance**: Endpoints respond within <100ms and handle serverless fallback seamlessly.
- **Design Invariants**: Adheres to parchment/cream exam-native aesthetics (`product-guidelines.md`).

## 4. Out of Scope
- Editing question content inside a *published* exam snapshot (published snapshots remain frozen invariants for reproducibility).
