const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  stripBase64Header,
  getPdfJsLib,
  rasterizePdfPage,
  extractEmbeddedJpegsFromPdf,
  countPdfPagesPureJs,
  isRasterImageBuffer,
} = require('../services/diagramCropService');
const { extractCandidateFigures } = require('../services/layoutExtractorService');
const { matchDiagramsToQuestions } = require('../services/diagramMatcherService');
const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');

const MAX_CONCURRENT_CHUNKS = 2;
const CHUNK_TIMEOUT_MS = parseInt(process.env.PARSE_CHUNK_TIMEOUT_MS, 10) || 25000;
const MAX_TRANSIENT_RETRIES = parseInt(process.env.PARSE_MAX_TRANSIENT_RETRIES, 10) || 2;
const TRANSIENT_RETRY_BASE_MS =
  parseInt(process.env.PARSE_TRANSIENT_RETRY_BASE_MS, 10) ||
  (process.env.NODE_ENV === 'test' ? 15 : 1200);

function isTransientProviderError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if ([429, 502, 503, 504].includes(status)) return true;
  const msg = String(err.message || err || '');
  return /(?:\b503\b|\b429\b|\b502\b|\b504\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|rate limit|too many requests|timed out|ECONNRESET|ETIMEDOUT|fetch failed)/i.test(
    msg
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label = 'AI provider request') {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Executes async worker tasks with bounded concurrency (`limit` workers at a time)
 * and returns an array of settled results `{ status: 'fulfilled' | 'rejected', value?, reason? }`.
 */
async function mapWithConcurrencySettled(items, limit, workerFn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIdx = nextIndex++;
      try {
        const value = await workerFn(items[currentIdx], currentIdx);
        results[currentIdx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIdx] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

const SYSTEM_PROMPT = `You are an expert math and science test paper parser for tuition teachers.
Your task is to parse input (informal text, photo of exam paper, handwritten question notebook, or multi-page PDF) representing exam questions and convert them into strict JSON adhering to this exact schema format:

{
  "testTitle": "Mathematics Test Paper",
  "questions": [
    {
      "id": "q1",
      "questionText": "Solve for <math>x</math>: <math>x^2 + 2x - 3 = 0</math>",
      "type": "mcq",
      "options": ["<math>x = 1, -3</math>", "<math>x = -1, 3</math>", "<math>x = 2, -3</math>", "<math>x = -2, 1</math>"],
      "correctAnswer": 0,
      "confidenceScore": 0.95
    },
    {
      "id": "q2",
      "questionText": "Calculate the equivalent resistance across terminals A and B in the circuit.",
      "type": "short_answer_numeric",
      "options": [],
      "correctAnswer": 15,
      "acceptedRange": [14.85, 15.15],
      "diagrams": [
        {
          "id": "diag_1",
          "sourceFileIndex": 0,
          "pageIndex": 0,
          "bbox": [0.20, 0.15, 0.50, 0.85],
          "caption": "Resistor Bridge Circuit Diagram"
        }
      ],
      "confidenceScore": 0.92
    }
  ]
}

CRITICAL RULES:
1. EXTRACT ALL EXAM QUESTIONS COMPLETELY (NEVER TRUNCATE STEMS):
   - Extract every numbered exam question completely from its opening word ("Let...", "If...", "Consider...", "For...") all the way through its final prompt clause ("...then ... is equal to", "...has", "...lie in the interval").
   - HANDWRITTEN NOTEBOOKS WITH INLINE SCRATCH WORK: In handwritten test notebooks, students or teachers frequently write small intermediate scratch calculations, numeric substitutions (e.g. "alpha = 2, beta = 1", "3^4 * 1/(8^3 * 3^2)", "A * adj(A) = |A| |A|^2"), or tick marks right between the lines of a question or beside the options. NEVER stop or truncate a question stem when you hit an inline scratch calculation—read past the scratch annotation to capture the full question sentence and its options, while excluding the scratch calculation itself from questionText.
   - CROSS-PAGE SPLIT QUESTIONS:
     * If a numbered question at the very bottom of a page is cut off mid-sentence (for example, ending with "Let A be a square matrix such that AA^T = I. Then" at the bottom of the page), still extract that partial numbered question as the last item in "questions".
     * Conversely, if the very top of a page begins with an unnumbered continuation of a question from the previous page (for example, starting directly with a formula like "\\frac{1}{2} A [(A + A^T)^2 + (A - A^T)^2] is equal to" followed by options (a), (b), (c), (d)), YOU MUST EXTRACT that top continuation as the FIRST item in "questions" with "id": "page_continuation" and "isContinuation": true.
2. NO LITERAL "\\n" IN STRINGS: Do not put literal "\\n" line breaks inside JSON string values. Use clean space separators.
3. MATH TAG BOUNDARIES: Wrap mathematical formulas, equations, variables, chemical notation, physical units, matrices, determinants, and math symbols in <math>...</math> tags (e.g. <math>x^2 + 2x - 3 = 0</math>, <math>\\frac{a}{b}</math>, <math>A = \\begin{bmatrix} 1 & 2 \\\\ 0 & 1 \\end{bmatrix}</math>).
   - Every <math> tag MUST have a matching closing </math> tag immediately after that formula before plain English words resume.
   - NEVER put plain English sentences, problem instructions, question numbers ("Question 1"), or option letters ("(a)") inside <math> tags.
   - NEVER put LaTeX backslashes in plain English text outside <math> tags (write "High resistance in parallel" and "Gamma rays", NEVER "High resistance \\in parallel" or "\\Gamma rays").
4. LATEX BACKSLASHES, MATRICES & DETERMINANTS:
   - Inside <math>...</math>, use standard LaTeX commands (\\frac{num}{den}, \\sqrt{x}, \\pi, \\alpha, \\beta, \\gamma, \\lambda, \\mu, \\times, \\Omega, \\det, \\text{adj}).
   - For matrices, determinants, and column vectors, use <math>\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}</math>, <math>\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}</math>, or <math>\\begin{pmatrix} a \\\\ b \\end{pmatrix}</math>. ALWAYS separate matrix/determinant rows with a double-backslash followed by a space (\\\\ ) so row breaks are never merged with the first token of the next row.
   - Do not double-escape regular command names (write \\frac and \\text, not \\\\frac or \\\\text).
   - NEVER put math-mode symbols like \\Omega, \\mu, ^, or _ inside \\text{...}. Instead write <math>P = 10\\,\\Omega</math> or <math>\\pu{20 \\Omega}</math>.
5. BRACE DISCIPLINE: Always enclose multi-character superscripts/subscripts in curly braces (<math>x^{10}</math>, <math>A^{13}</math>, <math>2A_{10} - A_8</math>), and ALWAYS use explicit curly braces around BOTH numerator and denominator (<math>\\frac{N_p}{N_s}</math>) and radicals (<math>\\sqrt{2}</math>).
6. FUNCTIONS & SYMBOLS: Precede standard function names with a backslash (\\sin, \\cos, \\tan, \\cot, \\sec, \\csc, \\log, \\ln, \\lim, \\max, \\min, \\det, \\deg), and write matrix adjoint as \\text{adj}.
7. CHEMISTRY & REACTION NOTATION: Wrap chemical formulas, balanced reactions, state symbols, ionic charges, and nuclear isotopes in <math>\\ce{...}</math> using mhchem syntax.
8. PHYSICAL QUANTITIES WITH UNITS: Wrap value+unit pairs in <math>\\pu{...}</math> or use math-mode units (e.g. <math>9.8\\,\\mathrm{m/s^2}</math>, <math>20\\,\\Omega</math>).
9. PERMUTATIONS & COMBINATIONS: Use custom macros <math>\\nCr{n}{r}</math> and <math>\\nPr{n}{r}</math>.
10. QUESTION TYPES & OPTIONS:
   - For MCQ: set "type": "mcq", and put each option's text into the "options" array (WITHOUT the leading "(a)", "(b)", "(c)", "(d)" labels, and NEVER leave the options appended inside "questionText"). If all 4 options (a)-(d) are visible, include all 4; if a handwritten question only has 2 or 3 options written on the page (e.g. only (a) and (b) are written), include all visible options in "options". Set "correctAnswer" as the 0-indexed integer (0 for A, 1 for B, 2 for C, 3 for D) if marked/ticked on the sheet or explicitly known; otherwise set null.
   - For Numerical (single numerical value answer, e.g. a boxed number like [7] with no (a)/(b) options): set "type": "short_answer_numeric", "options": [], and provide the numeric float/integer "correctAnswer" and "acceptedRange": [min, max].
   - Match the Following: set "type": "match_following" with combination choices in "options".
11. DIAGRAMS: Bounding boxes for genuine visual diagrams/circuits/graphs belong in the "diagrams" array as normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 on sourceFileIndex. Do NOT treat matrices, determinants, or handwritten equations as diagrams.
12. SUBPARTS DISAGGREGATION: Extract multi-part sub-questions into DISTINCT individual question objects in the "questions" array.
13. ABSOLUTELY NO FAKE XML TAGS: <math>...</math> is the ONLY allowed XML tag format.
14. ABSOLUTELY NO RAW MATHML TAGS: Always output standard KaTeX LaTeX inside <math>...</math> tags.
15. HARD STOP ON DEDICATED ANSWERS AND SOLUTIONS SECTION: Stop extracting questions only if you reach a dedicated final section titled "ANSWERS AND SOLUTIONS", "HINTS & SOLUTIONS", or "ANSWER KEY".
16. OUTPUT FORMAT: Return ONLY valid JSON matching the schema. Do NOT wrap in markdown code blocks.`;

const DIAGRAM_PROMPT_INSTRUCTION = `CRITICAL DIAGRAM INSTRUCTION: IF and ONLY IF a question contains a visual diagram, circuit, figure, graph, organic structure, or apparatus drawing in the source image (NOT a mathematical matrix or determinant), YOU MUST INCLUDE a "diagrams" array for that question containing {"id": "diag_1", "sourceFileIndex": 0, "pageIndex": 0, "bbox": [ymin, xmin, ymax, xmax], "caption": "description"}, where bbox contains 4 normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 tightly bounding the diagram area and labels on sourceFileIndex. DO NOT output diagrams array for text/matrix-only questions without visual figures.`;

function isKeyValid(key) {
  return typeof key === 'string' && key.trim().length > 5 && !key.includes('your_');
}

/**
 * Deterministic Smart Demo Fallback Parser when no AI API keys are configured.
 */
function buildSmartFallbackCatalogue({ type, rawText, docxStructure, candidateFigures }) {
  if (type === 'docx_structure' && docxStructure) {
    const rawQuestions = Array.isArray(docxStructure.questions)
      ? docxStructure.questions
      : [docxStructure];
    return extractAndParseJson(
      JSON.stringify({
        testTitle: docxStructure.testTitle || 'Word OMML Examination Paper',
        questions: rawQuestions,
      })
    );
  }

  if (type === 'text' && typeof rawText === 'string' && rawText.trim()) {
    const text = rawText.trim();
    const convertInformalMath = (s) => {
      let out = s
        .replace(/\bx\s+squared\b/gi, '<math>x^2</math>')
        .replace(/\by\s+squared\b/gi, '<math>y^2</math>')
        .replace(/\bx\s+cubed\b/gi, '<math>x^3</math>')
        .replace(/\bplus\b/gi, '+')
        .replace(/\bminus\b/gi, '-')
        .replace(/integral\s+of\s+([^\s]+)\s*dx\s+from\s+(\d+)\s+to\s+(\d+)/gi, '<math>\\int_{$2}^{$3} $1 \\, dx</math>')
        .replace(/\bsqrt\(([^)]+)\)/gi, '<math>\\sqrt{$1}</math>');

      if (!out.includes('<math>')) {
        out = out.replace(/([x-z]\^\d+(?:\s*[\+\-]\s*\d*[x-z]?)+(?:\s*=\s*[\-\d]+)?)/gi, '<math>$1</math>');
      }
      return out;
    };

    const optMatch = text.split(/Options?\s*:/i);
    const stemRaw = optMatch[0].replace(/Correct\s+answer.*$/i, '').trim();
    const restText = optMatch[1] || '';

    const options = [];
    const optRegex = /[A-D1-4][\)\.]\s*([^A-D1-4\)\.]+?)(?=(?:\s+[A-D1-4][\)\.]|\s*Correct\s+answer|$))/gi;
    let m;
    while ((m = optRegex.exec(restText)) !== null) {
      const cleanedOpt = m[1].replace(/\.\s*$/, '').trim();
      options.push(cleanedOpt.includes('<math>') ? cleanedOpt : `<math>${cleanedOpt}</math>`);
    }

    let correctAnswer = null;
    const ansMatch = text.match(/Correct\s+answer(?:\s+is)?\s*[:=]?\s*([A-D0-3])/i);
    if (ansMatch) {
      const map = { a: 0, b: 1, c: 2, d: 3, '0': 0, '1': 1, '2': 2, '3': 3 };
      correctAnswer = map[ansMatch[1].toLowerCase()] ?? null;
    }

    const qType = options.length >= 2 ? 'mcq' : 'short_answer_numeric';
    return extractAndParseJson(
      JSON.stringify({
        testTitle: 'Mathematics Assessment Paper',
        questions: [
          {
            id: 'q1',
            questionText: convertInformalMath(stemRaw),
            type: qType,
            options: qType === 'mcq' ? options : [],
            correctAnswer: qType === 'mcq' ? correctAnswer : 15,
            acceptedRange: qType === 'short_answer_numeric' ? [14.8, 15.2] : undefined,
            confidenceScore: 0.96,
          },
        ],
      })
    );
  }

  const hasCandidateFig = Array.isArray(candidateFigures) && candidateFigures.length > 0;
  return extractAndParseJson(
    JSON.stringify({
      testTitle: 'Uploaded Examination Paper (Demo Mode)',
      questions: [
        {
          id: 'q1',
          questionText:
            'Determine the equivalent resistance across terminals <math>A</math> and <math>B</math> for the network shown below when <math>R = \\pu{10 \\Omega}</math>.',
          type: 'short_answer_numeric',
          options: [],
          correctAnswer: 15,
          acceptedRange: [14.8, 15.2],
          diagrams: hasCandidateFig
            ? [
                {
                  id: candidateFigures[0].id || 'diag_1',
                  sourceFileIndex: candidateFigures[0].sourceFileIndex || 0,
                  pageIndex: candidateFigures[0].pageIndex || 0,
                  bbox: candidateFigures[0].bbox || [0.15, 0.15, 0.75, 0.85],
                  caption: 'Extracted Circuit Diagram',
                },
              ]
            : [],
        },
        {
          id: 'q2',
          questionText: 'Find the roots of the quadratic equation <math>x^2 - 5x + 6 = 0</math>.',
          type: 'mcq',
          options: [
            '<math>x = 2, 3</math>',
            '<math>x = -2, -3</math>',
            '<math>x = 1, 6</math>',
            '<math>x = -1, 6</math>',
          ],
          correctAnswer: 0,
        },
      ],
    })
  );
}

