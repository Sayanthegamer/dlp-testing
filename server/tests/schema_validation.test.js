import { describe, it, expect } from 'vitest';
import { validateJsonSchema } from '../routes/parse.js';

describe('Strict JSON Schema Invariant Validation', () => {
  it('should pass valid MCQ question without acceptedRange', () => {
    const validMcq = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q1',
          questionText: 'Solve for x',
          type: 'mcq',
          options: ['1', '2', '3', '4'],
          correctAnswer: 0
        }
      ]
    };
    expect(validateJsonSchema(validMcq)).toBe(true);
  });

  it('should pass valid numeric question with options: [] and valid acceptedRange', () => {
    const validNumeric = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q2',
          questionText: 'Calculate resistance',
          type: 'short_answer_numeric',
          options: [],
          correctAnswer: 15,
          acceptedRange: [14.5, 15.5]
        }
      ]
    };
    expect(validateJsonSchema(validNumeric)).toBe(true);
  });

  it('should reject missing or empty questions array', () => {
    expect(validateJsonSchema(null)).toBe(false);
    expect(validateJsonSchema({})).toBe(false);
    expect(validateJsonSchema({ questions: [] })).toBe(false);
  });

  it('should reject questions with empty or non-string questionText', () => {
    const invalidStem = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q1',
          questionText: '   ',
          type: 'mcq',
          options: ['1', '2', '3', '4']
        }
      ]
    };
    expect(validateJsonSchema(invalidStem)).toBe(false);
  });

  it('should pass valid match_following question type', () => {
    const validMatchFollowing = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q_mf1',
          questionText: 'Match the following quantities with their SI units',
          type: 'match_following',
          options: [
            'A: (i)-p, (ii)-q, (iii)-r, (iv)-s',
            'B: (i)-q, (ii)-p, (iii)-s, (iv)-r',
            'C: (i)-r, (ii)-s, (iii)-p, (iv)-q',
            'D: (i)-s, (ii)-r, (iii)-q, (iv)-p'
          ],
          correctAnswer: 0
        }
      ]
    };
    expect(validateJsonSchema(validMatchFollowing)).toBe(true);
  });

  it('should pass aggregated question list from multi-chunk batch parsing', () => {
    const chunk1Questions = Array.from({ length: 15 }, (_, i) => ({
      id: `q${i + 1}`,
      questionText: `Question ${i + 1}: Solve <math>\\frac{${i + 1}}{2}</math>`,
      type: 'mcq',
      options: ['1', '2', '3', '4'],
      correctAnswer: 0
    }));

    const chunk2Questions = Array.from({ length: 15 }, (_, i) => ({
      id: `q${i + 16}`,
      questionText: `Question ${i + 16}: Solve <math>\\sqrt{${i + 16}}</math>`,
      type: 'mcq',
      options: ['1', '2', '3', '4'],
      correctAnswer: 1
    }));

    const aggregatedPayload = {
      testTitle: 'Aggregated Math Exam (30 Questions)',
      questions: [...chunk1Questions, ...chunk2Questions]
    };

    expect(aggregatedPayload.questions.length).toBe(30);
    expect(validateJsonSchema(aggregatedPayload)).toBe(true);
  });

  it('should repair fake AI XML tags like <\\pu>50 V<\\pu> into <math>\\pu{50 V}</math>', () => {
    const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');
    const input = 'Calculate voltage <\\pu>50 V<\\pu> across resistor';
    const output = repairMissingMathBackslashes(input);
    expect(output).toBe('Calculate voltage <math>\\pu{50 V}</math> across resistor');
  });

  it('should convert raw MathML tags (<mn>50</mn><mo></mo><mi mathvariant="normal">V</mi>) into clean KaTeX \\pu{50 V}', () => {
    const { convertMathMLToKaTeX } = require('../services/mathSanitizerService');
    const rawMathML = 'A constant voltage of <mn>50</mn><mo></mo><mi mathvariant="normal">V</mi> is maintained between points <mi>a</mi> and <mi>b</mi>';
    const converted = convertMathMLToKaTeX(rawMathML);
    expect(converted).toContain('<math>\\pu{50 V}</math>');
    expect(converted).toContain('<math>a</math>');
    expect(converted).toContain('<math>b</math>');
  });

  it('should auto-repair truncated JSON response from LLMs without throwing Unexpected end of JSON', () => {
    const { extractAndParseJson } = require('../routes/parse.js');
    const truncatedInput = `{"testTitle": "Truncated Exam", "questions": [{"id": "q1", "questionText": "Solve <math>x^2</math>", "type": "mcq", "options": ["1", "2"]`;
    const parsed = extractAndParseJson(truncatedInput);
    expect(parsed).toBeDefined();
    expect(parsed.questions.length).toBe(1);
    expect(parsed.questions[0].questionText).toBe('Solve <math>x^2</math>');
  });

  it('should double-escape LaTeX backslashes starting with f, n, r, b, t (\\frac, \\nCr, \\rho, \\beta, \\times, \\text) without throwing Bad escaped character', () => {
    const { extractAndParseJson } = require('../routes/parse.js');
    const rawJsonWithSingleBackslashes = String.raw`{"testTitle": "LaTeX Exam", "questions": [{"id": "q1", "questionText": "Solve <math>\frac{a}{b} + \nCr{10}{3} + \rho + \beta + \times + \text{ Volt}</math>", "type": "mcq", "options": ["<math>4 \text{ times}</math>", "<math>8 \text{ V/m}</math>"]}]}`;
    const parsed = extractAndParseJson(rawJsonWithSingleBackslashes);
    expect(parsed).toBeDefined();
    expect(parsed.questions[0].questionText).toContain(String.raw`\frac{a}{b}`);
    expect(parsed.questions[0].questionText).toContain(String.raw`\nCr{10}{3}`);
    expect(parsed.questions[0].questionText).toContain(String.raw`\rho`);
    expect(parsed.questions[0].questionText).toContain(String.raw`\text{ Volt}`);
    expect(parsed.questions[0].options[0]).toBe(String.raw`<math>4 \text{ times}</math>`);
    expect(parsed.questions[0].options[1]).toBe(String.raw`<math>8 \text{ V/m}</math>`);
  });

  it('should preserve properly escaped JSON backslashes (\\\\text, \\\\frac, \\\\sqrt) without doubling them into \\\\text in parsed output', () => {
    const { extractAndParseJson } = require('../routes/parse.js');
    const validGeminiJson = JSON.stringify({
      testTitle: 'Physics Electrostatics',
      questions: [
        {
          id: 'q4',
          questionText: 'Electric potential at a point <math>(x, y, z)</math> is given by <math>V = 4x^2 \\text{ Volt}</math>. The magnitude of electric field intensity at the point <math>(1\\text{ m}, 0, 2\\text{ m})</math> is:',
          type: 'mcq',
          options: [
            '<math>4 \\text{ V/m}</math>',
            '<math>8 \\text{ V/m}</math>',
            '<math>16 \\text{ V/m}</math>',
            '<math>2 \\text{ V/m}</math>'
          ],
          correctAnswer: 1
        },
        {
          id: 'q8',
          questionText: 'Sixty-four small spherical mercury drops, each of radius <math>r</math> and charge <math>q</math>, coalesce to form a single big drop.',
          type: 'mcq',
          options: [
            '<math>4 \\text{ times}</math>',
            '<math>16 \\text{ times}</math>',
            '<math>64 \\text{ times}</math>',
            '<math>2 \\text{ times}</math>'
          ],
          correctAnswer: 0
        },
        {
          id: 'q31',
          questionText: 'In a step-up transformer, transformation ratio <math>k = \\frac{N_p}{N_s}</math> satisfies:',
          type: 'mcq',
          options: ['<math>k < 1</math>', '<math>k > 1</math>', '<math>k = 1</math>', '<math>k = 0</math>'],
          correctAnswer: 0
        }
      ]
    });

    const parsed = extractAndParseJson(validGeminiJson);
    expect(parsed.questions[0].questionText).toContain('\\text{ Volt}');
    expect(parsed.questions[0].questionText).not.toContain('\\\\text');
    expect(parsed.questions[0].options[0]).toBe('<math>4 \\text{ V/m}</math>');
    expect(parsed.questions[1].options[0]).toBe('<math>4 \\text{ times}</math>');
    expect(parsed.questions[2].questionText).toContain('\\frac{N_p}{N_s}');
    expect(parsed.questions[2].questionText).not.toContain('\\\\frac');
  });

  it('should repair mangled <_p u > tags in stem and options into clean <math>\\pu{...}</math>', () => {
    const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');
    const input = 'A <_p u > 50 Ampere-hour battery can supply a current of <_p u > 50A for <_p u > 1hour';
    const output = repairMissingMathBackslashes(input);
    expect(output).toContain('<math>\\pu{50 Ampere-hour}</math>');
    expect(output).toContain('<math>\\pu{50A}</math>');
    expect(output).toContain('<math>\\pu{1hour}</math>');
    expect(output).not.toContain('<_p u >');
  });

  it('should repair orphaned closing </math> options like "8cm </math>" and "2.5A </math>" into clean <math> spans', () => {
    const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');
    expect(repairMissingMathBackslashes('8cm </math>')).toBe('<math>8cm</math>');
    expect(repairMissingMathBackslashes('2.5A </math>')).toBe('<math>2.5A</math>');
  });
});
