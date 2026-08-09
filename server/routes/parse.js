const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { stripBase64Header } = require('../services/diagramCropService');
const { extractCandidateFigures } = require('../services/layoutExtractorService');
const { matchDiagramsToQuestions } = require('../services/diagramMatcherService');

/**
 * REVIEW & INVARIANT CONTRACT (Aligned with client/src/services/reviewEvaluator.js):
 * - Needs Review is flagged by client when:
 *   1. Answer key is unset (correctAnswer is null/undefined)
 *   2. Numeric question has invalid range (acceptedRange missing or min > max)
 *   3. MCQ question has fewer than 2 options
 *   4. Question stem is empty or contains invalid math syntax
 * - TEACHER CONFIRMATION FLAGS:
 *   "numericalConfirmed" and "diagramsConfirmed" are client-side teacher confirmation toggles ONLY.
 *   The AI model MUST NEVER set or output "numericalConfirmed" or "diagramsConfirmed".
 */
const SYSTEM_PROMPT = `You are an expert math and science test paper parser for tuition teachers.
Your task is to parse input (informal text, photo of exam paper, or multi-page PDF) representing exam questions and convert them into strict JSON adhering to this exact schema format:

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
1. EXTRACT STRICTLY ORIGINAL EXAM QUESTIONS ONLY: Extract ONLY actual numbered exam questions that students are expected to solve.
   - NEVER create questions out of solution notes, answer key explanations, solution booklets, header/footer page numbers, copyright notices, or exam instructions.
   - Example of solution text to IGNORE: "In electrostatics and circuit theory... Therefore, absolute voltage is not a measurable quantity." -> THIS IS A SOLUTION EXPLANATION, NOT A QUESTION. DO NOT EXTRACT IT AS A QUESTION.
2. NO LITERAL "\\n" IN STRINGS: Do not put literal "\\n" string characters inside JSON string values. Replace all line breaks with clean space separators.
3. MATH TAG BOUNDARIES: Wrap mathematical formulas, equations, variables, chemical notation, physical units, matrices, and math symbols in <math>...</math> tags (e.g. <math>x^2 + 2x - 3 = 0</math>, <math>\\frac{a}{b}</math>, <math>x</math>).
   - NEVER put plain English sentences, problem instructions, question numbers ("Question 1"), or option letters ("Option A") inside <math> tags.
   - CORRECT: "Solve for <math>x</math> when <math>x^2 = 4</math>."
   - WRONG: "<math>Solve for x when x^2 = 4.</math>"
4. JSON LATEX ESCAPING MANDATE: Because your response MUST be valid JSON, EVERY single LaTeX backslash inside JSON string values MUST be double-escaped (e.g. "\\frac{a}{b}", "\\ce{...}", "\\pu{...}", "\\pi", "\\alpha", "\\sin", "\\sqrt{x}"). Never output unescaped single backslashes inside JSON strings.
5. BRACE DISCIPLINE: Always enclose multi-character superscripts/subscripts in curly braces (<math>x^{10}</math>, <math>a_{12}</math>), and use explicit braces around BOTH numerator and denominator (<math>\\frac{numerator}{denominator}</math>) and radicals (<math>\\sqrt{expression}</math>).
6. FUNCTIONS & SYMBOLS: Precede standard function names with a backslash (\\sin, \\cos, \\tan, \\cot, \\sec, \\csc, \\log, \\ln, \\lim, \\max, \\min, \\det, \\deg).
7. CHEMISTRY & REACTION NOTATION: Wrap chemical formulas, balanced reactions, state symbols, ionic charges, and nuclear isotopes in <math>\\ce{...}</math> using mhchem syntax (e.g. <math>\\ce{2H2 + O2 -> 2H2O}</math>, <math>\\ce{^238_92U}</math>).
8. PHYSICAL QUANTITIES WITH UNITS: Wrap value+unit pairs in <math>\\pu{...}</math> (e.g. <math>\\pu{9.8 m/s^2}</math>, <math>\\pu{50 \\Omega}</math>).
9. PERMUTATIONS & COMBINATIONS: Use custom macros <math>\\nCr{n}{r}</math> and <math>\\nPr{n}{r}</math>.
10. QUESTION TYPES & ANSWERS:
   - For MCQ: set "type": "mcq", populate "options" with 4 option strings, and set "correctAnswer" as the 0-indexed integer (0 for A, 1 for B, 2 for C, 3 for D).
   - For Numerical: set "type": "short_answer_numeric", "options": [], and provide an estimated numeric float/integer "correctAnswer" and "acceptedRange": [min, max].
   - Match the Following: set "type": "match_following" with combination choices in "options".
11. DIAGRAMS: Bounding boxes for visual diagrams (circuits, apparatus, geometric figures, graphs) belong in the "diagrams" array as normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 on sourceFileIndex. Never put diagrams into <math> tags.
12. SUBPARTS DISAGGREGATION: Extract multi-part sub-questions (e.g. Question 1(a), 1(b), 1(c) or 1.1, 1.2) into DISTINCT individual question objects in the "questions" array with descriptive IDs (e.g. "q1_a", "q1_b"). Do NOT collapse sub-questions together into a single wall of text.
13. ABSOLUTELY NO FAKE XML TAGS: <math>...</math> is the ONLY allowed XML tag format. NEVER output fake XML tags like <\pu>, <pu>, </pu>, <\ce>, <ce>, </ce>, <frac>, or <\pu>50 V<\pu>. Physical quantities and units MUST be written inside <math> tags using LaTeX macros: <math>\\pu{50 V}</math> or <math>\\ce{2H2 + O2 -> 2H2O}</math>.
    - WRONG: "<\pu>50 V<\pu>" or "<pu>50 V</pu>" or "<\pu>50 V</\pu>"
    - CORRECT: "<math>\\pu{50 V}</math>"
14. ABSOLUTELY NO RAW MATHML TAGS: Never output raw MathML elements like <mn>, <mi>, <mo>, <mfrac>, <msup>, <msub>, <mrow>, or <annotation>. Always output standard KaTeX LaTeX inside <math>...</math> tags.
    - WRONG: "<mn>50</mn><mo></mo><mi mathvariant=\"normal\">V</mi>"
    - CORRECT: "<math>\\pu{50 V}</math>"
15. OUTPUT FORMAT: Return ONLY valid JSON matching the schema. Do NOT wrap in markdown code blocks.`;

