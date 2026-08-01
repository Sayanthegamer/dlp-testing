/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service (Client ES Module).
 */

const GREEK_NAMES = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';
const OP_NAMES = 'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|lim|log|ln|sin|cos|tan|cot|sec|csc';

// Detect likely-broken LaTeX: bare commands without backslash glued to numbers or other terms (e.g. "frac3pilambdar8", "sqrt3", "fracx5")
export const BARE_COMMAND_RUN_REGEX = /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)\s*([0-9a-zA-Z\{\}\+\-\*\/\^\.]+)/i;

/**
 * Checks if text contains malformed bare LaTeX command runs missing leading backslashes.
 * @param {string} text 
 * @returns {boolean} true if malformed bare command run detected
 */
export function hasBareCommandRun(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

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
 * Auto-repairs missing LaTeX backslashes & brackets in math expressions.
 * @param {string} text 
 * @returns {string} Repaired LaTeX text
 */
export function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  const replaceInSpan = (inner) => {
    return inner
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

  if (text.includes('<math>')) {
    return text.replace(/<math>(.*?)<\/math>/gi, (m, inner) => `<math>${replaceInSpan(inner)}</math>`);
  }

  return replaceInSpan(text);
}
