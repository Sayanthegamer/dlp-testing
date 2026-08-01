const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { attachCroppedDiagrams } = require('../services/diagramCropService');

const SYSTEM_PROMPT = `You are an expert math test parser for tuition teachers.
Your task is to parse input (informal text, photo of exam paper, or document structure) representing one or more math exam questions and convert them into strict JSON adhering to this exact schema:

{
  "testTitle": "Mathematics Test Paper",
  "questions": [
    {
      "id": "q1",
      "questionText": "Question stem text with math enclosed in <math>LaTeX</math> tags. E.g. Solve for x: <math>x^2 + 2x - 3 = 0</math>",
      "type": "mcq",
      "options": ["<math>Option A</math>", "<math>Option B</math>", "<math>Option C</math>", "<math>Option D</math>"],
      "correctAnswer": 0,
      "acceptedRange": [1.99, 2.01],
      "diagrams": [
        {
          "id": "diag_1",
          "sourceFileIndex": 0,
          "pageIndex": 0,
          "bbox": [0.10, 0.20, 0.40, 0.30],
          "caption": "Circuit Diagram / Figure"
        }
      ],
      "mathSpans": ["x^2 + 2x - 3 = 0"],
      "confidenceScore": 0.95,
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
8. CHEMISTRY EQUATIONS & FORMULAS: wrap in <math>\ce{...}</math> using mhchem syntax — balanced reactions, state symbols (s)/(l)/(g)/(aq), equilibrium arrows (<=>, <=>>), ionic charges (Fe^3+), coordination formulas ([Co(NH3)6]^3+).
9. NUCLEAR NOTATION (Chemistry radioactivity AND Physics Modern Physics): isotopes as <math>\ce{^238_92U}</math> via mhchem — identical syntax serves both subjects.
10. PHYSICAL QUANTITIES WITH UNITS (Physics): wrap value+unit pairs in <math>\pu{...}</math>, e.g. <math>\pu{9.8 m/s^2}</math>, <math>\pu{6.63e-34 J s}</math>.
11. PERMUTATIONS/COMBINATIONS (Math Algebra): use <math>\nCr{n}{r}</math> / <math>\nPr{n}{r}</math> custom macros, not raw \binom.
12. STRUCTURAL/GEOMETRIC CONTENT — NEVER put these in <math> tags, even though they look chemistry/physics-related: benzene rings and other skeletal structures, wedge-dash stereochemistry, VSEPR 3D molecular shapes, reaction mechanism arrows, orbital shape diagrams (s/p/d), circuit diagrams, apparatus drawings, graphs/plots. These belong in the "diagrams" array as a bounding box on the source image — never as attempted LaTeX/mhchem text.
13. DIAGRAM BOUNDING BOXES: Whenever a question contains a diagram, figure, circuit, benzene ring, or graph in the source image/page, populate the "diagrams" array with an object containing "bbox": [x, y, width, height] as normalized floats between 0.0 and 1.0 relative to sourceFileIndex image bounds.`;

function isKeyValid(key) {
  return typeof key === 'string' && key.trim().length > 5 && !key.includes('your_');
}