/**
 * Splits multi-page PDFs into 1-page chunks reliably across all environments:
 * 1. Fast pure-JS embedded JPEG extraction ONLY for genuine image-only scanned PDFs (0 fonts, 1:1 page match).
 * 2. pdfjs-dist + canvas rasterization for vector/digital PDFs (verified via PNG/JPEG magic headers).
 * 3. Virtual per-page PDF chunking (`targetPageNumber` + `totalPages`) if rasterization is unavailable on a digital PDF,
 *    so a multi-page PDF is ALWAYS processed 1 page per chunk and never mislabeled as `image/png`.
 */
async function chunkMediaFiles(mediaFiles, maxPagesPerChunk = 1) {
  if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) {
    return [[]];
  }

  const processedItems = [];

  for (let fileIdx = 0; fileIdx < mediaFiles.length; fileIdx++) {
    const file = mediaFiles[fileIdx];
    if (!file) continue;
    const mime = file.mimeType || file.mediaType || 'image/jpeg';
    const rawData = file.data || file.base64 || file.imageBase64;
    if (!rawData) continue;
    const cleanStr = stripBase64Header(rawData);

    if (mime === 'application/pdf') {
      const pdfBuffer = Buffer.from(cleanStr, 'base64');

      // Strategy 1: Pure-JS embedded page JPEG extraction (strictly gated to image-only scanned PDFs)
      const embeddedJpegs = extractEmbeddedJpegsFromPdf(pdfBuffer);
      if (embeddedJpegs.length > maxPagesPerChunk) {
        for (let p = 0; p < embeddedJpegs.length; p++) {
          processedItems.push({
            data: embeddedJpegs[p].buffer.toString('base64'),
            mimeType: 'image/jpeg',
            sourceFileIndex: fileIdx,
            pageIndex: p,
            totalPages: embeddedJpegs.length,
            name: `${file.name || 'document'}_page_${p + 1}`,
          });
        }
        continue;
      }

      // Strategy 2: pdfjs-dist page count + verified rasterization
      let numPages = 0;
      try {
        const pdfjsLib = await getPdfJsLib();
        if (pdfjsLib) {
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            disableWorker: true,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          numPages = pdf.numPages || 0;
        }
      } catch (_) {}

      if (!numPages) {
        numPages = countPdfPagesPureJs(pdfBuffer);
      }

      if (numPages > maxPagesPerChunk) {
        for (let p = 0; p < numPages; p++) {
          try {
            const pageBuffer = await rasterizePdfPage(cleanStr, p);
            if (isRasterImageBuffer(pageBuffer)) {
              const isJpeg = pageBuffer[0] === 0xff && pageBuffer[1] === 0xd8;
              processedItems.push({
                data: pageBuffer.toString('base64'),
                mimeType: isJpeg ? 'image/jpeg' : 'image/png',
                sourceFileIndex: fileIdx,
                pageIndex: p,
                totalPages: numPages,
                name: `${file.name || 'document'}_page_${p + 1}`,
              });
              continue;
            }
          } catch (_) {}

          // Strategy 3: Virtual single-page PDF chunk with explicit page target instruction
          processedItems.push({
            ...file,
            sourceFileIndex: fileIdx,
            pageIndex: p,
            targetPageNumber: p + 1,
            totalPages: numPages,
            name: `${file.name || 'document'}_page_${p + 1}`,
          });
        }
        continue;
      }
    }

    processedItems.push({ ...file, sourceFileIndex: fileIdx, pageIndex: file.pageIndex || 0 });
  }

  if (processedItems.length === 0) return [mediaFiles];

  const chunks = [];
  for (let i = 0; i < processedItems.length; i += maxPagesPerChunk) {
    chunks.push(processedItems.slice(i, i + maxPagesPerChunk));
  }

  return chunks.length > 0 ? chunks : [mediaFiles];
}

