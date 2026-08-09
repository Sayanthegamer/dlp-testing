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
 * Converts raw MathML tags (<mn>, <mi>, <mo>, <mfrac>, <msup>, <msub>, <annotation>, etc.) into clean KaTeX/LaTeX strings wrapped in <math>...</math>.
 * @param {string} text 
 * @returns {string} Repaired text with MathML tags converted to KaTeX
 */
function convertMathMLToKaTeX(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  if (!/<(?:mn|mi|mo|mfrac|msup|msub|msqrt|mrow|math|annotation)/i.test(text)) return text;

  let cleaned = text;

  // 1. If an explicit LaTeX annotation tag exists (<annotation encoding="application/x-tex">LATEX</annotation>), extract it
  cleaned = cleaned.replace(/<annotation\s+encoding=["']application\/x-tex["']\s*>([\s\S]*?)<\/annotation>/gi, (match, latex) => {
    return `<math>${latex.trim()}</math>`;
  });

  // 2. Convert MathML Value + Unit combinations:
  // e.g. <mn>50</mn><mo></mo><mi mathvariant="normal">V</mi> -> <math>\pu{50 V}</math>
  // e.g. <mn>2</mn><mo></mo><mi mathvariant="normal">A</r> -> <math>\pu{2 A}</math>
  cleaned = cleaned.replace(/<mn>([\d\.]+)\s*<\/mn>\s*(?:<mo>.*?<\/mo>\s*)?<mi\s+mathvariant=["']normal["']\s*>([a-zA-Z\Omega]+)<\/mi>/gi, (match, val, unit) => {
    return `<math>\\pu{${val} ${unit}}</math>`;
  });

  // 3. Convert fractions: <mfrac>(.*?)</mfrac> or <mfrac><mrow>(.*?)</mrow><mrow>(.*?)</mrow></mfrac>
  cleaned = cleaned.replace(/<mfrac>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/mfrac>/gi, (match, num, den) => {
    const cleanNum = num.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    const cleanDen = den.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    return `<math>\\frac{${cleanNum}}{${cleanDen}}</math>`;
  });

  // 4. Convert superscripts: <msup>(.*?)(.*?)</msup>
  cleaned = cleaned.replace(/<msup>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msup>/gi, (match, base, exp) => {
    const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    const cleanExp = exp.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    return `<math>{${cleanBase}}^{${cleanExp}}</math>`;
  });

  // 5. Convert subscripts: <msub>(.*?)(.*?)</msub>
  cleaned = cleaned.replace(/<msub>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msub>/gi, (match, base, sub) => {
    const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    const cleanSub = sub.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    return `<math>{${cleanBase}}_{${cleanSub}}</math>`;
  });

  // 6. Convert square roots: <msqrt>(.*?)</msqrt>
  cleaned = cleaned.replace(/<msqrt>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msqrt>/gi, (match, inner) => {
    const cleanInner = inner.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
    return `<math>\\sqrt{${cleanInner}}</math>`;
  });

  // 7. Convert upright text/unit identifiers: <mi mathvariant="normal">TEXT</mi> -> \mathrm{TEXT}
  cleaned = cleaned.replace(/<mi\s+mathvariant=["']normal["']\s*>([\s\S]*?)<\/mi>/gi, (match, inner) => {
    return `<math>\\mathrm{${inner.trim()}}</math>`;
  });

  // 8. Convert simple numbers: <mn>NUM</mn> -> NUM
  cleaned = cleaned.replace(/<mn>([\s\S]*?)<\/mn>/gi, '$1');

  // 9. Convert simple variables/identifiers: <mi>VAR</mi> -> <math>VAR</math>
  cleaned = cleaned.replace(/<mi>([\s\S]*?)<\/mi>/gi, (match, varName) => {
    const trimmed = varName.trim();
    return trimmed ? `<math>${trimmed}</math>` : '';
  });

  // 10. Convert operators: <mo>OP</mo> -> OP
  cleaned = cleaned.replace(/<mo>([\s\S]*?)<\/mo>/gi, '$1');

  // 11. Clean up structural containers: <mrow>, </mrow>, <math...>, </math>, <semantics>, <annotation...>, etc.
  cleaned = cleaned.replace(/<\/?(?:mrow|semantics|annotation|style)\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<math\b[^>]*>/gi, '<math>').replace(/<\/math>/gi, '</math>');

  // 12. Collapse duplicate consecutive math tags e.g. <math>a</math><math>b</math> -> <math>a b</math>
  cleaned = cleaned.replace(/<\/math>\s*<math>/gi, ' ');

  return cleaned;
}

