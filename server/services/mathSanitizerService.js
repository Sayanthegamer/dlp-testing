/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service.
 * Used in server/routes/parse.js, reviewEvaluator.js, and MathRenderer.jsx.
 */

const GREEK_NAMES =
  'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';
const OP_NAMES =
  'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|oint|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|neq|leq|geq|approx|equiv|propto|partial|nabla|forall|exists|in|notin|subset|subseteq|cup|cap|therefore|angle|rightarrow|Rightarrow|leftarrow|Leftarrow|leftrightarrow';

// Detect likely-broken LaTeX: bare commands without backslash glued to numbers or other terms (e.g. "frac3pilambdar8", "sqrt3", "fracx5", "fracN_pN_s")
const BARE_COMMAND_RUN_REGEX =
  /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)\s*([0-9a-zA-Z\{\}\+\-\*\/\^\._]+)/i;

/**
 * Checks if text contains malformed bare LaTeX command runs missing leading backslashes
 * or double-backslash command breaks (e.g. \\text, \\frac).
 * @param {string} text
 * @returns {boolean} true if malformed bare command run detected
 */
function hasBareCommandRun(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  const mathMatches = text.match(/<math>(.*?)<\/math>/gi) || [text];

  for (const span of mathMatches) {
    const cleanSpan = span.replace(/<\/?math>/gi, '').trim();
    if (BARE_COMMAND_RUN_REGEX.test(cleanSpan)) {
      return true;
    }
    if (/\\{2,}(?:text|mathrm|frac|sqrt|pi|times|cdot|ce|pu|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|Omega)\b/.test(cleanSpan)) {
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
  if (!/<(?:mn|mi|mo|mfrac|msup|msub|msqrt|mrow|math\s|annotation)/i.test(text)) return text;

  let cleaned = text;

  // 1. If an explicit LaTeX annotation tag exists (<annotation encoding="application/x-tex">LATEX</annotation>), extract it
  cleaned = cleaned.replace(
    /<annotation\s+encoding=["']application\/x-tex["']\s*>([\s\S]*?)<\/annotation>/gi,
    (match, latex) => {
      return `<math>${latex.trim()}</math>`;
    }
  );

  // 2. Convert MathML Value + Unit combinations:
  cleaned = cleaned.replace(
    /<mn>([\d\.]+)\s*<\/mn>\s*(?:<mo>.*?<\/mo>\s*)?<mi\s+mathvariant=["']normal["']\s*>([a-zA-Z\Omega]+)<\/mi>/gi,
    (match, val, unit) => {
      return `<math>\\pu{${val} ${unit}}</math>`;
    }
  );

  // 3. Convert fractions: <mfrac>(.*?)</mfrac>
  cleaned = cleaned.replace(
    /<mfrac>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/mfrac>/gi,
    (match, num, den) => {
      const cleanNum = num.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanDen = den.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>\\frac{${cleanNum}}{${cleanDen}}</math>`;
    }
  );

  // 4. Convert superscripts: <msup>(.*?)(.*?)</msup>
  cleaned = cleaned.replace(
    /<msup>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msup>/gi,
    (match, base, exp) => {
      const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanExp = exp.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>{${cleanBase}}^{${cleanExp}}</math>`;
    }
  );

  // 5. Convert subscripts: <msub>(.*?)(.*?)</msub>
  cleaned = cleaned.replace(
    /<msub>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msub>/gi,
    (match, base, sub) => {
      const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanSub = sub.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>{${cleanBase}}_{${cleanSub}}</math>`;
    }
  );

  // 6. Convert square roots: <msqrt>(.*?)</msqrt>
  cleaned = cleaned.replace(
    /<msqrt>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msqrt>/gi,
    (match, inner) => {
      const cleanInner = inner.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>\\sqrt{${cleanInner}}</math>`;
    }
  );

  // 7. Convert upright text/unit identifiers: <mi mathvariant="normal">TEXT</mi> -> \mathrm{TEXT}
  cleaned = cleaned.replace(
    /<mi\s+mathvariant=["']normal["']\s*>([\s\S]*?)<\/mi>/gi,
    (match, inner) => {
      return `<math>\\mathrm{${inner.trim()}}</math>`;
    }
  );

  // 8. Convert simple numbers: <mn>NUM</mn> -> NUM
  cleaned = cleaned.replace(/<mn>([\s\S]*?)<\/mn>/gi, '$1');

  // 9. Convert simple variables/identifiers: <mi>VAR</mi> -> <math>VAR</math>
  cleaned = cleaned.replace(/<mi>([\s\S]*?)<\/mi>/gi, (match, varName) => {
    const trimmed = varName.trim();
    return trimmed ? `<math>${trimmed}</math>` : '';
  });

  // 10. Convert operators: <mo>OP</mo> -> OP
  cleaned = cleaned.replace(/<mo>([\s\S]*?)<\/mo>/gi, '$1');

  // 11. Clean up structural containers
  cleaned = cleaned.replace(/<\/?(?:mrow|semantics|annotation|style)\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<math\b[^>]*>/gi, '<math>').replace(/<\/math>/gi, '</math>');

  // 12. Collapse duplicate consecutive math tags
  cleaned = cleaned.replace(/<\/math>\s*<math>/gi, ' ');

  return cleaned;
}

/**
 * Repairs bare or partially-braced `frac` expressions into valid 2-argument `\frac{num}{den}`.
 * Examples:
 * - `fracN_pN_s` or `\fracN_pN_s` -> `\frac{N_p}{N_s}`
 * - `frac{N_p}{N_s}` or `\\frac{N_p}{N_s}` -> `\frac{N_p}{N_s}`
 * - `frac12` -> `\frac{1}{2}`
 * - `fracx5` -> `\frac{x}{5}`
 * - `\frac{N_pN_s}` (single brace group containing two subscripted tokens) -> `\frac{N_p}{N_s}`
 */
function repairFractionSyntax(str) {
  if (!str || typeof str !== 'string') return str;
  let out = str;

  // 1. Ensure any `frac` followed immediately by `{` has a leading backslash
  out = out.replace(/(?<!\\)\bfrac(?=\{)/g, '\\frac');

  // 2. Repair `\frac{A_1B_2}` (where a single brace group has two distinct subscript/superscript tokens and no second `{...}` group)
  out = out.replace(
    /\\frac\{([a-zA-Z]_[a-zA-Z0-9]+|[a-zA-Z]\^[a-zA-Z0-9]+)\s*([a-zA-Z]_[a-zA-Z0-9]+|[a-zA-Z]\^[a-zA-Z0-9]+)\}(?!\s*\{)/g,
    '\\frac{$1}{$2}'
  );

  // 3. Repair `\frac` or bare `frac` followed by two subscripted/superscripted tokens without braces (e.g. `fracN_pN_s`, `\fracN_pN_s`, `fracV_1V_2`)
  out = out.replace(
    /\\?\bfrac\s*([a-zA-Z]_(?:\{[^{}]+\}|[a-zA-Z0-9]+)|[a-zA-Z]\^(?:\{[^{}]+\}|[a-zA-Z0-9]+))\s*([a-zA-Z]_(?:\{[^{}]+\}|[a-zA-Z0-9]+)|[a-zA-Z]\^(?:\{[^{}]+\}|[a-zA-Z0-9]+))/g,
    '\\frac{$1}{$2}'
  );

  // 4. Repair `\frac{num}den` (where first argument is braced and second is a bare token)
  out = out.replace(
    /\\frac\{([^{}]+)\}\s*([a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)?)(?!\s*\{)/g,
    '\\frac{$1}{$2}'
  );

  // 5. Repair bare `frac` followed by simple tokens (e.g. `frac12` -> `\frac{1}{2}`, `fracx5` -> `\frac{x}{5}`, `frac3pilambdar8` -> `\frac{3\pi\lambda r}{8}`)
  out = out.replace(/(?<!\\)\bfrac([a-zA-Z0-9_\\\+\-\*\/\^\.\s]+)/g, (match, body) => {
    const trimmed = body.trim();
    if (!trimmed) return match;
    // Two single characters/digits like `12` or `x5` or `ab`
    if (/^[a-zA-Z0-9]{2}$/.test(trimmed)) {
      return `\\frac{${trimmed[0]}}{${trimmed[1]}}`;
    }
    // Leading expression followed by trailing digit(s) like `3\pi\lambda r8`
    const trailingNum = trimmed.match(/^(.+?[a-zA-Z\}])\s*(\d+)$/);
    if (trailingNum) {
      return `\\frac{${trailingNum[1].trim()}}{${trailingNum[2]}}`;
    }
    return `\\frac{${trimmed}}{1}`;
  });

  return out;
}

/**
 * Restores control characters produced when JSON.parse interprets unescaped `\t`, `\f`, `\n`, `\r`, `\b`
 * inside LaTeX commands (e.g. `\text`, `\times`, `\theta`, `\frac`, `\nCr`, `\rho`, `\beta`).
 */
function repairControlCharEscapes(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    // \t (0x09) commands: \text, \textbf, \textit, \textrm, \times, \theta, \vartheta, \tau, \tan, \tanh, \to, \top, \triangle, \tilde, \tfrac, \tiny
    .replace(/\x09(ext(?:bf|it|rm)?|imes|heta|au|anh?|o\b|op\b|riangle|ilde|frac|iny)/g, '\\t$1')
    // \f (0x0C) commands: \frac, \forall, \flat, \frown
    .replace(/\x0C(rac|orall|lat|rown)/g, '\\f$1')
    // \n (0x0A) commands: \nCr, \nPr, \neq, \neg, \nu, \nabla, \not, \ni, \newline, \normalsize, \nmid, \nparallel, \nsim
    .replace(/\x0A(Cr|Pr|eq|eg|u\b|abla|otsubset|ot\b|i\b|ewline|ormalsize|mid|parallel|sim)/g, '\\n$1')
    // \r (0x0D) commands: \rho, \right, \rightarrow, \Rightarrow, \rangle, \rceil, \rfloor
    .replace(/\x0D(ho|ight(?:arrow|harpoondown|harpoonup|leftarrows|leftharpoons)?|angle|ceil|floor)/g, '\\r$1')
    // \b (0x08) commands: \beta, \bar, \binom, \begin, \big, \bullet, \box, \bot, \backslash, \bmod, \because
    .replace(/\x08(eta|ar|inom|egin|ig(?:ger|g|l|r|m)?|ullet|ox|ot\b|ackslash|bmod|ecause)/g, '\\b$1');
}

/**
 * Auto-repairs missing LaTeX backslashes, over-escaped double backslashes (\\text, \\frac),
 * corrupted `\text{ \times}` spans, fake XML tags, & brackets in math expressions.
 * Strictly idempotent across multiple passes.
 * @param {string} text
 * @returns {string} Repaired LaTeX text
 */
function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  // Pre-pass 0: Restore any control-char escapes (\t -> \x09, \f -> \x0C, etc.)
  let cleaned = repairControlCharEscapes(text);

  // Pre-pass 0a: Convert raw MathML tags (<mn>, <mi>, <mo>, <mfrac>, etc.) to KaTeX
  cleaned = convertMathMLToKaTeX(cleaned);

  // Pre-pass 0b: Clean literal \n string artifacts from LLM stems OUTSIDE <math> tags, preserving LaTeX commands
  cleaned = cleaned.replace(/\n(?!(?:Cr|Pr|u|abla|eq|eg|ewline|otsubset|ot|i|n|ormalsize)\b)/gi, ' ');

  // Pre-pass 0c: Clean malformed \pu{\Omega} or \mathrm{\Omega} without numbers
  cleaned = cleaned
    .replace(/\\+pu\{\\?(?:Omega|ohm)\}/gi, '\\Omega')
    .replace(/\\+mathrm\{\\?(?:Omega|ohm)\}/gi, '\\Omega');

  // 1. Repair fake / mangled AI XML unit tags (e.g. <_p u >, <_pu>, <\pu>, <pu>, </pu>)
  cleaned = cleaned.replace(/<\\?_?\s*p\s*u\s*>([\s\S]*?)<[\/\\]_?\s*p\s*u\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?_?\s*p\s*u\s*/i, '').trim();
    return `<math>\\pu{${trimmed}}</math>`;
  });

  cleaned = cleaned.replace(/<\\?_?\s*c\s*e\s*>([\s\S]*?)<[\/\\]_?\s*c\s*e\s*>/gi, (match, inner) => {
    const trimmed = inner.replace(/^\\?\/?_?\s*c\s*e\s*/i, '').trim();
    return `<math>\\ce{${trimmed}}</math>`;
  });

  cleaned = cleaned.replace(
    /<\\?_?\s*p\s*u\s*>\s*([0-9\.\-]+(?:\s*\\?[a-zA-Z\Omega\%]+(?:-[a-zA-Z]+)?)?)/gi,
    (match, valUnit) => {
      return `<math>\\pu{${valUnit.trim()}}</math>`;
    }
  );

  cleaned = cleaned.replace(/<\/?_?\s*p\s*u\s*>/gi, '');
  cleaned = cleaned.replace(/<\/?_?\s*c\s*e\s*>/gi, '');

  // 2. Repair orphaned or broken <math> / </math> tags
  if (cleaned.includes('</math>') && !cleaned.includes('<math>')) {
    cleaned = cleaned.replace(/^([\s\S]+?)\s*<\/math>/gi, (match, inner) => {
      const trimmed = inner.trim();
      return `<math>${trimmed}</math>`;
    });
  }

  const openCount = (cleaned.match(/<math>/gi) || []).length;
  const closeCount = (cleaned.match(/<\/math>/gi) || []).length;
  if (openCount > closeCount) {
    cleaned += '</math>'.repeat(openCount - closeCount);
  }

  cleaned = cleaned.replace(/<math>\s*<\/math>/gi, '');
  cleaned = cleaned.replace(/<math>\s*<math>/gi, '<math>').replace(/<\/math>\s*<\/math>/gi, '</math>');

  const replaceInSpan = (inner) => {
    let span = repairControlCharEscapes(inner);

    // Collapse any sequence of 2 or more backslashes before a command letter (e.g. \\text -> \text, \\\frac -> \frac, \\\\times -> \times)
    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    // Fix corrupted math commands inside \text{...} (e.g. `\text{ \times}` -> `\text{ times}`, `\text{ \sec}` -> `\text{ sec}`)
    // KaTeX throws a parse error if math-only operators like \times or \sec appear inside \text{...}
    span = span.replace(/\\text\{([^{}]*)\}/g, (_, textBody) => {
      const cleanedTextBody = textBody.replace(/\\(times|sec|min|max|in|to|pm|mp|div|cdot)\b/g, '$1');
      return `\\text{${cleanedTextBody}}`;
    });

    // Protect \text{...}, \mathrm{...}, \ce{...}, and \pu{...} blocks before running bare-command regexes
    // so English words inside \text{ times} or \text{ min} are NEVER turned into \text{ \times}
    const protectedBlocks = [];
    span = span.replace(/\\(?:text|mathrm|ce|pu)\{[^{}]*\}/g, (match) => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `__MATH_PROTECTED_BLOCK_${idx}__`;
    });

    // Repair square roots: sqrt(3), sqrt3, \sqrt(3) -> \sqrt{3}
    span = span
      .replace(/(?<!\\)\bsqrt\s*\(?\s*([0-9a-zA-Z]+)\s*\)?/gi, '\\sqrt{$1}')
      .replace(/(?<!\\)\bsqrt\s*\{([^}]+)\}/gi, '\\sqrt{$1}');

    // Repair fractions (including fracN_pN_s, \fracN_pN_s, frac3pilambdar8, fracx5)
    span = repairFractionSyntax(span);

    // Repair unescaped Greek letters (outside protected \text/\mathrm/\ce/\pu blocks)
    span = span.replace(new RegExp(`(?<!\\\\)\\b(${GREEK_NAMES})\\b`, 'g'), '\\$1');

    // Repair unescaped math operators (outside protected \text/\mathrm/\ce/\pu blocks)
    span = span.replace(new RegExp(`(?<!\\\\)\\b(${OP_NAMES})\\b`, 'g'), '\\$1');

    // Restore protected blocks
    span = span.replace(/__MATH_PROTECTED_BLOCK_(\d+)__/g, (_, idx) => protectedBlocks[Number(idx)]);

    // Final safety pass: ensure no double backslashes before letters remain
    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    return span;
  };

  if (cleaned.includes('<math>')) {
    return cleaned.replace(/<math>([\s\S]*?)<\/math>/gi, (m, inner) => `<math>${replaceInSpan(inner)}</math>`);
  }

  return replaceInSpan(cleaned);
}

module.exports = {
  hasBareCommandRun,
  repairMissingMathBackslashes,
  convertMathMLToKaTeX,
  repairFractionSyntax,
  BARE_COMMAND_RUN_REGEX,
};
