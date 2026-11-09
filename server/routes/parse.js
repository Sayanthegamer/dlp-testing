const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { stripBase64Header } = require('../services/diagramCropService');
const { extractCandidateFigures } = require('../services/layoutExtractorService');
const { matchDiagramsToQuestions } = require('../services/diagramMatcherService');
const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');

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
2. NO LITERAL "\\n" IN STRINGS: Do not put literal "\\n" string characters inside JSON string values. Replace all line breaks with clean space separators.
3. MATH TAG BOUNDARIES: Wrap mathematical formulas, equations, variables, chemical notation, physical units, matrices, and math symbols in <math>...</math> tags (e.g. <math>x^2 + 2x - 3 = 0</math>, <math>\\frac{a}{b}</math>, <math>x</math>).
   - NEVER put plain English sentences, problem instructions, question numbers ("Question 1"), or option letters ("Option A") inside <math> tags.
   - For options with plain English words like "4 times" or "16 times", write "<math>4</math> times" or "<math>4 \\text{ times}</math>" — NEVER write "\\\\text" (double LaTeX backslash) or "\\text{\\times}".
4. LATEX BACKSLASHES: Inside <math>...</math>, use standard single LaTeX commands (\frac{num}{den}, \sqrt{x}, \pi, \alpha, \times, \text{...}, \pu{...}, \ce{...}). Never use double LaTeX backslashes (\\\\frac or \\\\text) inside <math> spans, as \\\\ is a line break in KaTeX.
5. BRACE DISCIPLINE: Always enclose multi-character superscripts/subscripts in curly braces (<math>x^{10}</math>, <math>a_{12}</math>), and ALWAYS use explicit curly braces around BOTH numerator and denominator (<math>\\frac{N_p}{N_s}</math> — NEVER write bare fracN_pN_s) and radicals (<math>\\sqrt{expression}</math>).
6. FUNCTIONS & SYMBOLS: Precede standard function names with a backslash (\\sin, \\cos, \\tan, \\cot, \\sec, \\csc, \\log, \\ln, \\lim, \\max, \\min, \\det, \\deg).
7. CHEMISTRY & REACTION NOTATION: Wrap chemical formulas, balanced reactions, state symbols, ionic charges, and nuclear isotopes in <math>\\ce{...}</math> using mhchem syntax.
8. PHYSICAL QUANTITIES WITH UNITS: Wrap value+unit pairs in <math>\\pu{...}</math> (e.g. <math>\\pu{9.8 m/s^2}</math>, <math>\\pu{50 \\Omega}</math>, <math>\\pu{4 V/m}</math>).
9. PERMUTATIONS & COMBINATIONS: Use custom macros <math>\\nCr{n}{r}</math> and <math>\\nPr{n}{r}</math>.
10. QUESTION TYPES & ANSWERS:
   - For MCQ: set "type": "mcq", ALWAYS populate "options" with all 4 option strings from the question, and set "correctAnswer" as the 0-indexed integer (0 for A, 1 for B, 2 for C, 3 for D) ONLY if explicitly stated in the source; otherwise set null.
   - For Numerical: set "type": "short_answer_numeric", "options": [], and provide an estimated numeric float/integer "correctAnswer" and "acceptedRange": [min, max].
   - Match the Following: set "type": "match_following" with combination choices in "options".
