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
const SYSTEM_PROMPT = `You are an expert math test parser for tuition teachers.
Your task is to parse input (informal text, photo of exam paper, or document structure) representing one or more math exam questions and convert them into strict JSON adhering to this exact schema format:

{
  "testTitle": "Mathematics Test Paper",
  "questions": [
    {
      "id": "q1",
      "questionText": "Solve for <math>x</math>: <math>x^2 + 2x - 3 = 0</math>",
      "type": "mcq",
      "options": ["<math>x = 1, -3</math>", "<math>x = -1, 3</math>", "<math>x = 2, -3</math>", "<math>x = -2, 1</math>"],
      "correctAnswer": 0,
      "confidenceScore": 0.95,
      "needsReview": false
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
      "confidenceScore": 0.92,
      "needsReview": false
    }
  ]
}

CRITICAL RULES:
1. <math>...</math> tags are ONLY for mathematical formulas, equations, variables, and math symbols (e.g. <math>x^2 + 2x - 3 = 0</math>, <math>\\frac{a}{b}</math>, <math>x</math>).
2. Do NOT place plain English text, computer science terms, or general option descriptions inside <math> tags.
3. If the input contains MULTIPLE questions (e.g. Question 1, Question 2...), extract ALL questions into the "questions" array.
4. For MCQ questions, populate "options" as an array of 4 option strings, and set "type": "mcq", with "correctAnswer" as the 0-indexed integer of the correct option if identifiable.
5. ALL non-MCQ questions MUST be "type": "short_answer_numeric". There are NO free-text subjective questions. The answer is ALWAYS a numerical value (integer or decimal from -infinity to +infinity).
6. ALWAYS SOLVE/ESTIMATE THE NUMERICAL ANSWER for numerical questions: output an estimated "correctAnswer" (numeric float/integer) AND a suggested "acceptedRange": [min, max] (e.g. [14.5, 15.5] or ±1% tolerance around the estimated answer).
7. Return ONLY valid JSON matching the schema. Do NOT wrap in markdown code blocks.
8. CHEMISTRY EQUATIONS & FORMULAS: wrap in <math>\\ce{...}</math> using mhchem syntax — balanced reactions, state symbols (s)/(l)/(g)/(aq), equilibrium arrows (<=>, <=>>), ionic charges (Fe^3+), coordination formulas ([Co(NH3)6]^3+).
9. NUCLEAR NOTATION (Chemistry radioactivity AND Physics Modern Physics): isotopes as <math>\\ce{^238_92U}</math> via mhchem — identical syntax serves both subjects.
10. PHYSICAL QUANTITIES WITH UNITS (Physics): wrap value+unit pairs in <math>\\pu{...}</math>, e.g. <math>\\pu{9.8 m/s^2}</math>, <math>\\pu{6.63e-34 J s}</math>.
11. PERMUTATIONS/COMBINATIONS (Math Algebra): use <math>\\nCr{n}{r}</math> / <math>\\nPr{n}{r}</math> custom macros, not raw \\binom.
12. STRUCTURAL/GEOMETRIC CONTENT — NEVER put these in <math> tags, even though they look chemistry/physics-related: benzene rings and other skeletal structures, wedge-dash stereochemistry, VSEPR 3D molecular shapes, reaction mechanism arrows, orbital shape diagrams (s/p/d), circuit diagrams, apparatus drawings, graphs/plots. These belong in the "diagrams" array as a bounding box on the source image — never as attempted LaTeX/mhchem text.
14. MATCH THE FOLLOWING QUESTIONS: If the input contains a "Match the Following" question (matching Column I items with Column II items), format Column I and Column II cleanly in "questionText" as a structured 2-column list or table. Set "type": "match_following" (or "mcq"), and provide the matching combination choices (e.g. ["A: (i)-p, (ii)-q, (iii)-r, (iv)-s", ...]) in the "options" array.
15. PASSAGE-BASED / COMPREHENSION QUESTIONS: If a question (or group of questions) relies on a preceding reading passage, case study, or shared paragraph, populate "passageTitle" (e.g. "Passage 1: Case Study") and "passageText" (the complete paragraph text) on each related question object.
16. LATEX BACKSLASH & SPACING DISCIPLINE: Every LaTeX command inside <math> tags MUST include its leading backslash and proper braces — NEVER emit bare command words run together with variables. WRONG: "frac3pilambdar8". CORRECT: "\\frac{3\\pi\\lambda r}{8}". Always wrap numerator/denominator in \\frac{...}{...} with explicit braces, always precede pi/lambda/theta/alpha/etc. with a backslash, and always insert a space or brace boundary between a command and the variable that follows it (e.g. "\\pi r" not "\\pir", "\\lambda r" not "\\lambdar"). If you are unsure whether a symbol needs a backslash, default to including it — a missing backslash silently renders as plain italic letters with no error, which is worse than an occasional harmless extra backslash.`;

