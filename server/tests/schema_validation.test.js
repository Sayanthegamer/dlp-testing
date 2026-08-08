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
});