function repairJsonUnescapedBackslashes(str) {
  if (typeof str !== 'string') return str;
  let clean = str.trim();

  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  const firstBrace = clean.indexOf('{');
  if (firstBrace !== -1) {
    clean = clean.substring(firstBrace);
  }

  clean = clean
    .replace(/\x09(ext(?:bf|it|rm)?|imes|heta|au|anh?|o\b|op\b|riangle|ilde|frac|iny)/g, '\\\\t$1')
    .replace(/\x0C(rac|orall|lat|rown)/g, '\\\\f$1')
    .replace(/\x0A(Cr|Pr|eq|eg|u\b|abla|otsubset|ot\b|i\b|ewline|ormalsize)/g, '\\\\n$1')
    .replace(/\x0D(ho|ight|angle|ceil|floor)/g, '\\\\r$1')
    .replace(/\x08(eta|ar|inom|egin|ig|ullet|ox|ot\b|ackslash)/g, '\\\\b$1');

  clean = clean.replace(/("(?:[^"\\]|\\.)*")/g, (token) => {
    let inner = token.replace(
      /\\\\|\\(["\/])|\\u[0-9a-fA-F]{4}|\\([bfnrt])([a-zA-Z]*)|\\(?=[a-zA-Z0-9\{\}\_\^\%\#\$\&\s\,\;\!\:\|\[\]\(\)\-\+\=])/g,
      (match, quoteOrSlash, ctrlChar, ctrlSuffix) => {
        if (match === '\\\\') return '\\\\';
        if (quoteOrSlash || match.startsWith('\\u')) return match;
        if (ctrlChar) {
          if (ctrlSuffix && ctrlSuffix.length > 0) {
            return '\\\\' + ctrlChar + ctrlSuffix;
          }
          return match;
        }
        return '\\\\';
      }
    );

    inner = inner.replace(/[\u0000-\u001F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });

    return inner;
  });

  return clean;
}