function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Received empty or invalid model response text');
  }

  let clean = text.trim();

  // Strip markdown code fences if present
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // Find first '{' and last '}'
  const startIdx = clean.indexOf('{');
  const endIdx = clean.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    clean = clean.substring(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(clean);

  // Handle single question vs multi-question catalogue
  let questions = [];
  if (Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  } else if (parsed.questionText) {
    questions = [parsed];
  } else {
    questions = [
      {
        id: "q1",
        questionText: "Sample Question: <math>x^2 + 2x - 3 = 0</math>",
        type: "mcq",
        options: ["<math>x = 1, -3</math>", "<math>x = -1, 3</math>", "<math>x = 2, -3</math>", "<math>x = -2, 1</math>"],
        correctAnswer: 0,
        mathSpans: ["x^2 + 2x - 3 = 0"],
        confidenceScore: 0.95,
        needsReview: false
      }
    ];
  }

  // Normalize each question
  questions = questions.map((q, idx) => {
    const questionText = q.questionText || `Question ${idx + 1}`;
    // Force non-MCQ questions to short_answer_numeric
    let type = q.type;
    if (type !== 'mcq') {
      type = 'short_answer_numeric';
    }
    const options = type === 'mcq' ? (Array.isArray(q.options) ? q.options : []) : [];
    
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

// Validate shape of parsed JSON structure
function validateJsonSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.testTitle && typeof data.testTitle !== 'string') return false;
  if (!Array.isArray(data.questions) || data.questions.length === 0) return false;
  
  for (const q of data.questions) {
    if (!q.questionText || typeof q.questionText !== 'string') return false;
    if (!Array.isArray(q.options)) return false;
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
          mediaFiles,
          docxStructure
        });
        if (!validateJsonSchema(data)) {
          throw new Error('Gemini response failed JSON schema shape validation');
        }
        if (Array.isArray(data.questions)) {
          try {
            data.questions = await attachCroppedDiagrams(data.questions, mediaFiles || []);
          } catch (diagErr) {
            console.warn('[Diagram attach skipped]:', diagErr.message);
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
          mediaFiles,
          docxStructure
        });
        if (!validateJsonSchema(data)) {
          throw new Error('Claude response failed JSON schema shape validation');
        }
        if (Array.isArray(data.questions)) {
          try {
            data.questions = await attachCroppedDiagrams(data.questions, mediaFiles || []);
          } catch (diagErr) {
            console.warn('[Diagram attach skipped]:', diagErr.message);
          }
        }
        return res.json({ success: true, data, mode: 'live_anthropic' });
      }
    } catch (err) {
      console.warn(`[Parser Warning] Provider ${provider.name} failed: ${err.message}. Trying next provider...`);
      errors.push({ provider: provider.name, error: err.message });
    }
  }

  // If API keys were provided but failed (e.g. rate limit / network error), log warning and gracefully fall back to Smart Demo Mode
  if (providers.length > 0) {
    const errDetails = errors.map(e => `[${e.provider}]: ${e.error}`).join(' | ');
    console.warn(`[Parser Warning] All API providers failed (${errDetails}). Falling back to Smart Demo Mode.`);
    const simulatedResult = generateLocalFallback(type, rawText, docxStructure);
    return res.json({
      success: true,
      data: simulatedResult,
      mode: 'demo_fallback',
      warning: `AI API call failed (${errDetails}). Served Smart Demo Fallback response.`
    });
  }

  // If no keys configured at all, gracefully fall back to local smart demo response
  console.log('[Parser Info] No API keys configured. Using Smart Demo Fallback.');
  const simulatedResult = generateLocalFallback(type, rawText, docxStructure);
  
  return res.json({
    success: true,
    data: simulatedResult,
    mode: 'demo_fallback'
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

    filesToProcess.forEach((file, index) => {
      promptParts.push({
        inlineData: {
          data: file.data || file.base64 || file.imageBase64,
          mimeType: file.mimeType || file.mediaType || 'image/jpeg'
        }
      });
    });

    promptParts.push(
      `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. ` +
      `Extract every numbered question (Question 1, Question 2, etc.) into its own distinct question block with questionText, type, options, and correctAnswer. ` +
      `Place all mathematical formulas and expressions inside <math>LaTeX</math> tags.`
    );
  } else if (type === 'docx_structure') {
    promptParts.push(`Here is extracted text and formulas from a Word document:\n\n${JSON.stringify(docxStructure, null, 2)}\n\nFormat this into the test questions array schema.`);
  }

  const result = await model.generateContent(promptParts);
  const responseText = result.response.text();
  console.log('[Gemini Response Raw]:', responseText ? responseText.substring(0, 200) + '...' : 'EMPTY');

  const parsedData = extractAndParseJson(responseText);
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
      const data = file.data || file.base64 || file.imageBase64;

      if (mime === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data }
        });
      } else {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: mime, data }
        });
      }
    });

    contentBlocks.push({
      type: 'text',
      text: `Transcribe all exam questions visible across ALL provided ${filesToProcess.length} media file(s)/pages/PDFs into separate objects in the "questions" array. Extract every numbered question (Question 1, Question 2, etc.) into its own distinct question block. Place all math inside <math>LaTeX</math> tags.`
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

// Heuristic fallback for demo testing without an API key
function generateLocalFallback(type, rawText = '', docxStructure = null) {
  if (type === 'docx_structure' && docxStructure) {
    return {
      testTitle: "Word Document Math Test",
      questions: [
        {
          id: "q_docx_1",
          questionText: docxStructure.questionText || "Extracted Docx Question: <math>x^2 + y^2 = r^2</math>",
          type: docxStructure.options && docxStructure.options.length > 0 ? "mcq" : "short_answer_numeric",
          options: docxStructure.options || ["<math>r = \\sqrt{x^2+y^2}</math>", "<math>r = x+y</math>", "<math>r = x^2</math>", "<math>r = y^2</math>"],
          correctAnswer: 0,
          mathSpans: docxStructure.mathSpans || ["x^2 + y^2 = r^2"],
          confidenceScore: 0.98,
          needsReview: false
        }
      ]
    };
  }

  return {
    testTitle: "Mathematics Practice Quiz",
    questions: [
      {
        id: "q_demo_1",
        questionText: "Solve for <math>x</math>: <math>x^2 + 2x - 3 = 0</math>",
        type: "mcq",
        options: ["<math>x = 1, -3</math>", "<math>x = -1, 3</math>", "<math>x = 2, -3</math>", "<math>x = -2, 1</math>"],
        correctAnswer: 0,
        mathSpans: ["x", "x^2 + 2x - 3 = 0", "x = 1, -3"],
        confidenceScore: 0.98,
        needsReview: false
      },
      {
        id: "q_demo_2",
        questionText: "Evaluate the definite integral: <math>\\int_{0}^{1} x^2 \\, dx</math>",
        type: "mcq",
        options: ["<math>\\frac{1}{3}</math>", "<math>\\frac{1}{2}</math>", "<math>1</math>", "<math>\\frac{2}{3}</math>"],
        correctAnswer: 0,
        mathSpans: ["\\int_{0}^{1} x^2 \\, dx", "\\frac{1}{3}"],
        confidenceScore: 0.96,
        needsReview: false
      }
    ]
  };
}

module.exports = router;
