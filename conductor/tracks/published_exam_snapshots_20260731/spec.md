# Specification: Published Exam Snapshots & Shareable Test URLs

## 1. Overview
This track enables teachers to freeze their current question catalogue into a permanent, immutable **Published Exam Snapshot** with a unique ID, and generate a 1-click shareable student link (e.g., `?mode=student&testId=exam_1700000000_abc`). Students accessing the link will take the exact frozen snapshot version of the exam.

## 2. User Stories
- **As a Teacher**: I want to click "Publish Exam" to generate a permanent link that I can send to my students, so future edits to my working catalogue won't affect the test my students are currently taking.
- **As a Student**: When I click a test link sent by my teacher, the system automatically loads the correct exam paper and title without needing manual setup.

## 3. Functional Requirements

### 3.1 Backend API & Storage (`server/routes/exams.js`)
- `POST /api/exams/publish`: Protected endpoint (requires `APP_PASSWORD`).
  - Accepts payload: `{ testTitle, questions }`.
  - Generates immutable snapshot object:
    ```json
    {
      "id": "exam_1700000000_a1b2c3",
      "testTitle": "Physics Midterm Exam 2026",
      "questions": [...],
      "createdAt": "2026-07-31T15:30:00.000Z"
    }
    ```
  - Storage: Saved in `server/data/exams.json` with `/tmp/exams.json` fallback for Vercel serverless environment.
- `GET /api/exams/:id`: Public endpoint.
  - Fetches the frozen exam payload by `id`. Returns `{ success: true, exam: { testTitle, questions } }`. Returns `404` if not found.

### 3.2 Teacher UI: Publish Exam Modal & Copy Link
- Add a **"Publish Exam"** button in `Navbar.jsx` (with a `Share2` or `Send` icon).
- When clicked:
  - Calls `POST /api/exams/publish`.
  - Opens **"Exam Published Successfully" Modal** displaying:
    - Unique Exam ID.
    - Generated Shareable URL (e.g. `http://localhost:3000/?mode=student&testId=exam_1700000000_a1b2c3` or Vercel URL).
    - 1-click **"Copy Student Link"** button with copy-confirmation feedback (`✓ Copied!`).

### 3.3 Student Mode Integration (`App.jsx`)
- When student opens `?mode=student&testId=exam_id`:
  - Automatically fetches the frozen exam questions from `GET /api/exams/:testId`.
  - Displays loading spinner while fetching snapshot.
  - If invalid `testId`, displays a clear exam-native error card: *"Exam paper not found or link has expired."*
  - Student submissions attach `testId` so teacher can trace submissions back to specific published exam versions.

## 4. Non-Functional Requirements
- **Vercel Serverless Compatibility**: File reads/writes fallback to `/tmp/exams.json` in serverless environment.
- **Exam-Native Visual Style**: Paper background `#FAF7F0`, Source Serif 4 typography, zero LaTeX leakage.