const DIAGRAM_PROMPT_INSTRUCTION = `CRITICAL DIAGRAM INSTRUCTION: IF and ONLY IF a question contains a visual diagram, circuit, figure, graph, organic structure, or apparatus drawing in the source image, YOU MUST INCLUDE a "diagrams" array for that question containing {"id": "diag_1", "sourceFileIndex": 0, "pageIndex": 0, "bbox": [ymin, xmin, ymax, xmax], "caption": "description"}, where bbox contains 4 normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 tightly bounding the diagram area and labels on sourceFileIndex. DO NOT output diagrams array for text-only questions without visual figures.`;

const { hasBareCommandRun, repairMissingMathBackslashes } = require('../services/mathSanitizerService');


function isKeyValid(key) {
  return typeof key === 'string' && key.trim().length > 5 && !key.includes('your_');
}

/**
 * Splits incoming media files / PDF pages into manageable chunks of at most maxPagesPerChunk.
 * For multi-page PDFs, rasterizes pages into image chunks so each AI invocation processes
 * at most ~15 questions, eliminating schema validation errors and response truncations.
 */
async function chunkMediaFiles(mediaFiles, maxPagesPerChunk = 2) {
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
      try {
        const { getPdfJsLib, rasterizePdfPage } = require('../services/diagramCropService');
        const pdfjsLib = await getPdfJsLib();
        if (pdfjsLib) {
          const pdfBuffer = Buffer.from(cleanStr, 'base64');
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;

          if (numPages > maxPagesPerChunk) {
            console.log(`[Parser Chunking] PDF file #${fileIdx} has ${numPages} pages (> ${maxPagesPerChunk}). Rasterizing into page chunks...`);
            for (let p = 0; p < numPages; p++) {
              try {
                const pageBuffer = await rasterizePdfPage(cleanStr, p);
                processedItems.push({
                  data: pageBuffer.toString('base64'),
                  mimeType: 'image/png',
                  sourceFileIndex: fileIdx,
                  pageIndex: p,
                  name: `${file.name || 'document'}_page_${p + 1}`
                });
              } catch (rErr) {
                console.warn(`[Parser Chunking] Page ${p + 1} rasterization skipped:`, rErr.message);
                processedItems.push({ ...file, sourceFileIndex: fileIdx, pageIndex: p });
              }
            }
            continue;
          }
        }
      } catch (err) {
        console.warn('[Parser Chunking] PDF page count check skipped:', err.message);
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

  // Strip markdown code fences if present
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Find first '{'
  const firstBrace = clean.indexOf('{');
  if (firstBrace !== -1) {
    clean = clean.substring(firstBrace);
  }

  // 1. Repair control character escapes where HTTP parser converted \f, \n, \r, \b, \t + LaTeX letters
  // e.g. \frac -> \x0Crac, \nCr -> \x0ACr, \rho -> \x0Dho, \beta -> \x08eta, \times -> \x09imes
  clean = clean
    .replace(/\x0Crac/g, '\\\\frac')
    .replace(/\x0ACr/g, '\\\\nCr')
    .replace(/\x0Dho/g, '\\\\rho')
    .replace(/\x08eta/g, '\\\\beta')
    .replace(/\x09imes/g, '\\\\times');

  // 2. Escape backslashes & unescaped control characters ONLY INSIDE JSON string tokens ("...")
  // Leaves structural JSON formatting (newlines, tabs outside strings) intact as valid JSON whitespace
  clean = clean.replace(/("(?:[^"\\]|\\.)*")/g, (token) => {
    let inner = token;

    // Double-escape single backslashes followed by letters or math symbols (e.g. \frac, \nCr, \rho, \beta, \times, \sqrt, \pi)
    inner = inner.replace(/\\(?=[a-zA-Z\{\}\_\^\%\#\$\&])/g, '\\\\');

    // Escape unescaped literal raw newlines, carriage returns, or tabs INSIDE the string literal
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

  // Strip markdown code fences if present
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Find first '{'
  const firstBrace = str.indexOf('{');
  if (firstBrace !== -1) {
    str = str.substring(firstBrace);
  }

  // Step 1: If string cut off inside a quoted string value, close the quote
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

  // Step 2: Remove trailing partial keys, values, or trailing commas
  str = str.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, '');
  str = str.replace(/,\s*$/, '');

  // Step 3: Count and balance unclosed braces '{' and brackets '['
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

  // Append closing brackets in reverse order
  while (stack.length > 0) {
    str += stack.pop();
  }

  return str;
}

function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Received empty or invalid model response text');
  }

  let clean = text.trim();

  // Strip markdown code fences if present
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Find first '{'
  const startIdx = clean.indexOf('{');
  if (startIdx !== -1) {
    clean = clean.substring(startIdx);
  }

  // Pre-sanitize LaTeX backslashes & unescaped control sequences before JSON.parse
  clean = repairJsonUnescapedBackslashes(clean);

  let parsed;
  try {
    // Attempt 1: Direct JSON parse
    parsed = JSON.parse(clean);
  } catch (err1) {
    console.warn('[Parser Repair 1/3] Direct JSON.parse failed:', err1.message, '- Attempting aggressive string escape repair...');
    try {
      // Attempt 2: Aggressive JSON string content escape
      const aggressive = clean.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
        return match.replace(/\\/g, '\\\\');
      });
      parsed = JSON.parse(aggressive);
    } catch (err2) {
      console.warn('[Parser Repair 2/3] Aggressive parse failed:', err2.message, '- Attempting truncated JSON repair...');
      try {
        // Attempt 3: Truncated JSON auto-repair (closes unclosed quotes, brackets, and braces)
        const fixedTruncated = repairTruncatedJson(clean);
        parsed = JSON.parse(fixedTruncated);
        console.log('[Parser Repair 3/3 Success] Truncated JSON successfully repaired!');
      } catch (err3) {
        console.error('[Parser Repair 3/3 Failed]: All JSON parse attempts failed:', err3.message);
        throw new Error(`AI generated an invalid JSON structure: ${err1.message}`);
      }
    }
  }


  // Handle single question vs multi-question catalogue
  let questions = [];
  if (Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  } else if (parsed.questionText) {
    questions = [parsed];
  } else {
    throw new Error('AI response JSON has unrecognized structure: missing "questions" array and "questionText" field');
  }

  // Filter out solution explanation paragraphs mistakenly extracted as separate questions
  questions = questions.filter(q => {
    const text = (q.questionText || '').trim();
    if (!text) return false;

    const isSolutionText = /^(?:Solution|Explanation|Answer|Reason|Hence|Therefore|In electrostatics and circuit theory|Absolute voltage is not|Correct option is)\b/i.test(text) ||
                           /Therefore,?\s+[a-z0-9\s]+is not a/i.test(text);
    const hasNoOptions = !Array.isArray(q.options) || q.options.length === 0;

    if (isSolutionText && hasNoOptions) {
      console.log('[Parser Filter] Excluded solution/explanation paragraph:', text.substring(0, 80));
      return false;
    }
    return true;
  });

  // Normalize each question
  questions = questions.map((q, idx) => {
    let rawQuestionText = (q.questionText || `Question ${idx + 1}`).replace(/\n(?!(?:Cr|Pr|u|abla|eq|eg|ewline|otsubset|ot|i|n|ormalsize)\b)/gi, ' ');
    const originalRaw = rawQuestionText;
    
    // Clean raw question number / exam metadata prefixes (e.g. "Q1. JEE Main 2026 (21 January Shift 2)\n")
    const cleanedText = rawQuestionText.replace(/^(?:Q\d+|Question\s*\d+)[\.\:]\s*(?:JEE\s*Main[^\n\r]*[\n\r]*)?/i, '').trim();
    if (cleanedText.length > 0) {
      rawQuestionText = cleanedText;
    } else if (originalRaw.trim().length > 0) {
      rawQuestionText = originalRaw.trim();
    }
    
    let questionText = repairMissingMathBackslashes(rawQuestionText).trim();
    if (!questionText) {
      questionText = `Question ${idx + 1}`;
    }

    // Force non-MCQ questions to short_answer_numeric unless match_following
    let type = q.type;
    if (type !== 'mcq' && type !== 'match_following') {
      type = 'short_answer_numeric';
    }

    const cleanOptions = (Array.isArray(q.options) ? q.options : []).map(opt => repairMissingMathBackslashes(typeof opt === 'string' ? opt : String(opt)));

    const options = (type === 'mcq' || type === 'match_following') ? cleanOptions : [];

    // Auto-extract mathSpans
    const mathMatches = (questionText + ' ' + options.join(' ')).match(/<math>(.*?)<\/math>/g) || [];
    const mathSpans = mathMatches.map(m => m.replace(/<\/?math>/g, ''));

    let correctAnswer = null;
    if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
      if (typeof q.correctAnswer === 'string') {
        const letterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, '(a)': 0, '(b)': 1, '(c)': 2, '(d)': 3, 'option a': 0, 'option b': 1, 'option c': 2, 'option d': 3 };
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

    // MCQ option bounds check for correctAnswer
    if (type === 'mcq' || type === 'match_following') {
      if (typeof correctAnswer === 'number') {
        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || (options.length > 0 && correctAnswer >= options.length)) {
          correctAnswer = null;
        }
      }
    }

    // Preserve or generate estimated acceptedRange for numerical questions
    let acceptedRange = undefined;
    if (type === 'short_answer_numeric') {
      if (Array.isArray(q.acceptedRange) && q.acceptedRange.length === 2 &&
          typeof q.acceptedRange[0] === 'number' && typeof q.acceptedRange[1] === 'number' &&
          q.acceptedRange[0] <= q.acceptedRange[1]) {
        acceptedRange = q.acceptedRange;
      } else if (typeof correctAnswer === 'number' && Number.isFinite(correctAnswer)) {
        const margin = Math.abs(correctAnswer) > 0 ? Math.max(0.1, Math.abs(correctAnswer) * 0.02) : 0.5;
        acceptedRange = [
          Math.round((correctAnswer - margin) * 100) / 100,
          Math.round((correctAnswer + margin) * 100) / 100
        ];
      }
    }

    const normalized = {
      id: q.id || `q_${Date.now()}_${idx}`,
      questionText,
      type,
      options,
      correctAnswer,
      diagrams: Array.isArray(q.diagrams) ? q.diagrams : [],
      mathSpans,
      confidenceScore: q.confidenceScore || 0.95,
      numericalConfirmed: false,
      needsReview: true // Always requires teacher verification before publishing
    };

    if (acceptedRange !== undefined) {
      normalized.acceptedRange = acceptedRange;
    }

    return normalized;
  });

  return {
    testTitle: parsed.testTitle || "Mathematics Test Paper",
    questions
  };
}

