# Specification: Chemistry & Math Full-Syllabus Equation Rendering + AI-Cropped Diagram Pipeline

## Overview
This track extends the platform's equation rendering capabilities to fully support the JEE Advanced 2026 syllabus across Physics, Chemistry, and Mathematics, and introduces an AI-Cropped Diagram Pipeline.

1. **Part 1: Full-Syllabus Equation Rendering**:
   - Integrated `katex/contrib/mhchem` for chemical reactions, state symbols, ionic charges, coordination compounds, and nuclear isotopes (`\ce{...}`).
   - Units & physical quantities rendering via mhchem (`\pu{...}`).
   - Custom KaTeX macros for permutations & combinations (`\nCr`, `\nPr`) and physics unit vectors (`\vhat`).
   - Extended `SYSTEM_PROMPT` in `server/routes/parse.js` and heuristic fallback rules in `reviewEvaluator.js`.

2. **Part 2: AI-Cropped Diagram Pipeline**:
   - Automatic detection and raster cropping of drawings/diagrams (benzene rings, VSEPR shapes, circuit diagrams, apparatus drawings, graphs) from source images and PDF pages.
   - Server-side image/PDF page cropping using `sharp` and `pdfjs-dist`.
   - New `diagrams`, `diagramImages`, and `diagramsConfirmed` fields on Question objects.
   - Dedicated `DiagramBlock.jsx` component mounted across Teacher Catalogue, Student Test View, Print/PDF Export, and Result screens.
   - Forced `Diagram Needs Review` flag requiring teacher confirmation before exam publishing.

---

## Functional & Technical Requirements

### 1. Equation Rendering & Macros
- `MathRenderer.jsx` imports `katex/contrib/mhchem` and defines macros:
  - `\nCr`: `{}^{#1}\mkern-2mu C_{#2}`
  - `\nPr`: `{}^{#1}\mkern-2mu P_{#2}`
  - `\vhat`: `\hat{\mathbf{#1}}`
- `server/routes/parse.js` `SYSTEM_PROMPT` rules 8–12:
  - Wrap chemical reactions in `<math>\ce{...}</math>`.
  - Wrap isotopes in `<math>\ce{^238_92U}</math>`.
  - Wrap physical quantities with units in `<math>\pu{...}</math>`.
  - Strictly forbid placing structural drawings (benzene rings, circuits, VSEPR 3D shapes) in `<math>` tags — route them to `diagrams`.
- `reviewEvaluator.js`: Heuristic check for structural text leakage (`structuralHints` pattern) triggering review flags.

### 2. Diagram Schema & Crop Service
- Question Schema Addition:
  ```json
  {
    "diagrams": [
      {
        "id": "diag_1",
        "sourceFileIndex": 0,
        "pageIndex": 0,
        "bbox": [0.12, 0.30, 0.35, 0.22],
        "caption": "circuit diagram"
      }
    ],
    "diagramImages": [
      { "id": "diag_1", "dataUrl": "data:image/png;base64,..." }
    ],
    "diagramsConfirmed": false
  }
  ```
- Server Crop Service (`server/services/diagramCropService.js`):
  - `rasterizePdfPage(pdfBase64, pageIndex)` via `pdfjs-dist/legacy/build/pdf.js` and `canvas`.
  - `cropDiagram(sourceBuffer, bbox)` via `sharp`.
  - Wire `attachCroppedDiagrams` into Gemini & Claude parse handlers.
- Component Integration (`DiagramBlock.jsx`):
  - Renders base64 image or fallback card if crop failed.
  - Rendered in `QuestionCard.jsx`, `TestQuestionView.jsx`, `PrintViewModal.jsx`, `TestResultScreen.jsx`, `ResultPrintModal.jsx`.
  - Teacher confirmation toggle in `QuestionCard.jsx` (`Confirm Diagram` button).

---

## Acceptance Criteria
- [ ] Chemical equations (`\ce{H2 + O2 -> 2H2O}`), isotopes (`\ce{^238_92U}`), and units (`\pu{9.8 m/s^2}`) render cleanly in KaTeX without errors.
- [ ] Permutations/combinations macros (`\nCr{n}{r}`, `\nPr{n}{r}`) render with standard sub/superscript notation.
- [ ] AI system prompt explicitly prevents structural/circuit drawings from being converted into plain text LaTeX.
- [ ] Photo and PDF uploads containing diagrams automatically generate cropped base64 `diagramImages`.
- [ ] Questions with unconfirmed diagrams are flagged with `Diagram Needs Review` in `reviewEvaluator.js`.
- [ ] `DiagramBlock.jsx` renders in Teacher Catalogue, Student Test View, Print Export, and Result screens.
- [ ] `QuestionCard.jsx` provides a "Confirm Diagram" toggle button that clears the diagram review flag.
- [ ] Client build (`npm run build`) completes with zero errors.
