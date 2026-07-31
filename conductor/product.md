# Product Definition: Math-Input Pipeline for Online Tuition Tests

## Vision
A full-stack, exam-native web platform that enables non-technical tuition
teachers to quickly create, edit, and review typeset math test questions —
without ever writing or seeing raw LaTeX syntax, and without ever handling
an API key.

## Core Features

### 1. Multi-Input Ingestion Pipeline
- **Messy Text**: Informal English text (e.g. "x squared plus 2x minus 3 =
  0") parsed into typeset math via AI.
- **Photo Upload**: Multi-question textbook page or whiteboard photo,
  transcribed via multimodal AI vision into individual question blocks.
- **Word .docx Upload**: Direct XML extraction of native Microsoft Word
  OMML equations — deterministic, not AI-based, so equations come through
  with zero loss.

All three paths normalize into ONE shared internal schema (see below) so
the rest of the app never needs to know which input method produced a
given question.

### 2. Google-Forms-Style Question Catalogue (Block Editor)
- A stacked list of individual question "blocks," one per question —
  exactly like Google Forms, so there's never a separate "editing mode"
  the teacher has to switch into.
- No top bar, no scrolling between a "source" view and a "preview" view —
  each block IS both the source and the live rendered preview at once.
- After a photo/docx upload produces multiple questions, the app scrolls
  to the first block and shows a review banner if anything needs the
  teacher's attention (see "Review, not confidence scores" below).
- Smart option layout per block: short options (like "12", "x=3") lay out
  as a 2x2 grid; long options (full equations, sentences) stack vertically
  as 4 rows. Pick automatically based on option text length.

### 3. Inline Editing, No Separate Edit Mode
- Click directly on any plain text in a block to edit it in place — same
  as clicking into a Google Forms question title.
- Click on any rendered math formula to open a small floating toolbar
  right above/below that formula (fractions, powers, roots, integrals,
  common symbols) with a live KaTeX preview as they build it. This
  toolbar is visual-only — no text field showing LaTeX or backslashes,
  ever.
- **The correct answer is never auto-selected by AI.** If the source
  input didn't explicitly state which option is correct, the block is
  flagged and the teacher must click to select the correct answer
  themselves before the question counts as "complete." A test tool that
  silently guesses its own answer key is not trustworthy — this is a
  hard rule, not a nice-to-have.

### 4. 2-Type Question Model & Mandatory Range Review Gate
- Questions are strictly classified into 2 types:
  - **Multiple Choice Questions (`mcq`)**: Options array with 0-indexed correct answer key.
  - **Numerical Questions (`short_answer_numeric`)**: Integer or decimal numerical answers ($-\infty$ to $+\infty$) with accepted range `[min, max]`. There are NO free-text subjective questions.
- **AI Answer Range Estimation & Human Confirmation**: AI ingestion parsers solve and estimate numerical answers and suggest `[min, max]` ranges. Every numerical question defaults to unconfirmed (`numericalConfirmed: false`) and is flagged `needsReview: true` until the teacher explicitly checks and confirms the answer range in the editor.
- **Publishing Lock Invariant**: Exams cannot be published or shared until all MCQ keys and numerical ranges are confirmed by the teacher (`needsReview: false`).
- **Review Flag Conditions**: A block is flagged `needsReview` when:
  - MCQ `correctAnswer` is unset or option count is invalid.
  - Numerical `numericalConfirmed` is false or `acceptedRange` is unset/invalid.
  - KaTeX throws a render error on a math span.
  - Question stem is missing or shorter than 3 characters.

### 5. 1-Click PDF Exam Export
- Printable exam-paper layout view, generated from the same question
  blocks used for the online version — one input, two outputs (matches
  the original goal: teacher gets both an online test AND a physical
  copy from the same work).

## Explicitly Out of Scope for This Phase
- No multi-tenant accounts/database login yet — per-teacher password isolation (`APP_PASSWORD` / `STUDENT_PASSWORD`) is enforced.
- Serverless File Persistence: In production serverless deployments (Vercel), submissions and exam snapshots use `/tmp/` file storage fallback. A external cloud database (e.g. Supabase, PostgreSQL, or KV) is out of scope for the current file-storage phase.
- No API key ever touches the browser or the teacher's hands, in any form, at any point — see tech-stack.md for how this is enforced.