function repairTruncatedJson(jsonStr) {
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) return jsonStr;

  let str = jsonStr.trim();

  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  const firstBrace = str.indexOf('{');
  if (firstBrace !== -1) {
    str = str.substring(firstBrace);
  }

  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      escaped = false;
    }
  }
  if (inString) {
    str += '"';
  }

  str = str.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
  str = str.replace(/,\s*$/, '');

  const stack = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      if (char === '"' && !escaped) {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      escaped = false;
    }
  }

  while (stack.length > 0) {
    str += stack.pop();
  }

  return str;
}

/**
 * Checks whether a character index in `text` lies inside a `<math>...</math>` span.
 */
function isIndexInsideMathTag(text, index) {
  const mathSpanRegex = /<math>[\s\S]*?<\/math>/gi;
  let m;
  while ((m = mathSpanRegex.exec(text)) !== null) {
    if (index >= m.index && index < m.index + m[0].length) {
      return true;
    }
  }
  return false;
}

/**
 * Safely splits inline MCQ options from a question stem ONLY when `rawOptions` has fewer than 2 items
 * AND sequential option markers ((a), (b), ... or (A), (B), ... or A), B), ... or (1), (2), ...) appear
 * at the end of the stem OUTSIDE <math> tags.
 *
 * - Never touches stems when `rawOptions.length >= 2` (preserving inline statement lists like
 *   "Consider statements (a) A is symmetric (b) A is orthogonal. Which is true?").
 * - Never splits on matrix or variable names like "A.", "B.", "det(A)", or "adj(A)".
 */
function normalizeRawOptionsAndStem(questionText, q) {
  let rawOptions = q.options || q.choices || [];
  if (rawOptions && !Array.isArray(rawOptions) && typeof rawOptions === 'object') {
    rawOptions = Object.values(rawOptions);
  }
  if (!Array.isArray(rawOptions)) {
    rawOptions = [];
  }

  if (rawOptions.length >= 2 || typeof questionText !== 'string') {
    return { stem: questionText, options: rawOptions };
  }

  const markerRegex = /\s+(?:\(([A-Da-d])\)|\(([1-4])\)|([A-Da-d])\))\s+/g;
  const rawMatches = [...questionText.matchAll(markerRegex)].filter(
    (m) => !isIndexInsideMathTag(questionText, m.index)
  );

  let sequentialMatches = [];
  for (let startIdx = 0; startIdx < rawMatches.length; startIdx++) {
    const firstToken = (rawMatches[startIdx][1] || rawMatches[startIdx][2] || rawMatches[startIdx][3] || '').toLowerCase();
    if (firstToken !== 'a' && firstToken !== '1') continue;

    const isNumeric = firstToken === '1';
    const expectedSeq = isNumeric ? ['1', '2', '3', '4'] : ['a', 'b', 'c', 'd'];
    const run = [rawMatches[startIdx]];

    for (let j = startIdx + 1; j < rawMatches.length && run.length < 4; j++) {
      const nextToken = (rawMatches[j][1] || rawMatches[j][2] || rawMatches[j][3] || '').toLowerCase();
      if (nextToken === expectedSeq[run.length]) {
        run.push(rawMatches[j]);
      }
    }

    if (run.length >= 2) {
      sequentialMatches = run;
      break;
    }
  }

  if (sequentialMatches.length >= 2) {
    const firstIdx = sequentialMatches[0].index;
    const stem = questionText.substring(0, firstIdx).trim();
    const extracted = [];
    for (let i = 0; i < sequentialMatches.length; i++) {
      const start = sequentialMatches[i].index + sequentialMatches[i][0].length;
      const end = i + 1 < sequentialMatches.length ? sequentialMatches[i + 1].index : questionText.length;
      const optText = questionText.substring(start, end).trim();
      if (optText) extracted.push(optText);
    }

    // Do not split if the last "option" actually trails into a closing question sentence (e.g. "... (b) A is orthogonal. Which is true?")
    const lastOpt = extracted[extracted.length - 1] || '';
    const looksLikeInlineStatementsWithTrailingPrompt =
      /\.\s+(?:Which|Then|Find|Select|Choose|How\s+many)\b/i.test(lastOpt) || /\?\s*$/.test(lastOpt);

    if (stem && extracted.length >= 2 && !looksLikeInlineStatementsWithTrailingPrompt) {
      return { stem, options: extracted };
    }
  }

  return { stem: questionText, options: rawOptions };
}

