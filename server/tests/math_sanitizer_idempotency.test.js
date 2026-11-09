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
    '\\pu{100 \\Omega}',
    '<math>4 \\\\text{ \\times}</math>',
    '<math>V = 4x^2 \\\\text{ Volt}</math>',
    '<math>(1\\\\text{ m}, 0, 2\\\\text{ m})</math>',
    '<math>4 \\\\text{ V/m}</math>',
    '<math>k = fracN_pN_s</math>',
    '<math>k = \\\\frac{N_p}{N_s}</math>'
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

  it('should repair over-escaped \\\\text and corrupted \\text{ \\times} into clean \\text{ times}', () => {
    expect(repairMissingMathBackslashes('<math>4 \\\\text{ \\times}</math>')).toBe('<math>4 \\text{ times}</math>');
    expect(repairMissingMathBackslashes('<math>16 \\\\text{ times}</math>')).toBe('<math>16 \\text{ times}</math>');
    expect(repairMissingMathBackslashes('<math>V = 4x^2 \\\\text{ Volt}</math>')).toBe('<math>V = 4x^2 \\text{ Volt}</math>');
    expect(repairMissingMathBackslashes('<math>4 \\\\text{ V/m}</math>')).toBe('<math>4 \\text{ V/m}</math>');
  });

  it('should repair bare fracN_pN_s and over-escaped \\\\frac{N_p}{N_s} into \\frac{N_p}{N_s}', () => {
    expect(repairMissingMathBackslashes('<math>k = fracN_pN_s</math>')).toBe('<math>k = \\frac{N_p}{N_s}</math>');
    expect(repairMissingMathBackslashes('<math>k = \\\\frac{N_p}{N_s}</math>')).toBe('<math>k = \\frac{N_p}{N_s}</math>');
  });
});
