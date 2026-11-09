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
    '<math>k = \\\\frac{N_p}{N_s}</math>',
    '<math>P = 10 \\text{ \\Omega}</math>',
    '<math>20 \\text{ \\Omega}</math>',
    '<math>10 \\text{ k\\Omega}</math>',
    '<math>5 \\text{ \\mu F}</math>',
    'High resistance \\in parallel',
    'Low resistance \\in series',
    '\\Gamma rays',
    'Gamma rays'
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

  it('should repair \\text{ \\Omega}, \\text{ k\\Omega}, and \\text{ \\mu F} out of text mode so KaTeX never throws', () => {
    expect(repairMissingMathBackslashes('<math>P = 10 \\text{ \\Omega}</math>')).toBe('<math>P = 10 \\,\\Omega</math>');
    expect(repairMissingMathBackslashes('<math>20 \\text{ \\Omega}</math>')).toBe('<math>20 \\,\\Omega</math>');
    expect(repairMissingMathBackslashes('<math>10 \\text{ k\\Omega}</math>')).toBe('<math>10 \\,\\mathrm{k}\\Omega</math>');
    expect(repairMissingMathBackslashes('<math>5 \\text{ \\mu F}</math>')).toBe('<math>5 \\,\\mu\\,\\mathrm{F}</math>');
  });

  it('should never inject \\in or \\Gamma into plain English phrases outside <math> tags, and should clean leaked ones', () => {
    expect(repairMissingMathBackslashes('High resistance in parallel')).toBe('High resistance in parallel');
    expect(repairMissingMathBackslashes('High resistance \\in parallel')).toBe('High resistance in parallel');
    expect(repairMissingMathBackslashes('Low resistance \\in series')).toBe('Low resistance in series');
    expect(repairMissingMathBackslashes('Gamma rays')).toBe('Gamma rays');
    expect(repairMissingMathBackslashes('\\Gamma rays')).toBe('Gamma rays');
    expect(repairMissingMathBackslashes('Q1. (1) The circuit has 2R and X in series')).toBe('Q1. (1) The circuit has 2R and X in series');
  });

  it('should repair bare fracN_pN_s and over-escaped \\\\frac{N_p}{N_s} into \\frac{N_p}{N_s}', () => {
    expect(repairMissingMathBackslashes('<math>k = fracN_pN_s</math>')).toBe('<math>k = \\frac{N_p}{N_s}</math>');
    expect(repairMissingMathBackslashes('<math>k = \\\\frac{N_p}{N_s}</math>')).toBe('<math>k = \\frac{N_p}{N_s}</math>');
  });
});
