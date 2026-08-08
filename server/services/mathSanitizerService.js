/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service.
 * Used in server/routes/parse.js, reviewEvaluator.js, and MathRenderer.jsx.
 */

const GREEK_NAMES = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';
const OP_NAMES = 'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|lim|log|ln|sin|cos|tan|cot|sec|csc';

// Detect likely-broken LaTeX: bare commands without backslash glued to numbers or other terms (e.g. "frac3pilambdar8", "sqrt3", "fracx5")
const BARE_COMMAND_RUN_REGEX = /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)\s*([0-9a-zA-Z\{\}\+\-\*\/\^\.]+)/i;

/**
 * Checks if text contains malformed bare LaTeX command runs missing leading backslashes.
 * @param {string} text 
 * @returns {boolean} true if malformed bare command run detected
 */
function hasBareCommandRun(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  // Extract <math>...</math> spans if present, otherwise check raw text
  const mathMatches = text.match(/<math>(.*?)<\/math>/gi) || [text];

  for (const span of mathMatches) {
    const cleanSpan = span.replace(/<\/?math>/gi, '').trim();
    if (BARE_COMMAND_RUN_REGEX.test(cleanSpan)) {
      return true;
    }
  }

  return false;
}

/**
 * Auto-repairs missing LaTeX backslashes, fake XML tags, & brackets in math expressions.
 * @param {string} text 
 * @returns {string} Repaired LaTeX text
 */
function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  let cleaned = text;

  // 1. Repair fake AI XML tags like <\pu>50 V<\pu>, <pu>50 V</pu>, <\pu>50 V</\pu> -> <math>\pu{50 V}</math>
  cleaned = cleaned.replace(/<\\?\/?pu\s*>([\s\S]*?)<\\?\/?pu\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?pu\s*/i, '').trim();
    return `<math>\\pu{${trimmed}}</math>`;
  });

  // 2. Repair fake AI XML tags like <\ce>2H2 + O2 -> 2H2O<\ce>, <ce>...</ce> -> <math>\ce{...}</math>
  cleaned = cleaned.replace(/<\\?\/?ce\s*>([\s\S]*?)<\\?\/?ce\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?ce\s*/i, '').trim();
    return `<math>\\ce{${trimmed}}</math>`;
  });

  // 3. Repair unclosed stray <\pu>50 V
  cleaned = cleaned.replace(/<\\?pu\s*>\s*([^<]+)/gi, (match, inner) => {
    return `<math>\\pu{${inner.trim()}}</math>`;
  });

  const replaceInSpan = (inner) => {
    return inner
      // Collapse duplicate backslashes before command letters (e.g. \\frac -> \frac, \\pi -> \pi)
      .replace(/\\\\(?=[a-zA-Z])/g, '\\')
      // Repair square roots: sqrt(3), sqrt3, \sqrt(3) -> \sqrt{3}
      .replace(/(?<!\\)\bsqrt\s*\(?\s*([0-9a-zA-Z]+)\s*\)?/gi, '\\sqrt{$1}')
      .replace(/(?<!\\)\bsqrt\s*\{([^}]+)\}/gi, '\\sqrt{$1}')
      // Repair fractions: frac3pilambdar8 -> \frac{3\pi \lambda r}{8}, fracx5 -> \frac{x}{5}
      .replace(/(?<!\\)\bfrac([a-zA-Z0-9_\{\}\+\-\*\/\^\.\s]+)/gi, (match, body) => {
        if (body.startsWith('{')) return `\\frac${body}`;
        return `\\frac{${body}}`;
      })
      // Repair unescaped Greek letters
      .replace(new RegExp(`(?<!\\\\)\\b(${GREEK_NAMES})\\b`, 'g'), '\\$1')
      // Repair unescaped math operators
      .replace(new RegExp(`(?<!\\\\)\\b(${OP_NAMES})\\b`, 'g'), '\\$1');
  };

  if (cleaned.includes('<math>')) {
    return cleaned.replace(/<math>(.*?)<\/math>/gi, (m, inner) => `<math>${replaceInSpan(inner)}</math>`);
  }

  return replaceInSpan(cleaned);
}

module.exports = {
  hasBareCommandRun,
  repairMissingMathBackslashes,
  BARE_COMMAND_RUN_REGEX
};