/**
 * Merges questions that were split across two consecutive PDF page chunks
 * (e.g., Question 11 starting at the bottom of Page 2: "Let A be a square matrix such that AA^T = I. Then"
 * and continuing at the top of Page 3: "1/2 A[(A+A^T)^2 + (A-A^T)^2] is equal to (a)... (b)... (c)... (d)...").
 *
 * Strictly requires either:
 * 1. Explicit continuation marking (`curr.isContinuation === true` or `id === 'page_continuation'`), OR
 * 2. An actual cross-chunk/page boundary (`curr._chunkIndex !== prev._chunkIndex` when chunk indices are present)
 *    where `prev` ends with a dangling connector word (`Then`, `such that`, `where`) and has 0 options, and `curr`
 *    begins directly with a formula or `"is equal to"`.
 * Never merges two independent questions on the same page!
 */
function mergeCrossPageContinuations(questions) {
  if (!Array.isArray(questions) || questions.length < 2) return questions || [];

  const merged = [];
  for (let i = 0; i < questions.length; i++) {
    const curr = questions[i];
    if (!curr) continue;

    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevStem = (prev.questionText || '').trim();
      const currStem = (curr.questionText || '').trim();
      const prevHasNoOptions = !Array.isArray(prev.options) || prev.options.length === 0;

      // Only match genuine trailing dangling connectors at the end of a cut-off bottom-of-page stem
      const prevEndsWithDanglingConnector =
        /\b(?:then|such\s+that|where|for\s+which)\s*[\.\:\-]?\s*$/i.test(prevStem);

      const currMarkedContinuation =
        curr.isContinuation === true ||
        /^page_continuation/i.test(String(curr.rawId || curr.id || '')) ||
        /^continuation/i.test(String(curr.rawId || curr.id || ''));

      // Check whether prev and curr are on different chunks/pages (when chunk tracking metadata is attached)
      const hasChunkTracking =
        typeof prev._chunkIndex === 'number' && typeof curr._chunkIndex === 'number';
      const crossesPageBoundary = !hasChunkTracking || curr._chunkIndex > prev._chunkIndex;

      // Only allow heuristic merge across a page boundary when `prev` was the LAST item of its page
      // and `curr` is the FIRST item of the next page and starts directly with a formula + "is equal to"
      const isBoundaryPair =
        !hasChunkTracking ||
        (prev._isLastInChunk === true &&
          curr._isFirstInChunk === true &&
          curr._chunkIndex === prev._chunkIndex + 1);

      const currStartsAsFormulaContinuation =
        !/^(?:Let|If|Consider|For|Find|Evaluate|Solve|Determine|Calculate|The\s+value|The\s+sum|In\s+a|A\s+matrix|Which|Given|Matrix|Two|Three|A\s+particle|An?\s+object|Suppose)\b/i.test(
          currStem
        ) &&
        (/\bis\s+equal\s+to\b/i.test(currStem) || /^<math>/.test(currStem));

      const shouldMerge =
        crossesPageBoundary &&
        (currMarkedContinuation ||
          (isBoundaryPair && prevEndsWithDanglingConnector && currStartsAsFormulaContinuation));

      if (shouldMerge) {
        const cleanPrevStem = prevStem.replace(/\s+$/, '');
        const combinedStem = `${cleanPrevStem} ${currStem}`.trim();
        const combinedOptions =
          Array.isArray(curr.options) && curr.options.length > 0 ? curr.options : prev.options || [];
        const combinedType =
          combinedOptions.length >= 2 ? 'mcq' : curr.type || prev.type || 'short_answer_numeric';
        const combinedAnswer =
          curr.correctAnswer !== null && curr.correctAnswer !== undefined
            ? curr.correctAnswer
            : prev.correctAnswer;

        const mathMatches =
          (combinedStem + ' ' + combinedOptions.join(' ')).match(/<math>(.*?)<\/math>/g) || [];
        const mathSpans = mathMatches.map((m) => m.replace(/<\/?math>/g, ''));

        merged[merged.length - 1] = {
          ...prev,
          questionText: combinedStem,
          type: combinedType,
          options: combinedOptions,
          correctAnswer: combinedAnswer,
          acceptedRange: curr.acceptedRange || prev.acceptedRange,
          diagrams: [...(prev.diagrams || []), ...(curr.diagrams || [])],
          mathSpans,
          _chunkIndex: curr._chunkIndex,
          _isLastInChunk: curr._isLastInChunk,
        };
        continue;
      }
    }

    merged.push(curr);
  }

  return merged;
}

