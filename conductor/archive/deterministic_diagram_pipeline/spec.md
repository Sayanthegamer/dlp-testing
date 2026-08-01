# Specification: Deterministic Document Layout & Diagram Matching Pipeline

## Overview
This track replaces LLM bounding-box estimation with a 4-stage deterministic document layout and diagram matching pipeline.

### Architectural Stages:
1. **Stage 1: Deterministic Layout & Figure Extraction (Code)**:
   - Uses `pdfjs-dist` / `sharp` to detect and extract embedded images, vector graphics, and distinct non-text graphical bounds from source PDF pages and image uploads.
   - Generates candidate figures `[{ id: "fig_1", pageIndex, bbox, dataUrl }]` deterministically without LLM intervention.

2. **Stage 2: Clean Question Transcription (LLM OCR)**:
   - Gemini / Claude transcribes questions, math formulas, options, and answer keys.
   - Zero bounding box detection or geometry localization required from the LLM.

3. **Stage 3: Spatial & Semantic Diagram Association (Code + LLM Matcher)**:
   - Matches candidate figures to questions using spatial reading-order proximity (vertical layout analysis) or lightweight LLM semantic association ("Which question number does Candidate Figure 1 belong to?").
   - Populates `q.diagrams` and `q.diagramImages` directly with pre-cropped candidate images.

4. **Stage 4: Teacher Verification & Review Gate**:
   - Retains the `Diagram Needs Review` badge and `Confirm Diagram` toggle in the Teacher Catalogue (`QuestionCard.jsx`).

---

## Acceptance Criteria
- [ ] `SYSTEM_PROMPT` in `server/routes/parse.js` is simplified: zero bounding box estimation required from the LLM.
- [ ] `server/services/layoutExtractorService.js` detects and crops candidate figures from PDF pages and image uploads deterministically.
- [ ] `server/services/diagramMatcherService.js` matches candidate figures to their respective questions based on spatial proximity or LLM assignment.
- [ ] Parsed questions render attached diagram images in Teacher Catalogue, Student Test View, Print Exports, and Result Views.
- [ ] Zero `[Diagram Crop Error]` or bad extract area errors occur during parsing.
- [ ] All unit tests pass and `npm run build` completes cleanly.