11. DIAGRAMS: Bounding boxes for visual diagrams belong in the "diagrams" array as normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 on sourceFileIndex.
12. SUBPARTS DISAGGREGATION: Extract multi-part sub-questions into DISTINCT individual question objects in the "questions" array.
13. ABSOLUTELY NO FAKE XML TAGS: <math>...</math> is the ONLY allowed XML tag format.
14. ABSOLUTELY NO RAW MATHML TAGS: Always output standard KaTeX LaTeX inside <math>...</math> tags.
15. HARD STOP ON ANSWERS AND SOLUTIONS SECTION: Stop extracting questions if you reach an "ANSWERS AND SOLUTIONS", "HINTS & SOLUTIONS", or "ANSWER KEY" section.
16. OUTPUT FORMAT: Return ONLY valid JSON matching the schema. Do NOT wrap in markdown code blocks.`;

const DIAGRAM_PROMPT_INSTRUCTION = `CRITICAL DIAGRAM INSTRUCTION: IF and ONLY IF a question contains a visual diagram, circuit, figure, graph, organic structure, or apparatus drawing in the source image, YOU MUST INCLUDE a "diagrams" array for that question containing {"id": "diag_1", "sourceFileIndex": 0, "pageIndex": 0, "bbox": [ymin, xmin, ymax, xmax], "caption": "description"}, where bbox contains 4 normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 tightly bounding the diagram area and labels on sourceFileIndex. DO NOT output diagrams array for text-only questions without visual figures.`;

function isKeyValid(key) {
  return typeof key === 'string' && key.trim().length > 5 && !key.includes('your_');
}

/**
 * Deterministic Smart Demo Fallback Parser when no AI API keys are configured.
 * Converts informal math text, docx structures, or demo image uploads into valid typeset questions.
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

  // Image / PDF fallback
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
      try {
        const { getPdfJsLib, rasterizePdfPage } = require('../services/diagramCropService');
        const pdfjsLib = await getPdfJsLib();
        if (pdfjsLib) {
          const pdfBuffer = Buffer.from(cleanStr, 'base64');
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;

          if (numPages > maxPagesPerChunk) {
            for (let p = 0; p < numPages; p++) {
              try {
                const pageBuffer = await rasterizePdfPage(cleanStr, p);
                processedItems.push({
                  data: pageBuffer.toString('base64'),
                  mimeType: 'image/png',
                  sourceFileIndex: fileIdx,
                  pageIndex: p,
                  name: `${file.name || 'document'}_page_${p + 1}`,
                });
              } catch (_) {
                processedItems.push({ ...file, sourceFileIndex: fileIdx, pageIndex: p });
              }
            }
            continue;
          }
        }
      } catch (_) {}
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

/**
 * Repairs unescaped single backslashes inside JSON string values WITHOUT doubling
 * already-escaped `\\` pairs.
 *
 * Root Cause Fixed: Previously, `/\\(?=[a-zA-Z])/g` lacked a single-pass `\\\\` consumer,
 * so valid JSON `"\\text"` had its second backslash doubled to `"\\\text"`, triggering
 * fallback quadruple-escaping into `"\\\\text"` (`\\text` in KaTeX = newline + "text").
 */
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

  // Restore literal control characters that may already be present in raw strings
  clean = clean
    .replace(/\x09(ext(?:bf|it|rm)?|imes|heta|au|anh?|o\b|op\b|riangle|ilde|frac|iny)/g, '\\\\t$1')
    .replace(/\x0C(rac|orall|lat|rown)/g, '\\\\f$1')
    .replace(/\x0A(Cr|Pr|eq|eg|u\b|abla|otsubset|ot\b|i\b|ewline|ormalsize)/g, '\\\\n$1')
    .replace(/\x0D(ho|ight|angle|ceil|floor)/g, '\\\\r$1')
    .replace(/\x08(eta|ar|inom|egin|ig|ullet|ox|ot\b|ackslash)/g, '\\\\b$1');

  clean = clean.replace(/("(?:[^"\\]|\\.)*")/g, (token) => {
    let inner = token.replace(
      /\\\\|\\(["\/])|\\u[0-9a-fA-F]{4}|\\([bfnrt])([a-zA-Z]*)|\\(?=[a-zA-Z\{\}\_\^\%\#\$\&\s])/g,
      (match, quoteOrSlash, ctrlChar, ctrlSuffix) => {
        // 1. Already-escaped pair `\\` -> preserve as `\\` (never double it!)
        if (match === '\\\\') return '\\\\';
        // 2. Standard JSON escapes `\"`, `\/`, `\uXXXX` -> preserve as is
        if (quoteOrSlash || match.startsWith('\\u')) return match;
        // 3. `\b`, `\f`, `\n`, `\r`, `\t` followed by command letters (e.g. \frac, \text, \times, \theta, \nCr, \rho, \beta)
        if (ctrlChar) {
          if (ctrlSuffix && ctrlSuffix.length > 0) {
            return '\\\\' + ctrlChar + ctrlSuffix;
          }
          return match;
        }
        // 4. Single unescaped backslash before a LaTeX command/symbol -> escape to `\\`
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
 * Extracts inline options (e.g. `(A) ... (B) ... (C) ... (D) ...` or `(1) ... (2) ... (3) ... (4) ...`)
 * from `questionText` if the LLM left `options` empty on an MCQ question.
 */