// Validate shape & invariants of parsed JSON structure
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

// POST /api/parse-question with Automatic Key Fallback & Failover
router.post('/parse-question', async (req, res) => {
  const { type, rawText, imageBase64, mediaType, mediaFiles, docxStructure } = req.body;

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Build candidate provider queue
  const providers = [];
  if (isKeyValid(geminiKey)) {
    providers.push({ name: 'gemini', key: geminiKey });
  }
  if (isKeyValid(anthropicKey)) {
    providers.push({ name: 'anthropic', key: anthropicKey });
  }

  const effectiveMediaFiles = (Array.isArray(mediaFiles) && mediaFiles.length > 0)
    ? mediaFiles
    : (imageBase64 ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }] : []);

  // Stage 1: Deterministic Layout & Candidate Figure Extraction (Zero AI)
  const candidateFigures = await extractCandidateFigures(effectiveMediaFiles);

  // Chunk media files into smaller batches (1 page on Vercel to prevent 504 Gateway Timeout)
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
  const chunkSize = isVercel ? 1 : 2;
  const mediaChunks = (type === 'image' || type === 'media')
    ? await chunkMediaFiles(effectiveMediaFiles, chunkSize)
    : [[{ type, rawText, docxStructure }]];

  console.log(`[Parser] Prepared ${mediaChunks.length} chunk(s) for parsing (${effectiveMediaFiles.length} file(s) total, chunk size ${chunkSize}).`);

  const errors = [];

  // Try each configured API provider sequentially
  for (const provider of providers) {
    try {
      let aggregatedQuestions = [];
      let masterTestTitle = 'Mathematics Test Paper';

      for (let chunkIdx = 0; chunkIdx < mediaChunks.length; chunkIdx++) {
        const chunk = mediaChunks[chunkIdx];
        console.log(`[Parser Chunk ${chunkIdx + 1}/${mediaChunks.length}] Attempting parsing via ${provider.name}...`);

        let parsedChunkData;
        if (provider.name === 'gemini') {
          const activeModel = getGeminiModelName();
          console.log(`[Parser] Attempting Gemini API (${activeModel}) for chunk ${chunkIdx + 1}...`);
          parsedChunkData = await parseWithGemini({
            geminiKey: provider.key,
            type,
            rawText,
            imageBase64,
            mediaType,
            mediaFiles: chunk,
            docxStructure
          });
        } else if (provider.name === 'anthropic') {
          console.log(`[Parser] Attempting Anthropic Claude API for chunk ${chunkIdx + 1}...`);
          parsedChunkData = await parseWithClaude({
            anthropicKey: provider.key,
            type,
            rawText,
            imageBase64,
            mediaType,
            mediaFiles: chunk,
            docxStructure
          });
        }

        if (parsedChunkData && parsedChunkData.testTitle && parsedChunkData.testTitle !== 'Mathematics Test Paper') {
          masterTestTitle = parsedChunkData.testTitle;
        }

        if (parsedChunkData && Array.isArray(parsedChunkData.questions)) {
          // Remap diagram sourceFileIndex and pageIndex relative to original effectiveMediaFiles array
          const remappedChunkQuestions = parsedChunkData.questions.map((q) => {
            if (Array.isArray(q.diagrams)) {
              q.diagrams = q.diagrams.map(diag => {
                const chunkItem = (typeof diag.sourceFileIndex === 'number' && chunk[diag.sourceFileIndex])
                  ? chunk[diag.sourceFileIndex]
                  : chunk[0];
                return {
                  ...diag,
                  sourceFileIndex: (chunkItem && typeof chunkItem.sourceFileIndex === 'number') ? chunkItem.sourceFileIndex : 0,
                  pageIndex: (chunkItem && typeof chunkItem.pageIndex === 'number') ? chunkItem.pageIndex : (diag.pageIndex || 0)
                };
              });
            }
            return q;
          });

          aggregatedQuestions.push(...remappedChunkQuestions);
        }
      }

      // Re-index all aggregated questions cleanly: q1, q2, ... qN
      aggregatedQuestions = aggregatedQuestions.map((q, idx) => ({
        ...q,
        id: `q${idx + 1}`
      }));

      const combinedData = {
        testTitle: masterTestTitle,
        questions: aggregatedQuestions
      };

      if (combinedData.questions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No exam questions could be extracted from the uploaded document. If uploading a PDF, please select pages containing questions rather than cover pages.'
        });
      }

      if (!validateJsonSchema(combinedData)) {
        throw new Error(`${provider.name} response failed JSON schema shape validation after aggregation`);
      }

      try {
        // Stage 3: Spatial & Semantic Diagram Matcher
        combinedData.questions = await matchDiagramsToQuestions(combinedData.questions, candidateFigures, effectiveMediaFiles);
      } catch (diagErr) {
        console.warn('[Diagram matcher skipped]:', diagErr.message);
      }

      return res.json({ success: true, data: combinedData, mode: `live_${provider.name}` });

    } catch (err) {
      console.warn(`[Parser Warning] Provider ${provider.name} failed: ${err.message}. Trying next provider...`);
      errors.push({ provider: provider.name, error: err.message });
    }
  }

  // If API keys were provided but failed, return explicit error details to client instead of silent fallback
  if (providers.length > 0) {
    const errDetails = errors.map(e => `[${e.provider}]: ${e.error}`).join(' | ');
    console.error(`[Parser Error] All API providers failed: ${errDetails}`);
    return res.status(500).json({
      success: false,
      error: `AI Vision Transcription failed: ${errDetails}. Please check your API key in Vercel Environment Variables.`
    });
  }

  // If no keys configured at all, return clear missing key error
  return res.status(400).json({
    success: false,
    error: 'No GEMINI_API_KEY configured in server environment variables. Please add GEMINI_API_KEY in Vercel Project Settings.'
  });
});




