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
});

