# Implementation Plan: Deterministic Document Layout & Diagram Matching Pipeline

## Phase 1: Deterministic Layout Extractor
- [ ] Task: Build `server/services/layoutExtractorService.js` to extract embedded images and non-text graphical bounds from PDF pages (`pdfjs-dist`) and images (`sharp`).
- [ ] Task: Generate candidate figures list `[{ id: "fig_1", pageIndex, dataUrl }]` deterministically.

## Phase 2: Simplified LLM Prompt & Transcription
- [ ] Task: Simplify `SYSTEM_PROMPT` and user prompts in `server/routes/parse.js`: remove LLM bounding-box localization instructions.
- [ ] Task: Focus LLM strictly on question text, math LaTeX, options, and correct answers.

## Phase 3: Spatial Proximity & Semantic Diagram Matcher
- [ ] Task: Build `server/services/diagramMatcherService.js` to match candidate figures to questions via spatial proximity (reading order) and semantic classification.
- [ ] Task: Attach candidate images directly to `q.diagramImages` and `q.diagrams`.

## Phase 4: Pipeline Integration & Verification
- [ ] Task: Wire Stage 1 $\rightarrow$ Stage 2 $\rightarrow$ Stage 3 in `/api/parse-question` in `server/routes/parse.js`.
- [ ] Task: Verify end-to-end diagram rendering across Teacher Catalogue, Student Test View, Print Exports, and Result screens.
- [ ] Task: Run `npm test` and `npm run build` to ensure 100% clean build.
