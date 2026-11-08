# Math Exam & Input Pipeline

An exam-native mathematics and science assessment authoring, OMML/AI typesetting, and proctored student testing platform.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![KaTeX](https://img.shields.io/badge/KaTeX-0.16-007ACC?logo=katex&logoColor=white)](https://katex.org/)

Convert informal math text, photos of printed examination papers, multi-page PDFs, and Microsoft Word (`.docx`) documents into typeset, auto-graded web assessments with candidate authentication and 5-minute TOTP rolling passcodes.

## Core capabilities

### For instructors & authors
- **Multi-source question ingestion**: Import math and science questions from raw text, scanned images, multi-page PDFs (with cover-page detection and worked-solution truncation), or Microsoft Word `.docx` files.
- **Native Word OMML/MathML extraction**: Unpacks `.docx` archives to extract Office Math Markup Language (`<m:oMath>`) expressions and converts them to KaTeX without losing fractions, radicals, superscripts, or integrals.
- **Deterministic figure & diagram matching**: Extracts diagrams, circuit schematics, and geometric figures from uploaded pages and pairs them with their corresponding questions, with interactive bounding-box crop adjustment.
- **Visual math block editor**: Click any rendered `<math>` expression in a question stem, option, or explanation to edit fractions, roots, integrals, Greek symbols, and physical units without raw LaTeX syntax.
- **Exam-native paper layout**: Warm paper surface (`#f7f4ee` / `#fdfbf7`), `Newsreader` editorial serif stems, `Inter` UI controls, and `JetBrains Mono` tabular numerals (`tabular-nums`) for timers, passcodes, and scores.
- **5-minute TOTP rolling passcodes**: Published exams generate auto-refreshing 6-digit passcodes and printable student hall tickets with scannable QR codes.

### For candidates & test takers
- **Candidate portal authentication**: Sign in with Admission Number and Date of Birth (`YYYY-MM-DD`) or scan a hall ticket QR card.
- **6-digit rolling passcode gate**: Enter the active 6-digit classroom passcode to unlock a published exam snapshot.
- **Distraction-free CBT session**: One-question-at-a-time examination interface with question palette navigation, mark-for-review flagging, session persistence across refreshes, and tab-switch proctoring guards.
- **Auto-grading & itemized script review**: Immediate grading for multiple-choice (`mcq`), match-the-following (`match_following`), and numeric tolerance (`short_answer_numeric`) items, plus manual teacher review flags for open-response questions.

## Quick start

1. **Install dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure environment variables**:
   ```bash
   cp server/.env.example server/.env
   ```
   Edit `server/.env`:
   ```env
   PORT=5000
   APP_PASSWORD=dlp_teacher_secret_passcode_2026
   STUDENT_PASSWORD=student123
   JWT_SECRET=antigravity_dlp_secret_key_2026
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite

   # Supabase Database & Storage (Modern API Keys):
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   SUPABASE_SECRET_KEY=your_supabase_secret_key
   ```
   *Note: If `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` are omitted, the backend automatically runs in **Smart Demo Fallback Mode** so you can test text/photo/Word parsing, publishing, 6-digit rolling codes, and grading offline.*

3. **Launch development servers**:
   ```bash
   npm run dev
   ```
   - Web client: `http://localhost:5173`
   - API server: `http://localhost:5000`

## API endpoint reference

### Public & authentication routes
- `GET /api/health` — Server status and active AI provider check.
- `POST /api/auth/login` (alias `POST /api/auth/teacher-login`) — Teacher authentication.
- `POST /api/auth/signup` — Teacher registration with access code.
- `POST /api/student/login` (alias `POST /api/student-auth/login`) — Student login via Admission Number + DOB.
- `POST /api/student/signup` (alias `POST /api/student-auth/signup`) — Student self-registration.

### Exam & submission routes
- `POST /api/exams/publish` — Publish an immutable exam paper snapshot.
- `GET /api/exams` — List published exams (teacher dashboard) with submission counts and active rolling codes.
- `GET /api/exams/:id` — Fetch exam snapshot (requires `x-rolling-code` header or `?code=` query parameter for students).
- `POST /api/exams/student-access` — Validate candidate name and 6-digit rolling code to unlock an exam.
- `POST /api/submissions` — Submit a completed student exam script for grading.
- `GET /api/submissions` — Retrieve submission records.

### AI & document parsing routes (requires teacher auth token or `x-app-password` header)
- `POST /api/parse-question` — Unified text, image/PDF, and `.docx` parsing endpoint with Smart Demo Fallback Mode.
- `POST /api/parse-text`, `POST /api/parse-image`, `POST /api/parse-docx` — Route aliases for `POST /api/parse-question`.

## License & credits

Licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE). Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

UI design system refactored using the [unslop](https://github.com/heydamir/unslop) design methodology by Damir Sokolovsky (`@heydamir`, CC BY 4.0).
