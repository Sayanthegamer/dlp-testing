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

  it('should reject malformed numeric question with non-empty options array', () => {
    const invalidNumeric = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q2',
          questionText: 'Calculate resistance',
          type: 'short_answer_numeric',
          options: ['Option 1'], // Invalid for numeric
          correctAnswer: 15
        }
      ]
    };
    expect(validateJsonSchema(invalidNumeric)).toBe(false);
  });

  it('should reject malformed MCQ question with correctAnswer out of bounds', () => {
    const invalidMcq = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q1',
          questionText: 'Solve for x',
          type: 'mcq',
          options: ['1', '2', '3', '4'],
          correctAnswer: 10 // Out of bounds!
        }
      ]
    };
    expect(validateJsonSchema(invalidMcq)).toBe(false);
  });

  it('should reject invalid diagram bbox coordinates outside 0..1 range', () => {
    const invalidDiagram = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q1',
          questionText: 'Circuit question',
          type: 'short_answer_numeric',
          options: [],
          diagrams: [
            {
              id: 'd1',
              bbox: [0.1, 0.2, 1.5, 0.4] // 1.5 > 1.0 invalid!
            }
          ]
        }
      ]
    };
    expect(validateJsonSchema(invalidDiagram)).toBe(false);
  });

  it('should reject questions with unescaped bare command runs (e.g. frac3pilambdar8)', () => {
    const invalidBareCommand = {
      testTitle: 'Test Paper',
      questions: [
        {
          id: 'q1',
          questionText: 'Simplify <math>frac3pilambdar8</math>',
          type: 'mcq',
          options: ['<math>frac3pilambdar8</math>', '<math>2</math>'],
          correctAnswer: 0
        }
      ]
    };
    expect(validateJsonSchema(invalidBareCommand)).toBe(false);
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
});


