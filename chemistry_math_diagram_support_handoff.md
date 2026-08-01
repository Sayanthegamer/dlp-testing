# Handoff: Full-Syllabus Equation Rendering + AI-Cropped Diagram Pipeline

**Track name suggestion:** `chemistry_math_diagram_support`
**Repo pattern:** follows this project's existing `conductor/` spec-driven workflow (see `conductor/workflow.md`) — treat this doc as the combined `spec.md` + `plan.md` for a new track, register it in `conductor/tracks.md` when started.

---

## 0. Why this track exists

Current state: `MathRenderer.jsx` uses stock KaTeX only. This renders general algebra/calculus fine but has **zero support** for:
- Chemistry equations (reactions, ionic formulas, equilibria, isotopes)
- Physics unit-value notation
- Combinatorics shorthand actually used in the JEE Advanced syllabus (ⁿCᵣ / ⁿPᵣ)
- Any diagram, structural drawing, or figure — these currently have no representation in the schema at all

This was audited directly against the uploaded **JEE Advanced 2026 syllabus** (Physics, Chemistry, Mathematics sections), not assumed. The scope below reflects what's actually in that syllabus, split into two clearly separated problems that must **not** be conflated:

1. **Equation rendering** — extend KaTeX so it can typeset what the syllabus requires (still text/LaTeX under the hood).
2. **Diagram handling** — a hard boundary rule: anything that is a *drawing* (structural formulas, VSEPR shapes, circuits, graphs, apparatus, mechanism arrows) is **never** attempted as LaTeX. It is cropped as a raster image from the original source (photo or PDF) and embedded, per explicit product direction: *"AI WILL crop and paste the diagrams... and flag every question with diagrams for review."*

---

## Part 1: Equation Rendering — Math, Physics, Chemistry

### 1.1 Syllabus coverage audit (what's already fine vs. what's missing)

**Mathematics — stock KaTeX already covers:**
- Sets/relations, De Morgan's laws (∪ ∩ ⊂ ⊆ ∈ ∉)
- Complex numbers, polar form
- Matrices/determinants up to order 3 (`\begin{pmatrix}`, `\begin{vmatrix}`) — render fine inline, no extension needed
- Limits, derivatives, integrals, ODEs (`\frac{dy}{dx}`), vectors (`\vec{}`, `\overrightarrow{}`, dot/cross products)

**Mathematics — gap:**
- Permutations/combinations shorthand (ⁿCᵣ, ⁿPᵣ) as used in the syllabus's Algebra section — KaTeX only has generic `\binom{n}{r}`, not this notation. **Needs custom macros.**

