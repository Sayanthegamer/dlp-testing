# Product Definition: Math-Input Pipeline for Online Tuition Tests

## Vision
A full-stack, exam-native web platform that enables non-technical tuition teachers to quickly create, edit, and review typeset math test questions without ever writing or seeing raw LaTeX syntax.

## Core Features
1. **Multi-Input Ingestion Pipeline**:
   - **Messy Text**: Informal English text parsed into typeset math via AI.
   - **Photo Upload**: Multi-question textbook page or whiteboard photo transcription using multimodal AI vision.
   - **Word .docx Upload**: Direct XML extraction of native Microsoft Word OMML equations with 100% precision.

2. **Google Forms Style Multi-Question Catalogue**:
   - Stacked list of interactive question cards.
   - Auto-refocus to Question #1 with top review alert banner upon upload.
   - Smart options layout (2x2 grid for short options, 4-row stack for long text/equations).

3. **Inline Text Editing & Floating Math Popover**:
   - Teachers click plain text to edit words directly in place.
   - Clicking math formulas opens a floating visual equation toolbar (fractions, powers, roots, integrals, symbols) with live KaTeX preview.

4. **1-Click PDF Exam Export**:
   - Printable exam paper layout view for saving or printing formatted test papers as PDFs.