// Google Gemini Parser Implementation (Native PDF & Multi-Image support)
async function parseWithGemini({ geminiKey, type, rawText, imageBase64, mediaType, mediaFiles, docxStructure }) {
  const genAI = new GoogleGenerativeAI(geminiKey);
  const modelName = getGeminiModelName();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  });

  let promptParts = [SYSTEM_PROMPT];

  if (type === 'text') {
    promptParts.push(`Convert this teacher input into the math test catalogue JSON schema:\n\n"${rawText}"`);
  } else if (type === 'image' || type === 'media') {
    // Process array of media files (Images or PDFs)
    const filesToProcess = Array.isArray(mediaFiles) && mediaFiles.length > 0
      ? mediaFiles
      : (imageBase64 ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }] : []);

    filesToProcess.forEach((file) => {
      const rawData = file.data || file.base64 || file.imageBase64;
      promptParts.push({
        inlineData: {
          data: stripBase64Header(rawData),
          mimeType: file.mimeType || file.mediaType || 'image/jpeg'
        }
      });
    });

    promptParts.push(
      `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. ` +
      `Extract every numbered question into its own distinct question block with questionText, type, options, correctAnswer, and diagrams. ` +
      DIAGRAM_PROMPT_INSTRUCTION
    );
  } else if (type === 'docx_structure') {
    promptParts.push(`Here is extracted text and formulas from a Word document:\n\n${JSON.stringify(docxStructure, null, 2)}\n\nFormat this into the test questions array schema.`);
  }

  const result = await model.generateContent(promptParts);
  const responseText = result.response.text();
  console.log('[Gemini Response Raw]:', responseText ? responseText.substring(0, 200) + '...' : 'EMPTY');

  const parsedData = extractAndParseJson(responseText);
  console.log('[Parser Info] Normalized questions parsed:', JSON.stringify(parsedData ? parsedData.questions : null, null, 2));
  return parsedData;
}

