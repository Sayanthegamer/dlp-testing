import { describe, it, expect } from 'vitest';
const { repairMissingMathBackslashes } = require('../services/mathSanitizerService');

describe('Math Sanitizer Idempotency & Stability Suite', () => {
  const testCases = [
    '2R \\Omega',
    '<math>\\pu{2 \\Omega}</math>',
    '<math>2\\ \\Omega</math>',
    '2R\\ \\Omega',
    '<math>\\frac{3\\pi\\lambda r}{8}</math>',
    '8cm </math>',
    '2.5A </math>',
    '<math>\\sqrt{3} - 1</math>',
    'Q1. (1) The circuit has 2R and X in series',
    '<math>(\\sqrt{3} - 1)R <math>\\pu{\\Omega}</math></math>',
    '<math>R_1 = R_2 = R_3 = R_4</math>',
    '50 \\pu{V}',
    '\\pu{100 \\Omega}'
  ];

  testCases.forEach((sample, idx) => {
    it(`should be strictly idempotent for test case #${idx + 1}: "${sample}"`, () => {
      const pass1 = repairMissingMathBackslashes(sample);
      const pass2 = repairMissingMathBackslashes(pass1);
      const pass3 = repairMissingMathBackslashes(pass2);

      expect(pass2).toBe(pass1);
      expect(pass3).toBe(pass1);
    });
  });
});
