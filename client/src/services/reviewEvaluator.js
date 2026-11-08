import katex from 'katex';
import { hasBareCommandRun, repairMissingMathBackslashes } from './mathSanitizerService';

/**
 * Computes deterministic needsReview status and concrete reasons based on product invariants.
 * @param {Object} question - Question block object
 * @returns {Object} { needsReview: boolean, reasons: string[] }
 */
export function computeNeedsReview(question) {
  if (!question) return { needsReview: false, reasons: [] };

  const reasons = [];

  if (question.correctAnswer === null || question.correctAnswer === undefined || question.correctAnswer === '') {
    reasons.push('Answer key unset');
  }

  if (question.type === 'mcq' || question.type === 'match_following') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      reasons.push('Fewer than 2 options');
    }
  } else if (question.type === 'short_answer' || question.type === 'short_answer_text') {
    reasons.push('Legacy answer type (convert to numerical)');
  } else if (question.type === 'short_answer_numeric') {
    const range = question.acceptedRange;
    const isValidRange = Array.isArray(range) &&
      range.length === 2 &&
      typeof range[0] === 'number' && Number.isFinite(range[0]) &&
      typeof range[1] === 'number' && Number.isFinite(range[1]) &&
      range[0] <= range[1];

    if (!isValidRange) {
      reasons.push('Numeric range not set');
    } else if (!question.numericalConfirmed) {
      reasons.push('Numeric range unconfirmed');
    }
  } else {
    reasons.push('Unclassified question type');
  }

  const stem = (question.questionText || '').trim();
  if (!stem || stem.length < 3) {
    reasons.push('Question stem missing');
  }

  const fullTextToTest = [
    question.questionText || '',
    ...(Array.isArray(question.options) ? question.options : [])
  ].join(' ');

  const mathMatches = fullTextToTest.match(/<math>(.*?)<\/math>/gi) || [];
  let katexHasError = false;

  const KATEX_EVAL_OPTIONS = {
    throwOnError: true,
    displayMode: false,
    trust: true,
    macros: {
      "\\pu": "\\mathrm{#1}",
      "\\nCr": "{}^{#1}\\mkern-2mu C_{#2}",
      "\\nPr": "{}^{#1}\\mkern-2mu P_{#2}",
      "\\vhat": "\\hat{\\mathbf{#1}}"
    }
  };

  for (const match of mathMatches) {
    const rawFormula = match.replace(/<\/?math>/gi, '').trim();
    if (!rawFormula) continue;

    const cleanFormula = repairMissingMathBackslashes(rawFormula)
      .replace(/(?<!\\)pu\{([^{}]+)\}/g, '\\mathrm{$1}');

    try {
      katex.renderToString(cleanFormula, KATEX_EVAL_OPTIONS);
    } catch (_) {
      katexHasError = true;
      break;
    }
  }

  if (katexHasError) {
    reasons.push('Formula syntax check needed');
  }

  const structuralHints = /benzene ring|skeletal structure|wedge.?dash|orbital diagram|circuit diagram/i;
  if (structuralHints.test(fullTextToTest) && (!Array.isArray(question.diagrams) || question.diagrams.length === 0)) {
    reasons.push('Verify structural diagram attachment');
  }

  if (hasBareCommandRun(fullTextToTest)) {
    reasons.push('Formula formatting check needed');
  }

  if (Array.isArray(question.diagrams) && question.diagrams.length > 0 && !question.diagramsConfirmed) {
    reasons.push('Diagram needs confirmation');
  }

  return {
    needsReview: reasons.length > 0,
    reasons
  };
}