// Anthropic Claude Parser Implementation (PDF Document & Multi-Image support)
async function parseWithClaude({ anthropicKey, type, rawText, imageBase64, mediaType, mediaFiles, docxStructure }) {
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let messages = [];

  if (type === 'text') {
    messages = [{ role: 'user', content: `Convert this teacher input into the math test catalogue JSON schema:\n\n"${rawText}"` }];
  } else if (type === 'image' || type === 'media') {
    const filesToProcess = Array.isArray(mediaFiles) && mediaFiles.length > 0
      ? mediaFiles
      : (imageBase64 ? [{ data: imageBase64, mimeType: mediaType || 'image/jpeg' }] : []);

    const contentBlocks = [];

    filesToProcess.forEach(file => {
      const mime = file.mimeType || file.mediaType || 'image/jpeg';
      const rawData = file.data || file.base64 || file.imageBase64;
      const cleanData = stripBase64Header(rawData);

      if (mime === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: cleanData }
        });
      } else {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: mime, data: cleanData }
        });
      }
    });

    contentBlocks.push({
      type: 'text',
      text: `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. Extract every numbered question into its own distinct question block with questionText, type, options, correctAnswer, and diagrams. ${DIAGRAM_PROMPT_INSTRUCTION}`
    });


    messages = [{ role: 'user', content: contentBlocks }];
  } else if (type === 'docx_structure') {
    messages = [{ role: 'user', content: `Here is extracted text and formulas from a Word document:\n\n${JSON.stringify(docxStructure, null, 2)}\n\nFormat this into the test questions array schema.` }];
  }

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages
  });

  const responseText = response.content[0]?.text || '';
  console.log('[Claude Response Raw]:', responseText ? responseText.substring(0, 200) + '...' : 'EMPTY');

  const parsedData = extractAndParseJson(responseText);
  return parsedData;
}

module.exports = router;
module.exports.validateJsonSchema = validateJsonSchema;
module.exports.extractAndParseJson = extractAndParseJson;
module.exports.repairTruncatedJson = repairTruncatedJson;