const DIAGRAM_PROMPT_INSTRUCTION = `CRITICAL DIAGRAM INSTRUCTION: IF and ONLY IF a question contains a visual diagram, circuit, figure, graph, organic structure, or apparatus drawing in the source image, YOU MUST INCLUDE a "diagrams" array for that question containing {"id": "diag_1", "sourceFileIndex": 0, "pageIndex": 0, "bbox": [ymin, xmin, ymax, xmax], "caption": "description"}, where bbox contains 4 normalized floats [ymin, xmin, ymax, xmax] between 0.0 and 1.0 tightly bounding the diagram area and labels on sourceFileIndex. DO NOT output diagrams array for text-only questions without visual figures.`;

const { hasBareCommandRun, repairMissingMathBackslashes } = require('../services/mathSanitizerService');






function isKeyValid(key) {
  return typeof key === 'string' && key.trim().length > 5 && !key.includes('your_');
}

function repairJsonUnescapedBackslashes(str) {
  if (typeof str !== 'string') return str;
  let clean = str.trim();

  // 1. Escape unescaped single backslashes in JSON strings (LaTeX backslashes)
  // Valid JSON escape sequences are: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
  // Replace any single backslash that is not a valid JSON escape sequence with \\
  clean = clean.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  // 2. Sanitize unescaped control characters (newlines, tabs) inside strings
  clean = clean.replace(/[\u0000-\u001F]/g, (c) => {
    if (c === '\n') return '\\n';
    if (c === '\r') return '\\r';
    if (c === '\t') return '\\t';
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });

  return clean;
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

  // Find first '{' and last '}'
  const startIdx = clean.indexOf('{');
  const endIdx = clean.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    clean = clean.substring(startIdx, endIdx + 1);
  }

  let parsed;
  try {
    // Attempt 1: Direct JSON parse
    parsed = JSON.parse(clean);
  } catch (err1) {
    console.warn('[Parser Repair 1/3] Direct JSON.parse failed:', err1.message, '- Attempting LaTeX backslash repair...');
    try {
      // Attempt 2: LaTeX backslash & control char repair
      const repaired = repairJsonUnescapedBackslashes(clean);
      parsed = JSON.parse(repaired);
    } catch (err2) {
      console.warn('[Parser Repair 2/3] Sanitized parse failed:', err2.message, '- Attempting aggressive string escape repair...');
      try {
        // Attempt 3: Aggressive JSON string content escape
        const aggressive = clean.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
          return match.replace(/\\/g, '\\\\');
        });
        parsed = JSON.parse(aggressive);
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

  // Normalize each question

  questions = questions.map((q, idx) => {
    const rawQuestionText = q.questionText || `Question ${idx + 1}`;
    const questionText = repairMissingMathBackslashes(rawQuestionText);

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
      const numVal = parseFloat(q.correctAnswer);
      correctAnswer = !isNaN(numVal) ? numVal : q.correctAnswer;
    }

    // Preserve or generate estimated acceptedRange for numerical questions
    let acceptedRange = undefined;
    if (type === 'short_answer_numeric') {
      if (Array.isArray(q.acceptedRange) && q.acceptedRange.length === 2 &&
          typeof q.acceptedRange[0] === 'number' && typeof q.acceptedRange[1] === 'number') {
        acceptedRange = q.acceptedRange;
      } else if (typeof correctAnswer === 'number' && Number.isFinite(correctAnswer)) {
        // Suggested range around the estimated answer (e.g. ±0.5 or exact)
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

  const validTypes = new Set(['mcq', 'short_answer_numeric', 'match_following']);

  for (const q of data.questions) {
    if (!q || typeof q !== 'object') return false;
    if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) return false;

    // Type invariant: must be mcq, short_answer_numeric, or match_following
    if (!validTypes.has(q.type)) return false;

    // Reject malformed LaTeX bare command runs (missing leading backslash)
    if (hasBareCommandRun(q.questionText)) return false;
    if (Array.isArray(q.options) && q.options.some(opt => hasBareCommandRun(typeof opt === 'string' ? opt : ''))) {
      return false;
    }


    // MCQ & match_following invariants
    if (q.type === 'mcq' || q.type === 'match_following') {
      if (!Array.isArray(q.options) || q.options.length < 2) return false;
      if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
        if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
          return false;
        }
      }
    }

    // short_answer_numeric invariants
    if (q.type === 'short_answer_numeric') {
      if (Array.isArray(q.options) && q.options.length > 0) return false;
      if (q.acceptedRange !== undefined && q.acceptedRange !== null) {
        if (!Array.isArray(q.acceptedRange) || q.acceptedRange.length !== 2) return false;
        const [rMin, rMax] = q.acceptedRange.map(Number);
        if (!Number.isFinite(rMin) || !Number.isFinite(rMax) || rMin > rMax) return false;
      }
    }

    // Diagrams invariants
    if (Array.isArray(q.diagrams)) {
      for (const diag of q.diagrams) {
        if (!diag || typeof diag !== 'object') return false;
        if (!Array.isArray(diag.bbox) || diag.bbox.length !== 4) return false;
        if (diag.bbox.some(v => typeof v !== 'number' || isNaN(v) || v < 0.0 || v > 1.0)) {
          return false;
        }
      }
    }
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

  const errors = [];

  // Try each configured API provider sequentially
  for (const provider of providers) {
    try {
      if (provider.name === 'gemini') {
        const activeModel = getGeminiModelName();
        console.log(`[Parser] Attempting Gemini API (${activeModel}) for multi-media/PDF...`);
        const data = await parseWithGemini({
          geminiKey: provider.key,
          type,
          rawText,
          imageBase64,
          mediaType,
          mediaFiles: effectiveMediaFiles,
          docxStructure
        });
        if (!validateJsonSchema(data)) {
          throw new Error('Gemini response failed JSON schema shape validation');
        }
        if (Array.isArray(data.questions)) {
          try {
            // Stage 3: Spatial & Semantic Diagram Matcher
            data.questions = await matchDiagramsToQuestions(data.questions, candidateFigures, effectiveMediaFiles);
          } catch (diagErr) {
            console.warn('[Diagram matcher skipped]:', diagErr.message);
          }
        }
        return res.json({ success: true, data, mode: 'live_gemini' });
      }

      if (provider.name === 'anthropic') {
        console.log('[Parser] Attempting Anthropic Claude API for multi-media/PDF...');
        const data = await parseWithClaude({
          anthropicKey: provider.key,
          type,
          rawText,
          imageBase64,
          mediaType,
          mediaFiles: effectiveMediaFiles,
          docxStructure
        });
        if (!validateJsonSchema(data)) {
          throw new Error('Claude response failed JSON schema shape validation');
        }
        if (Array.isArray(data.questions)) {
          try {
            // Stage 3: Spatial & Semantic Diagram Matcher
            data.questions = await matchDiagramsToQuestions(data.questions, candidateFigures, effectiveMediaFiles);
          } catch (diagErr) {
            console.warn('[Diagram matcher skipped]:', diagErr.message);
          }
        }
        return res.json({ success: true, data, mode: 'live_anthropic' });
      }
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
      maxOutputTokens: 16384
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
