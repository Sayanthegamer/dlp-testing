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

### 4. Review, Not Confidence Scores
- A question block is flagged `needsReview` based on concrete, checkable
  conditions — not an AI-reported confidence number (self-reported model
  confidence isn't reliable enough to build UI around). Flag when:
  - `correctAnswer` is missing/unset
  - An MCQ block has fewer than 2 options, or option count looks wrong
  - KaTeX itself throws a render error on a math span (this is a real,
    concrete signal — trust it over anything the model says about itself)
  - OCR/vision transcription returned very short or empty text for a
    question that should have content
- Flagged blocks get a soft amber highlight and float to the top of the
  list until resolved. Nothing else about "AI confidence" is surfaced to
  the teacher — it would just be noise they can't act on.

### 5. 1-Click PDF Exam Export
- Printable exam-paper layout view, generated from the same question
  blocks used for the online version — one input, two outputs (matches
  the original goal: teacher gets both an online test AND a physical
  copy from the same work).

## Explicitly Out of Scope for This Phase
- No multi-tenant accounts/database login yet — per-teacher password isolation (`APP_PASSWORD` / `STUDENT_PASSWORD`) is enforced.
- Serverless File Persistence: In production serverless deployments (Vercel), submissions and exam snapshots use `/tmp/` file storage fallback. A external cloud database (e.g. Supabase, PostgreSQL, or KV) is out of scope for the current file-storage phase.
- No API key ever touches the browser or the teacher's hands, in any form, at any point — see tech-stack.md for how this is enforced.