/**
 * Auto-repairs missing LaTeX backslashes, fake XML tags, & brackets in math expressions.
 * @param {string} text 
 * @returns {string} Repaired LaTeX text
 */
function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  // Pre-pass 0: Convert raw MathML tags (<mn>, <mi>, <mo>, <mfrac>, etc.) to KaTeX
  let cleaned = convertMathMLToKaTeX(text);

  // 1. Repair fake / mangled AI XML unit tags (e.g. <_p u >, <_p u>, <_pu>, <p u>, <\p u>, <\pu>, <pu>, </pu>, </_pu>)
  // 1a. Explicitly paired unit tags with opening tag and closing slash tag: <_p u> ... </_p u>
  cleaned = cleaned.replace(/<\\?_?\s*p\s*u\s*>([\s\S]*?)<[\/\\]_?\s*p\s*u\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?_?\s*p\s*u\s*/i, '').trim();
    return `<math>\\pu{${trimmed}}</math>`;
  });

  // 1b. Explicitly paired chemistry tags with opening tag and closing slash tag: <_ce> ... </_ce>
  cleaned = cleaned.replace(/<\\?_?\s*c\s*e\s*>([\s\S]*?)<[\/\\]_?\s*c\s*e\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?_?\s*c\s*e\s*/i, '').trim();
    return `<math>\\ce{${trimmed}}</math>`;
  });

  // 1c. Unclosed mangled unit tags followed by values / units (e.g. <_p u > 50 Ampere-hour, <_p u > 50A, <_p u > 1hour, <_p u > 100\Omega)
  cleaned = cleaned.replace(/<\\?_?\s*p\s*u\s*>\s*([0-9\.\-]+(?:\s*\\?[a-zA-Z\Omega\%]+(?:-[a-zA-Z]+)?)?)/gi, (match, valUnit) => {
    return `<math>\\pu{${valUnit.trim()}}</math>`;
  });

  // 1d. Clean up any leftover orphaned closing or mangled tags
  cleaned = cleaned.replace(/<\/?_?\s*p\s*u\s*>/gi, '');
  cleaned = cleaned.replace(/<\/?_?\s*c\s*e\s*>/gi, '');

  // 2. Repair orphaned or broken <math> / </math> tags
  // 2a. Handle missing <math> when </math> exists (e.g. "8cm </math>", "2A </math>", "2.5A </math>")
  if (cleaned.includes('</math>') && !cleaned.includes('<math>')) {
    cleaned = cleaned.replace(/^([\s\S]+?)\s*<\/math>/gi, (match, inner) => {
      const trimmed = inner.trim();
      return `<math>${trimmed}</math>`;
    });
  }

  // 2b. Handle missing </math> when <math> exists without closing tag
  const openCount = (cleaned.match(/<math>/gi) || []).length;
  const closeCount = (cleaned.match(/<\/math>/gi) || []).length;
  if (openCount > closeCount) {
    cleaned += '</math>'.repeat(openCount - closeCount);
  }

  // 2c. Clean up empty <math></math> or duplicate nested tags
  cleaned = cleaned.replace(/<math>\s*<\/math>/gi, '');
  cleaned = cleaned.replace(/<math>\s*<math>/gi, '<math>').replace(/<\/math>\s*<\/math>/gi, '</math>');

  const replaceInSpan = (inner) => {
    return inner
      // Repair mangled control char escapes created by JSON.parse (\f -> \x0C, \n -> \x0A, \r -> \x0D, \b -> \x08, \t -> \x09)
      .replace(/\x0Crac/g, '\\frac')
      .replace(/\x0ACr/g, '\\nCr')
      .replace(/\x0Dho/g, '\\rho')
      .replace(/\x08eta/g, '\\beta')
      .replace(/\x09imes/g, '\\times')
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
  convertMathMLToKaTeX,
  BARE_COMMAND_RUN_REGEX
};