**Physics — stock KaTeX covers:**
- Kinematics, mechanics, EM (Gauss's law, `\oint` closed-surface integrals), waves, thermodynamics — all standard LaTeX

**Physics — gaps:**
- Units/dimensional analysis (explicitly listed in the syllabus's "General" section) — needs a units-aware macro. **Solved by mhchem's `\pu{}` command** (physical units) — same library added for chemistry, no new dependency.
- Nuclear physics isotope notation (²³⁸₉₂U, decay chains) in the Modern Physics section — **solved by mhchem's isotope syntax**, shared with Chemistry's radioactivity topic.

**Chemistry — mhchem (`\ce{}`) covers:**
- Balanced reactions, state symbols (s)/(l)/(g)/(aq), equilibrium arrows, ionic charges, coordination compound formulas (`[Co(NH3)6]^3+`), isotopes

**Chemistry — real gap, must NOT be forced into `\ce{}`:**
- Organic structural/geometrical isomerism, benzene rings, wedge-dash stereochemistry (R,S/E,Z), VSEPR 3D molecular shapes, reaction mechanism arrow-pushing. These are **drawings**, not text formulas. `\ce{C6H6}` can write the formula but cannot draw the ring. **These route to the diagram pipeline (Part 2), never to `<math>`.**

### 1.2 Code changes

**`client/index.html`** — no change needed (mhchem is a JS module import, not a CDN stylesheet).

**`client/src/components/PreviewPanel/MathRenderer.jsx`** — add mhchem import + macros:

```diff
 import React from 'react';
 import katex from 'katex';
+import 'katex/contrib/mhchem'; // registers \ce{} and \pu{} into the katex module
```

```diff
         try {
           renderedHtml = katex.renderToString(cleanMathContent, {
             displayMode: false,
-            throwOnError: true
+            throwOnError: true,
+            trust: true,
+            macros: {
+              // Math: nCr / nPr shorthand from the Algebra section
+              "\\nCr": "{}^{#1}\\mkern-2mu C_{#2}",
+              "\\nPr": "{}^{#1}\\mkern-2mu P_{#2}",
+              // Physics: quick vector-with-hat shorthand (Mechanics/EM)
+              "\\vhat": "\\hat{\\mathbf{#1}}"
+            }
           });
```

`\ce{...}` and `\pu{...}` now work through the existing render path with zero other changes — a malformed chemistry/unit string still throws and hits the existing amber "Math Formula Needs Review" badge, so the product's zero-LaTeX-exposure rule (`product-guidelines.md`) is preserved automatically.

**`server/routes/parse.js`** — extend `SYSTEM_PROMPT` with subject-aware rules AND the explicit diagram boundary (critical — this is what prevents the AI from trying to typeset a benzene ring):

```diff
 CRITICAL RULES:
 1. <math>...</math> tags are ONLY for mathematical formulas...
 2. Do NOT place plain English text...
 ...
+8. CHEMISTRY EQUATIONS & FORMULAS: wrap in <math>\ce{...}</math> using mhchem syntax — balanced reactions, state symbols (s)/(l)/(g)/(aq), equilibrium arrows (<=>, <=>>), ionic charges (Fe^3+), coordination formulas ([Co(NH3)6]^3+).
+9. NUCLEAR NOTATION (Chemistry radioactivity AND Physics Modern Physics): isotopes as <math>\ce{^238_92U}</math> via mhchem — identical syntax serves both subjects.
+10. PHYSICAL QUANTITIES WITH UNITS (Physics): wrap value+unit pairs in <math>\pu{...}</math>, e.g. <math>\pu{9.8 m/s^2}</math>, <math>\pu{6.63e-34 J s}</math>.
+11. PERMUTATIONS/COMBINATIONS (Math Algebra): use <math>\nCr{n}{r}</math> / <math>\nPr{n}{r}</math> custom macros, not raw \binom.
+12. STRUCTURAL/GEOMETRIC CONTENT — NEVER put these in <math> tags, even though they look chemistry/physics-related: benzene rings and other skeletal structures, wedge-dash stereochemistry, VSEPR 3D molecular shapes, reaction mechanism arrows, orbital shape diagrams (s/p/d), circuit diagrams, apparatus drawings, graphs/plots. These belong in the "diagrams" array (see Part 2) as a bounding box on the source image — never as attempted LaTeX/mhchem text.
```

**`client/src/services/reviewEvaluator.js`** — heuristic safety net (catches cases where the AI mistakenly typesets structural content as text instead of routing it to diagrams, so it doesn't silently render garbage):

```diff
   if (katexHasError) {
     reasons.push('Math Formula Syntax Error');
   }
+
+  const structuralHints = /benzene ring|skeletal structure|wedge.?dash|orbital diagram|circuit diagram/i;
+  if (structuralHints.test(fullTextToTest)) {
+    reasons.push('Possible Structural Diagram — Verify Not Misrendered as Text');
+  }
```

---

## Part 2: AI-Cropped Diagram Pipeline

**Product decision locked in:** fully automatic crop-and-place from both photo uploads and PDF pages equally, with every question containing a diagram forced into the existing `needsReview`-style flag for teacher confirmation (same pattern as `numericalConfirmed`) — **not** a manual bounding-box-drawing UI.

### 2.1 Schema addition

```js
// question object gains two new optional fields
{
  ...
  diagrams: [
    {
      id: "diag_1",
      sourceFileIndex: 0,              // which uploaded file (image or PDF) this came from
      pageIndex: 0,                    // PDF page number; 0 for plain images
      bbox: [0.12, 0.30, 0.35, 0.22],  // [x, y, width, height], normalized 0–1
      caption: "circuit diagram"
    }
  ],
  diagramImages: [
    { id: "diag_1", dataUrl: "data:image/png;base64,..." }
  ],
  diagramsConfirmed: false            // mirrors the numericalConfirmed pattern
}
```

### 2.2 Dependencies

**`server/package.json`**:
```diff
   "dependencies": {
     "@anthropic-ai/sdk": "^0.36.0",
     "@google/generative-ai": "^0.21.0",
     "cors": "^2.8.5",
     "dotenv": "^16.4.5",
     "express": "^4.19.2",
-    "mathjs": "^15.2.0"
+    "mathjs": "^15.2.0",
+    "sharp": "^0.33.5",
+    "pdfjs-dist": "^4.0.379"
   },
```

`sharp` does pixel cropping for both images and rasterized PDF pages. `pdfjs-dist` (legacy Node build) rasterizes a specific PDF page to a PNG first, so PDFs and photos converge onto the exact same crop code path — this is what makes "both input paths equally" tractable without duplicate logic.

> ⚠️ Deployment note for Antigravity: `pdfjs-dist` + the `canvas` npm package (needed for Node-side rendering) require a native binary. This is a known pain point on Vercel serverless — if the build fails there, fall back to `pdf-to-img` or a prebuilt canvas binary. Flag this risk explicitly during implementation, don't silently swap libraries.

### 2.3 New server service — `server/services/diagramCropService.js`

```js
const sharp = require('sharp');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function rasterizePdfPage(pdfBase64, pageIndex) {
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1); // pdfjs is 1-indexed
  const viewport = page.getViewport({ scale: 2.0 }); // 2x for crop quality

  const { createCanvas } = require('canvas');
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer('image/png');
}

async function cropDiagram(sourceBuffer, bbox) {
  const [x, y, w, h] = bbox;
  const meta = await sharp(sourceBuffer).metadata();
  const left = Math.max(0, Math.round(x * meta.width));
  const top = Math.max(0, Math.round(y * meta.height));
  const width = Math.min(meta.width - left, Math.round(w * meta.width));
  const height = Math.min(meta.height - top, Math.round(h * meta.height));

  const cropped = await sharp(sourceBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return `data:image/png;base64,${cropped.toString('base64')}`;
}

/**
 * mediaFiles: original array of { data (base64), mimeType } sent by the client.
 * questions: parsed questions array, each optionally carrying a `diagrams` field.
 */
async function attachCroppedDiagrams(questions, mediaFiles) {
  for (const q of questions) {
    if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) continue;

    const diagramImages = [];
    for (const d of q.diagrams) {
      const file = mediaFiles[d.sourceFileIndex];
      if (!file) continue;

      try {
        let sourceBuffer;
        if (file.mimeType === 'application/pdf') {
          sourceBuffer = await rasterizePdfPage(file.data, d.pageIndex || 0);
        } else {
          sourceBuffer = Buffer.from(file.data, 'base64');
        }
        const dataUrl = await cropDiagram(sourceBuffer, d.bbox);
        diagramImages.push({ id: d.id, dataUrl });
      } catch (err) {
        console.warn(`[Diagram Crop Warning] Failed for ${d.id}:`, err.message);
        // Fail soft: question keeps diagrams[] entry with no image;
        // reviewEvaluator flags it as needing manual re-attach.
      }
    }
    q.diagramImages = diagramImages;
    q.diagramsConfirmed = false; // always forces a review pass
  }
  return questions;
}

module.exports = { attachCroppedDiagrams, cropDiagram, rasterizePdfPage };
```

Wire into `server/routes/parse.js` after both `parseWithGemini` and `parseWithClaude` produce `parsedData`:

```diff
+const { attachCroppedDiagrams } = require('../services/diagramCropService');
+parsedData.questions = await attachCroppedDiagrams(parsedData.questions, mediaFiles || []);
 return parsedData;
```

### 2.4 Review flag — `client/src/services/reviewEvaluator.js`

```diff
   // Rule 3: Question stem content check
   const stem = (question.questionText || '').trim();
   if (!stem || stem.length < 3) {
     reasons.push('Empty or Very Short Question Stem');
   }
+
+  // AI-cropped diagrams always require teacher confirmation
+  if (Array.isArray(question.diagrams) && question.diagrams.length > 0 && !question.diagramsConfirmed) {
+    reasons.push('Diagram Needs Review');
+  }
```

### 2.5 New component — `client/src/components/PreviewPanel/DiagramBlock.jsx`

Deliberately dumb — no editing, no redraw, no crop-box adjustment. Just displays the cropped image or a failure state.

```jsx
import React from 'react';
import { ImageOff } from 'lucide-react';

export default function DiagramBlock({ diagrams = [], diagramImages = [] }) {
  if (!diagrams.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {diagrams.map((d) => {
        const img = diagramImages.find((i) => i.id === d.id);
        return (
          <div key={d.id} className="border border-[#e2dacd] rounded-xl p-2 bg-white inline-block">
            {img ? (
              <img src={img.dataUrl} alt={d.caption || 'Diagram'} className="max-w-full max-h-64 rounded-lg" />
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 p-3">
                <ImageOff className="w-4 h-4" />
                <span>Diagram crop failed — needs manual re-attach</span>
              </div>
            )}
            {d.caption && <p className="text-[11px] text-[#736c62] mt-1 px-1">{d.caption}</p>}
          </div>
        );
      })}
    </div>
  );
}
```

Mount points (all follow the existing pattern of sitting beside `MathRenderer` for the question stem):
- `client/src/components/Catalogue/QuestionCard.jsx` — right after the question stem block, plus a "Confirm Diagram" toggle button next to the badge, matching the `numericalConfirmed` button already in this file.
- `client/src/components/Student/TestQuestionView.jsx`
- `client/src/components/Common/PrintViewModal.jsx`
- `client/src/components/Student/TestResultScreen.jsx` / `ResultPrintModal.jsx`

---

## Part 3: The hard boundary rule (do not skip this)

This is the single most important constraint for whoever implements this: **the AI must never attempt to render a diagram as LaTeX/mhchem, and must never attempt to redraw/regenerate a diagram as an image.** The only allowed diagram path is: detect bounding box on the *original* source pixels → crop those exact pixels → embed. This applies to:

- Organic chemistry: benzene rings, skeletal structures, wedge-dash stereochemistry
- Chemistry: VSEPR 3D molecular shapes, orbital shape diagrams (s/p/d), reaction mechanism arrow-pushing
- Physics: circuit diagrams, apparatus drawings (the syllabus's practical/experiments section is full of these), graphs/plots
- Anything with hand-drawn or textbook-drawn geometry

If `SYSTEM_PROMPT` rule 12 (Part 1) and the `structuralHints` heuristic (Part 1) are ever removed or weakened, expect silent garbage rendering of exactly the content that most needs to look correct (organic structures, VSEPR shapes) — this is the failure mode to guard against in review/testing.

---

## Implementation plan (conductor-style phases)

### Phase 1: Equation Rendering
- [ ] Add `mhchem` import to `MathRenderer.jsx`, add macros (`\nCr`, `\nPr`, `\vhat`)
- [ ] Extend `SYSTEM_PROMPT` in `server/routes/parse.js` with rules 8–12 above
- [ ] Add `structuralHints` heuristic to `reviewEvaluator.js`
- [ ] Verify: chemistry equation, unit-value pair, ⁿCᵣ notation, and isotope notation all render correctly through existing KaTeX error-fallback path
- [ ] Verify: zero raw LaTeX/backslash ever surfaces to the teacher on render failure (existing amber badge still fires)

### Phase 2: Diagram Schema & Crop Service
- [ ] Add `sharp` + `pdfjs-dist` (+ `canvas`) to `server/package.json`
- [ ] Build `server/services/diagramCropService.js` (rasterize PDF page, crop, base64-embed)
- [ ] Wire `attachCroppedDiagrams` into both Gemini and Claude parse paths in `parse.js`
- [ ] Extend `SYSTEM_PROMPT` with the `diagrams` bbox-array output format
- [ ] Verify Vercel serverless build compatibility for `canvas`/`pdfjs-dist` — resolve native-binary risk before merging

### Phase 3: Review Flag & UI
- [ ] Add `Diagram Needs Review` rule to `reviewEvaluator.js`
- [ ] Build `DiagramBlock.jsx`
- [ ] Mount `DiagramBlock` in `QuestionCard.jsx` with a "Confirm Diagram" toggle (mirrors `numericalConfirmed` button)
- [ ] Mount `DiagramBlock` (read-only, no confirm button) in `TestQuestionView.jsx`, `PrintViewModal.jsx`, `TestResultScreen.jsx`, `ResultPrintModal.jsx`

### Phase 4: Verification
- [ ] End-to-end test: photo upload with a circuit diagram → question created with `diagrams[]` + cropped `diagramImages[]` → flagged `needsReview` → teacher confirms → clears
- [ ] End-to-end test: same for a PDF page containing a benzene ring structure
- [ ] Confirm no `<math>` span ever contains structural/diagram content (spot-check against `structuralHints` heuristic firing correctly)
- [ ] Confirm chemistry equation, physics unit, and combinatorics macros all render across teacher catalogue, student test view, print view, and result view consistently
- [ ] Run `npm run build` in `client/`, confirm zero errors

## Out of scope (explicitly, per product decision)
- Manual bounding-box drawing/adjustment UI — automatic crop only, teacher can only confirm, not resize
- AI-redrawn/vectorized diagrams — always raster crop from source, never regenerated
- OCR'd text extraction *from* diagrams (e.g. reading labels inside a circuit diagram) — diagrams are opaque images once cropped