function splitInlineOptionsIfMissing(questionText, existingOptions) {
  if (Array.isArray(existingOptions) && existingOptions.length >= 2) {
    return { stem: questionText, options: existingOptions };
  }
  if (typeof questionText !== 'string') {
    return { stem: questionText, options: existingOptions || [] };
  }

  // Match (A) ... (B) ... (C) ... (D) ... or A) ... B) ... C) ... D) ...
  const letterPattern = /\s+(?:\([A-Da-d]\)|[A-Da-d][\)\.])\s+/g;
  const matches = [...questionText.matchAll(letterPattern)];
  if (matches.length >= 2) {
    const firstIdx = matches[0].index;
    const stem = questionText.substring(0, firstIdx).trim();
    const extracted = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : questionText.length;
      const optText = questionText.substring(start, end).trim();
      if (optText) extracted.push(optText);
    }
    if (stem && extracted.length >= 2) {
      return { stem, options: extracted };
    }
  }

  return { stem: questionText, options: existingOptions || [] };
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
        // Only escape single unescaped backslashes `(?<!\\)\\(?!\\)` so existing `\\` are never quadrupled
        const safeFallback = clean.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
          return match.replace(/\\\\|\\/g, (m) => (m === '\\\\' ? '\\\\' : '\\\\'));
        });
        parsed = JSON.parse(repairTruncatedJson(safeFallback));
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

  const solutionHeaderIdx = questions.findIndex(q => {
    const text = (q.questionText || '').trim();
    return /^(?:ANSWERS?\s*(?:AND|&)?\s*SOLUTIONS?|HINTS?\s*(?:AND|&)?\s*SOLUTIONS?|ANSWER\s*KEY)\b/i.test(text);
  });

  if (solutionHeaderIdx >= 0) {
    questions = questions.slice(0, solutionHeaderIdx);
  }

  questions = questions.filter(q => {
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
    let rawQuestionText = (q.questionText || `Question ${idx + 1}`).replace(
      /\n(?!(?:Cr|Pr|u|abla|eq|eg|ewline|otsubset|ot|i|n|ormalsize)\b)/gi,
      ' '
    );
    const originalRaw = rawQuestionText;

    const cleanedText = rawQuestionText
      .replace(/^(?:Q\d+|Question\s*\d+)[\.\:]\s*(?:JEE\s*Main[^\n\r]*[\n\r]*)?/i, '')
      .trim();
    if (cleanedText.length > 0) {
      rawQuestionText = cleanedText;
    } else if (originalRaw.trim().length > 0) {
      rawQuestionText = originalRaw.trim();
    }

    const splitResult = splitInlineOptionsIfMissing(rawQuestionText, q.options);
    rawQuestionText = splitResult.stem;
    const rawOptionsList = splitResult.options;

    let questionText = repairMissingMathBackslashes(rawQuestionText).trim();
    if (!questionText) {
      questionText = `Question ${idx + 1}`;
    }

    let type = q.type;
    if (type !== 'mcq' && type !== 'match_following') {
      type = 'short_answer_numeric';
    }

    const cleanOptions = (Array.isArray(rawOptionsList) ? rawOptionsList : []).map(opt =>
      repairMissingMathBackslashes(typeof opt === 'string' ? opt : String(opt))
    );

    const options = type === 'mcq' || type === 'match_following' ? cleanOptions : [];

    const mathMatches = (questionText + ' ' + options.join(' ')).match(/<math>(.*?)<\/math>/g) || [];
    const mathSpans = mathMatches.map(m => m.replace(/<\/?math>/g, ''));

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

  // If no API keys are configured, run Smart Demo Fallback Mode so teachers can test offline
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

  // Process 1 page per chunk so dense multi-question PDF pages never exceed model output token limits
  const chunkSize = 1;
  const mediaChunks =
    type === 'image' || type === 'media'
      ? await chunkMediaFiles(effectiveMediaFiles, chunkSize)
      : [[{ type, rawText, docxStructure }]];

  const errors = [];

  for (const provider of providers) {
    try {
      let aggregatedQuestions = [];
      let masterTestTitle = 'Mathematics Test Paper';

      const chunkPromises = mediaChunks.map(async (chunk) => {
        let parsedChunkData = null;
        if (provider.name === 'gemini') {
          parsedChunkData = await parseWithGemini({
            geminiKey: provider.key,
            type,
            rawText,
            imageBase64,
            mediaType,
            mediaFiles: chunk,
            docxStructure,
          });
        } else if (provider.name === 'anthropic') {
          parsedChunkData = await parseWithClaude({
            anthropicKey: provider.key,
            type,
            rawText,
            imageBase64,
            mediaType,
            mediaFiles: chunk,
            docxStructure,
          });
        }
        return { chunk, parsedChunkData };
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const { chunk, parsedChunkData } of chunkResults) {
        if (
          parsedChunkData &&
          parsedChunkData.testTitle &&
          parsedChunkData.testTitle !== 'Mathematics Test Paper'
        ) {
          masterTestTitle = parsedChunkData.testTitle;
        }

        if (parsedChunkData && Array.isArray(parsedChunkData.questions)) {
          const remappedChunkQuestions = parsedChunkData.questions.map((q) => {
            if (Array.isArray(q.diagrams)) {
              q.diagrams = q.diagrams.map(diag => {
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
            return q;
          });

          aggregatedQuestions.push(...remappedChunkQuestions);
        }
      }

      aggregatedQuestions = aggregatedQuestions.map((q, idx) => ({
        ...q,
        id: `q${idx + 1}`,
      }));

      const combinedData = {
        testTitle: masterTestTitle,
        questions: aggregatedQuestions,
      };

      if (combinedData.questions.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            'No exam questions could be extracted from the uploaded document. Select pages containing numbered questions.',
        });
      }

      if (!validateJsonSchema(combinedData)) {
        throw new Error(`${provider.name} response failed JSON schema shape validation after aggregation`);
      }

      try {
        combinedData.questions = await matchDiagramsToQuestions(
          combinedData.questions,
          candidateFigures,
          effectiveMediaFiles
        );
      } catch (_) {}

      return res.json({ success: true, data: combinedData, mode: `live_${provider.name}` });
    } catch (err) {
      errors.push({ provider: provider.name, error: err.message });
    }
  }

  const errDetails = errors.map(e => `[${e.provider}]: ${e.error}`).join(' | ');
  return res.status(500).json({
    success: false,
    error: `AI transcription failed: ${errDetails}. Check your API key in environment settings.`,
  });
}

// Primary unified route + documented REST route aliases
router.post('/parse-question', (req, res) => handleParseRequest(req, res));
router.post('/parse-text', (req, res) => handleParseRequest(req, res, 'text'));
router.post('/parse-image', (req, res) => handleParseRequest(req, res, 'media'));
router.post('/parse-docx', (req, res) => handleParseRequest(req, res, 'docx_structure'));

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

    promptParts.push(
      `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. ` +
        `Extract every numbered question into its own distinct question block with questionText, type, options (all 4 options for MCQ), correctAnswer, and diagrams. ` +
        DIAGRAM_PROMPT_INSTRUCTION
    );
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

    filesToProcess.forEach(file => {
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
      text: `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. Extract every numbered question into its own distinct question block with questionText, type, options, correctAnswer, and diagrams. ${DIAGRAM_PROMPT_INSTRUCTION}`,
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
module.exports.buildSmartFallbackCatalogue = buildSmartFallbackCatalogue;