function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Received empty or invalid model response text');
  }

  let clean = text.trim();

  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  const startIdx = clean.indexOf('{');
  if (startIdx !== -1) {
    clean = clean.substring(startIdx);
  }

  const repairedClean = repairJsonUnescapedBackslashes(clean);

  let parsed;
  try {
    parsed = JSON.parse(repairedClean);
  } catch (err1) {
    try {
      const fixedTruncated = repairTruncatedJson(repairedClean);
      parsed = JSON.parse(fixedTruncated);
    } catch (err2) {
      try {
        const safeFallback = clean.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
          return match.replace(/\\\\|\\(["\/])|\\/g, (m, q) => {
            if (m === '\\\\') return '\\\\';
            if (q) return m;
            return '\\\\';
          });
        });
        try {
          parsed = JSON.parse(safeFallback);
        } catch (_) {
          parsed = JSON.parse(repairTruncatedJson(safeFallback));
        }
      } catch (err3) {
        throw new Error(`AI generated an invalid JSON structure: ${err1.message}`);
      }
    }
  }

  let questions = [];
  if (Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  } else if (parsed.questionText) {
    questions = [parsed];
  } else {
    throw new Error('AI response JSON has unrecognized structure: missing "questions" array and "questionText" field');
  }

  const solutionHeaderIdx = questions.findIndex((q) => {
    const text = (q.questionText || '').trim();
    return /^(?:ANSWERS?\s*(?:AND|&)?\s*SOLUTIONS?|HINTS?\s*(?:AND|&)?\s*SOLUTIONS?|ANSWER\s*KEY)\b/i.test(text);
  });

  if (solutionHeaderIdx >= 0) {
    questions = questions.slice(0, solutionHeaderIdx);
  }

  questions = questions.filter((q) => {
    const text = (q.questionText || '').trim();
    if (!text) return false;

    const isSolutionText =
      /^(?:Solution|Explanation|Answer|Reason|Hence|Therefore|In electrostatics and circuit theory|Absolute voltage is not|Correct option is)\b/i.test(text) ||
      /Therefore,?\s+[a-z0-9\s]+is not a/i.test(text) ||
      /^\d+[\.\:\)]\s*\([1-4a-dA-D]\)\s*/i.test(text) ||
      /^\d+[\.\:\)]\s*(?:Ans|Answer|Sol|Solution)\b/i.test(text) ||
      /^(?:ANSWERS?\s*(?:AND|&)?\s*SOLUTIONS?|HINTS?\s*(?:AND|&)?\s*SOLUTIONS?|ANSWER\s*KEY)\b/i.test(text);

    return !isSolutionText;
  });

  questions = questions.map((q, idx) => {
    let rawQuestionText = repairMissingMathBackslashes(q.questionText || `Question ${idx + 1}`);
    const originalRaw = rawQuestionText;

    const cleanedText = rawQuestionText
      .replace(/^(?:Q\d+|Question\s*\d+)[\.\:]\s*(?:JEE\s*Main[^\n\r]*[\n\r]*)?/i, '')
      .trim();
    if (cleanedText.length > 0) {
      rawQuestionText = cleanedText;
    } else if (originalRaw.trim().length > 0) {
      rawQuestionText = originalRaw.trim();
    }

    const splitResult = normalizeRawOptionsAndStem(rawQuestionText, q);
    rawQuestionText = splitResult.stem;
    const rawOptionsList = splitResult.options;

    let questionText = repairMissingMathBackslashes(rawQuestionText).trim();
    if (!questionText) {
      questionText = `Question ${idx + 1}`;
    }

    const cleanOptions = (Array.isArray(rawOptionsList) ? rawOptionsList : []).map((opt) =>
      repairMissingMathBackslashes(typeof opt === 'string' ? opt : String(opt))
    );

    let type = q.type;
    if (type !== 'mcq' && type !== 'match_following') {
      type = cleanOptions.length >= 2 ? 'mcq' : 'short_answer_numeric';
    }

    const options = type === 'mcq' || type === 'match_following' ? cleanOptions : [];

    const mathMatches = (questionText + ' ' + options.join(' ')).match(/<math>(.*?)<\/math>/g) || [];
    const mathSpans = mathMatches.map((m) => m.replace(/<\/?math>/g, ''));

    let correctAnswer = null;
    if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
      if (typeof q.correctAnswer === 'string') {
        const letterMap = {
          a: 0,
          b: 1,
          c: 2,
          d: 3,
          e: 4,
          '(a)': 0,
          '(b)': 1,
          '(c)': 2,
          '(d)': 3,
          'option a': 0,
          'option b': 1,
          'option c': 2,
          'option d': 3,
        };
        const key = q.correctAnswer.trim().toLowerCase();
        if (letterMap[key] !== undefined) {
          correctAnswer = letterMap[key];
        } else {
          const num = parseFloat(q.correctAnswer);
          correctAnswer = !isNaN(num) ? num : null;
        }
      } else if (typeof q.correctAnswer === 'number') {
        correctAnswer = q.correctAnswer;
      }
    }

    if (type === 'mcq' || type === 'match_following') {
      if (typeof correctAnswer === 'number') {
        if (
          !Number.isInteger(correctAnswer) ||
          correctAnswer < 0 ||
          (options.length > 0 && correctAnswer >= options.length)
        ) {
          correctAnswer = null;
        }
      }
    }

    let acceptedRange = undefined;
    if (type === 'short_answer_numeric') {
      if (
        Array.isArray(q.acceptedRange) &&
        q.acceptedRange.length === 2 &&
        typeof q.acceptedRange[0] === 'number' &&
        typeof q.acceptedRange[1] === 'number' &&
        q.acceptedRange[0] <= q.acceptedRange[1]
      ) {
        acceptedRange = q.acceptedRange;
      } else if (typeof correctAnswer === 'number' && Number.isFinite(correctAnswer)) {
        const margin = Math.abs(correctAnswer) > 0 ? Math.max(0.1, Math.abs(correctAnswer) * 0.02) : 0.5;
        acceptedRange = [
          Math.round((correctAnswer - margin) * 100) / 100,
          Math.round((correctAnswer + margin) * 100) / 100,
        ];
      }
    }

    const normalized = {
      id: q.id || `q_${Date.now()}_${idx}`,
      rawId: q.id || null,
      isContinuation: Boolean(q.isContinuation || /^page_continuation/i.test(String(q.id || ''))),
      questionText,
      type,
      options,
      correctAnswer,
      diagrams: Array.isArray(q.diagrams) ? q.diagrams : [],
      mathSpans,
      confidenceScore: q.confidenceScore || 0.95,
      numericalConfirmed: false,
      needsReview: true,
    };

    if (acceptedRange !== undefined) {
      normalized.acceptedRange = acceptedRange;
    }

    return normalized;
  });

  return {
    testTitle: parsed.testTitle || 'Mathematics Test Paper',
    questions,
  };
}

function validateJsonSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.testTitle && typeof data.testTitle !== 'string') return false;
  if (!Array.isArray(data.questions) || data.questions.length === 0) return false;

  for (const q of data.questions) {
    if (!q || typeof q !== 'object') return false;
    if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) return false;
  }

  return true;
}

function getGeminiModelName() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
}

async function executeSingleAttemptWithProvider({
  provider,
  type,
  rawText,
  imageBase64,
  mediaType,
  chunk,
  docxStructure,
}) {
  if (provider.name === 'gemini') {
    return await withTimeout(
      parseWithGemini({
        geminiKey: provider.key,
        type,
        rawText,
        imageBase64,
        mediaType,
        mediaFiles: chunk,
        docxStructure,
      }),
      CHUNK_TIMEOUT_MS,
      'Gemini chunk transcription'
    );
  }
  if (provider.name === 'anthropic') {
    return await withTimeout(
      parseWithClaude({
        anthropicKey: provider.key,
        type,
        rawText,
        imageBase64,
        mediaType,
        mediaFiles: chunk,
        docxStructure,
      }),
      CHUNK_TIMEOUT_MS,
      'Anthropic chunk transcription'
    );
  }
  throw new Error(`Unsupported provider: ${provider.name}`);
}

