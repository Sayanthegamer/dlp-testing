# Implementation Plan: Chemistry & Math Full-Syllabus Equation Rendering + AI-Cropped Diagram Pipeline

## Phase 1: Equation Rendering (Math, Physics, Chemistry)
- [ ] Task: Add `katex/contrib/mhchem` import and macros (`\nCr`, `\nPr`, `\vhat`) to `client/src/components/PreviewPanel/MathRenderer.jsx`.
- [ ] Task: Extend `SYSTEM_PROMPT` in `server/routes/parse.js` with rules 8–12 (mhchem `\ce{}`, units `\pu{}`, combinatorics `\nCr`, and structural diagram boundary rule).
- [ ] Task: Add `structuralHints` heuristic regex check to `client/src/services/reviewEvaluator.js`.
- [ ] Task: Verify chemistry reactions, nuclear isotopes, physical units, and combinatorics notation render correctly through KaTeX without raw LaTeX leakage.

## Phase 2: Diagram Crop Service & Server Pipeline
- [ ] Task: Add `sharp` and `pdfjs-dist` to `server/package.json` dependencies.
- [ ] Task: Build `server/services/diagramCropService.js` supporting image and PDF page rasterization + bounding box cropping.
- [ ] Task: Wire `attachCroppedDiagrams` into Gemini and Claude parse pipelines in `server/routes/parse.js`.
- [ ] Task: Verify Vercel serverless build compatibility for image/pdf cropping.

## Phase 3: Diagram UI & Review Flag Integration
- [ ] Task: Add `Diagram Needs Review` check to `client/src/services/reviewEvaluator.js`.
- [ ] Task: Build `client/src/components/PreviewPanel/DiagramBlock.jsx`.
- [ ] Task: Mount `DiagramBlock.jsx` with "Confirm Diagram" toggle button in `client/src/components/Catalogue/QuestionCard.jsx`.
- [ ] Task: Mount read-only `DiagramBlock.jsx` in `TestQuestionView.jsx`, `PrintViewModal.jsx`, `TestResultScreen.jsx`, and `ResultPrintModal.jsx`.

## Phase 4: End-to-End Verification & Build Check
- [ ] Task: Verify photo and PDF uploads containing diagrams automatically generate cropped base64 images and trigger review flags.
- [ ] Task: Verify teacher confirmation clears `Diagram Needs Review` badge.
- [ ] Task: Run `npm run build` in `client/` and `npm test` in `server/` to ensure clean build & zero test breakages.
