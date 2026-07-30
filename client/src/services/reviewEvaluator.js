import katex from 'katex';

/**
 * Computes deterministic needsReview status and concrete reasons based on product invariants.
 * @param {Object} question - Question block object
 * @returns {Object} { needsReview: boolean, reasons: string[] }
 */
export function computeNeedsReview(question) {
  if (!question) return { needsReview: false, reasons: [] };

  const reasons = [];

  // Rule 1: Correct Answer must be set
  if (question.correctAnswer === null || question.correctAnswer === undefined || question.correctAnswer === '') {
    reasons.push('Answer Key Unset');
  }

  // Rule 2: MCQ option counts
  if (question.type === 'mcq') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      reasons.push('Fewer than 2 MCQ Options');
    }
  }

  // Rule 3: Question stem content check
  const stem = (question.questionText || '').trim();
  if (!stem || stem.length < 3) {
    reasons.push('Empty or Very Short Question Stem');
  }

  // Rule 4: KaTeX Syntax Evaluation on math spans
  const fullTextToTest = [
    question.questionText || '',
    ...(Array.isArray(question.options) ? question.options : [])
  ].join(' ');

  const mathMatches = fullTextToTest.match(/<math>(.*?)<\/math>/gi) || [];
  let katexHasError = false;

  for (const match of mathMatches) {
    const rawFormula = match.replace(/<\/?math>/gi, '').trim();
    if (!rawFormula) continue;

    try {
      katex.renderToString(rawFormula, { throwOnError: true, displayMode: false });
    } catch (err) {
      katexHasError = true;
      break;
    }
  }

  if (katexHasError) {
    reasons.push('Math Formula Syntax Error');
  }

  return {
    needsReview: reasons.length > 0,
    reasons
  };
}