async function runSingleChunkWithProvider(params) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      return await executeSingleAttemptWithProvider(params);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_TRANSIENT_RETRIES && isTransientProviderError(err)) {
        const delayMs = TRANSIENT_RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Bounded-Concurrency, Per-Chunk Fault-Tolerant Parse Handler:
 * - Processes media chunks with MAX_CONCURRENT_CHUNKS = 2 and per-chunk deadlines.
 * - Retries ONLY failed chunks on secondary providers instead of restarting already-parsed pages.
 * - Stitches cross-page split questions across adjacent chunks via mergeCrossPageContinuations.
 */
async function handleParseRequest(req, res, forcedType = null) {
  const { rawText, imageBase64, mediaType, mediaFiles, docxStructure } = req.body || {};
  const type = forcedType || req.body?.type || 'text';

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const providers = [];
  if (isKeyValid(geminiKey)) {
    providers.push({ name: 'gemini', key: geminiKey });
  }
  if (isKeyValid(anthropicKey)) {
    providers.push({ name: 'anthropic', key: anthropicKey });
  }

  const effectiveMediaFiles =
    Array.isArray(mediaFiles) && mediaFiles.length > 0
      ? mediaFiles
      : imageBase64
      ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }]
      : [];

  const candidateFigures = await extractCandidateFigures(effectiveMediaFiles);

  if (providers.length === 0) {
    try {
      const fallbackData = buildSmartFallbackCatalogue({
        type,
        rawText,
        docxStructure,
        candidateFigures,
      });
      if (effectiveMediaFiles.length > 0) {
        fallbackData.questions = await matchDiagramsToQuestions(
          fallbackData.questions,
          candidateFigures,
          effectiveMediaFiles
        );
      }
      return res.json({
        success: true,
        data: fallbackData,
        mode: 'smart_demo_fallback',
      });
    } catch (fbErr) {
      return res.status(400).json({
        success: false,
        error: `Demo parser could not process input: ${fbErr.message}`,
      });
    }
  }

  const chunkSize = 1;
  const mediaChunks =
    type === 'image' || type === 'media'
      ? await chunkMediaFiles(effectiveMediaFiles, chunkSize)
      : [[{ type, rawText, docxStructure }]];

  const resolvedChunks = new Array(mediaChunks.length).fill(null);
  const errors = [];
  let primaryProviderUsed = providers[0].name;

  for (const provider of providers) {
    const pendingIndices = [];
    for (let i = 0; i < mediaChunks.length; i++) {
      if (!resolvedChunks[i]) pendingIndices.push(i);
    }
    if (pendingIndices.length === 0) break;

    const settledBatch = await mapWithConcurrencySettled(
      pendingIndices,
      MAX_CONCURRENT_CHUNKS,
      async (chunkIdx) => {
        const chunk = mediaChunks[chunkIdx];
        const parsedChunkData = await runSingleChunkWithProvider({
          provider,
          type,
          rawText,
          imageBase64,
          mediaType,
          chunk,
          docxStructure,
        });
        return { chunkIdx, chunk, parsedChunkData, provider: provider.name };
      }
    );

    settledBatch.forEach((item, idx) => {
      const chunkIdx = pendingIndices[idx];
      if (item.status === 'fulfilled' && item.value?.parsedChunkData) {
        resolvedChunks[chunkIdx] = item.value;
        primaryProviderUsed = item.value.provider;
      } else {
        const reasonMsg = item.reason?.message || 'Chunk transcription failed';
        errors.push({
          provider: provider.name,
          chunkIndex: chunkIdx,
          error: reasonMsg,
        });
      }
    });
  }

  const succeededCount = resolvedChunks.filter(Boolean).length;
  const failedCount = mediaChunks.length - succeededCount;

  if (succeededCount === 0) {
    const errDetails = errors.map((e) => `[${e.provider}#${e.chunkIndex + 1}]: ${e.error}`).join(' | ');
    return res.status(500).json({
      success: false,
      error: `AI transcription failed: ${errDetails}. Check your API key in environment settings.`,
    });
  }

  let aggregatedQuestions = [];
  let masterTestTitle = 'Mathematics Test Paper';

  for (const entry of resolvedChunks) {
    if (!entry) continue;
    const { chunkIdx, chunk, parsedChunkData } = entry;

    if (
      parsedChunkData &&
      parsedChunkData.testTitle &&
      parsedChunkData.testTitle !== 'Mathematics Test Paper'
    ) {
      masterTestTitle = parsedChunkData.testTitle;
    }

    if (parsedChunkData && Array.isArray(parsedChunkData.questions)) {
      const qCount = parsedChunkData.questions.length;
      const remappedChunkQuestions = parsedChunkData.questions.map((q, qIdx) => {
        if (Array.isArray(q.diagrams)) {
          q.diagrams = q.diagrams.map((diag) => {
            const chunkItem =
              typeof diag.sourceFileIndex === 'number' && chunk[diag.sourceFileIndex]
                ? chunk[diag.sourceFileIndex]
                : chunk[0];
            return {
              ...diag,
              sourceFileIndex:
                chunkItem && typeof chunkItem.sourceFileIndex === 'number'
                  ? chunkItem.sourceFileIndex
                  : 0,
              pageIndex:
                chunkItem && typeof chunkItem.pageIndex === 'number'
                  ? chunkItem.pageIndex
                  : diag.pageIndex || 0,
            };
          });
        }
        return {
          ...q,
          _chunkIndex: chunkIdx,
          _isFirstInChunk: qIdx === 0,
          _isLastInChunk: qIdx === qCount - 1,
        };
      });

      aggregatedQuestions.push(...remappedChunkQuestions);
    }
  }

  // Merge any question split across a page boundary between chunk k-1 and chunk k
  aggregatedQuestions = mergeCrossPageContinuations(aggregatedQuestions);

  aggregatedQuestions = aggregatedQuestions.map((q, idx) => {
    const { rawId, isContinuation, _chunkIndex, _isFirstInChunk, _isLastInChunk, ...cleanQ } = q;
    return {
      ...cleanQ,
      id: `q${idx + 1}`,
    };
  });

  const combinedData = {
    testTitle: masterTestTitle,
    questions: aggregatedQuestions,
    chunkStats: {
      totalChunks: mediaChunks.length,
      succeededChunks: succeededCount,
      failedChunks: failedCount,
    },
  };

  if (combinedData.questions.length === 0) {
    return res.status(400).json({
      success: false,
      error:
        'No exam questions could be extracted from the uploaded document. Select pages containing numbered questions.',
    });
  }

  if (!validateJsonSchema(combinedData)) {
    return res.status(422).json({
      success: false,
      error: 'Extracted questions did not pass schema validation.',
    });
  }

  try {
    combinedData.questions = await matchDiagramsToQuestions(
      combinedData.questions,
      candidateFigures,
      effectiveMediaFiles
    );
  } catch (_) {}

  return res.json({
    success: true,
    data: combinedData,
    mode: `live_${primaryProviderUsed}`,
    chunkStats: combinedData.chunkStats,
  });
}

router.post('/parse-question', (req, res) => handleParseRequest(req, res));
router.post('/parse-text', (req, res) => handleParseRequest(req, res, 'text'));
router.post('/parse-image', (req, res) => handleParseRequest(req, res, 'media'));
router.post('/parse-docx', (req, res) => handleParseRequest(req, res, 'docx_structure'));

function buildPageTargetingPrompt(filesToProcess) {
  const targeted = filesToProcess.find((f) => typeof f.targetPageNumber === 'number' && f.totalPages > 1);
  const pageScopeHint = targeted
    ? `IMPORTANT PAGE SCOPE: This PDF has ${targeted.totalPages} pages. For this request, transcribe ONLY Page ${targeted.targetPageNumber} of ${targeted.totalPages} (ignore all other pages). `
    : '';
  const pageIndexHint =
    filesToProcess.length === 1 && typeof filesToProcess[0].pageIndex === 'number'
      ? `(Page ${filesToProcess[0].pageIndex + 1}${
          filesToProcess[0].totalPages ? ` of ${filesToProcess[0].totalPages}` : ''
        }) `
      : '';

  return (
    `${pageScopeHint}Transcribe ALL exam questions visible on the provided page ${pageIndexHint}into separate objects in the "questions" array. ` +
    `Capture each question's COMPLETE text from start to finish (do NOT truncate stems at inline handwritten scratch calculations or matrix names). ` +
    `If the very top of the page has an unnumbered continuation of a question from the previous page, include it as the FIRST item with "id": "page_continuation" and "isContinuation": true. ` +
    `If a numbered question at the very bottom of the page is cut off mid-sentence, still include its visible stem as the last item. ` +
    DIAGRAM_PROMPT_INSTRUCTION
  );
}

async function parseWithGemini({ geminiKey, type, rawText, imageBase64, mediaType, mediaFiles, docxStructure }) {
  const genAI = new GoogleGenerativeAI(geminiKey);
  const modelName = getGeminiModelName();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 16384,
    },
  });

  const promptParts = [SYSTEM_PROMPT];

  if (type === 'text') {
    promptParts.push(`Convert this teacher input into the math test catalogue JSON schema:\n\n"${rawText}"`);
  } else if (type === 'image' || type === 'media') {
    const filesToProcess =
      Array.isArray(mediaFiles) && mediaFiles.length > 0
        ? mediaFiles
        : imageBase64
        ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }]
        : [];

    filesToProcess.forEach((file) => {
      const rawData = file.data || file.base64 || file.imageBase64;
      promptParts.push({
        inlineData: {
          data: stripBase64Header(rawData),
          mimeType: file.mimeType || file.mediaType || 'image/jpeg',
        },
      });
    });

    promptParts.push(buildPageTargetingPrompt(filesToProcess));
  } else if (type === 'docx_structure') {
    promptParts.push(
      `Here is extracted text and formulas from a Word document:\n\n${JSON.stringify(
        docxStructure,
        null,
        2
      )}\n\nFormat this into the test questions array schema.`
    );
  }

  const result = await model.generateContent(promptParts);
  const responseText = result.response.text();
  return extractAndParseJson(responseText);
}

async function parseWithClaude({ anthropicKey, type, rawText, imageBase64, mediaType, mediaFiles, docxStructure }) {
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let messages = [];

  if (type === 'text') {
    messages = [
      { role: 'user', content: `Convert this teacher input into the math test catalogue JSON schema:\n\n"${rawText}"` },
    ];
  } else if (type === 'image' || type === 'media') {
    const filesToProcess =
      Array.isArray(mediaFiles) && mediaFiles.length > 0
        ? mediaFiles
        : imageBase64
        ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }]
        : [];

    const contentBlocks = [];

    filesToProcess.forEach((file) => {
      const mime = file.mimeType || file.mediaType || 'image/jpeg';
      const rawData = file.data || file.base64 || file.imageBase64;
      const cleanData = stripBase64Header(rawData);

      if (mime === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: cleanData },
        });
      } else {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: mime, data: cleanData },
        });
      }
    });

    contentBlocks.push({
      type: 'text',
      text: buildPageTargetingPrompt(filesToProcess),
    });

    messages = [{ role: 'user', content: contentBlocks }];
  } else if (type === 'docx_structure') {
    messages = [
      {
        role: 'user',
        content: `Here is extracted text and formulas from a Word document:\n\n${JSON.stringify(
          docxStructure,
          null,
          2
        )}\n\nFormat this into the test questions array schema.`,
      },
    ];
  }

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages,
  });

  const responseText = response.content[0]?.text || '';
  return extractAndParseJson(responseText);
}

module.exports = router;
module.exports.validateJsonSchema = validateJsonSchema;
module.exports.extractAndParseJson = extractAndParseJson;
module.exports.repairTruncatedJson = repairTruncatedJson;
module.exports.repairJsonUnescapedBackslashes = repairJsonUnescapedBackslashes;
module.exports.normalizeRawOptionsAndStem = normalizeRawOptionsAndStem;
module.exports.mergeCrossPageContinuations = mergeCrossPageContinuations;
module.exports.chunkMediaFiles = chunkMediaFiles;
module.exports.buildSmartFallbackCatalogue = buildSmartFallbackCatalogue;
module.exports.mapWithConcurrencySettled = mapWithConcurrencySettled;
module.exports.withTimeout = withTimeout;
module.exports.handleParseRequest = handleParseRequest;
module.exports.MAX_CONCURRENT_CHUNKS = MAX_CONCURRENT_CHUNKS;
module.exports.CHUNK_TIMEOUT_MS = CHUNK_TIMEOUT_MS;
module.exports.isTransientProviderError = isTransientProviderError;
