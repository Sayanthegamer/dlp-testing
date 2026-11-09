/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service.
 * Used in server/routes/parse.js, reviewEvaluator.js, and MathRenderer.jsx.
 */

const GREEK_NAMES =
  'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';

// Note: Plain English prepositions like "in" or "to" are intentionally excluded from bare-word
// auto-prefixing so phrases like "High resistance in parallel" are never corrupted into "\in parallel".
const OP_NAMES =
  'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|oint|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|neq|leq|geq|approx|equiv|propto|partial|nabla|forall|exists|notin|subset|subseteq|cup|cap|therefore|angle|rightarrow|Rightarrow|leftarrow|Leftarrow|leftrightarrow';

// Detect likely-broken LaTeX: bare commands without backslash glued to numbers or other terms (e.g. "frac3pilambdar8", "sqrt3", "fracx5", "fracN_pN_s")
const BARE_COMMAND_RUN_REGEX =
  /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)([0-9a-zA-Z\{\}\+\-\*\/\^\._]+)/i;

/**
 * Checks if text contains malformed bare LaTeX command runs missing leading backslashes,
 * double-backslash command breaks (e.g. \\text, \\frac), or math-mode symbols trapped inside \text{...}.
 * @param {string} text
 * @returns {boolean} true if malformed bare command run detected
 */
function hasBareCommandRun(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  const mathMatches = text.match(/<math>([\s\S]*?)<\/math>/gi);
  if (!mathMatches || mathMatches.length === 0) {
    // Outside <math>, flag if raw LaTeX escapes like \in or \Gamma leaked into plain text
    return /\\(?:in|Gamma|Alpha|Beta|Delta|Omega|frac|sqrt|text)\b/.test(text);
  }

  for (const span of mathMatches) {
    const cleanSpan = span.replace(/<\/?math>/gi, '').trim();
    if (BARE_COMMAND_RUN_REGEX.test(cleanSpan)) {
      return true;
    }
    if (
      /\\{2,}(?:text|mathrm|frac|sqrt|pi|times|cdot|ce|pu|alpha|beta|gamma|delta|theta|lambda|mu|sigma|omega|Omega)\b/.test(
        cleanSpan
      )
    ) {
      return true;
    }
    // Math-only symbols (\Omega, \mu, ^, _) inside \text{...} fail in KaTeX text mode
    if (/\\text\{[^{}]*(?:\\[a-zA-Z]+|[\^_])[^{}]*\}/.test(cleanSpan)) {
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
 */
function repairFractionSyntax(str) {
  if (!str || typeof str !== 'string') return str;
  let out = str;

  out = out.replace(/(?<!\\)\bfrac(?=\{)/g, '\\frac');

  out = out.replace(
    /\\frac\{([a-zA-Z]_[a-zA-Z0-9]+|[a-zA-Z]\^[a-zA-Z0-9]+)\s*([a-zA-Z]_[a-zA-Z0-9]+|[a-zA-Z]\^[a-zA-Z0-9]+)\}(?!\s*\{)/g,
    '\\frac{$1}{$2}'
  );

  out = out.replace(
    /\\?\bfrac\s*([a-zA-Z]_(?:\{[^{}]+\}|[a-zA-Z0-9]+)|[a-zA-Z]\^(?:\{[^{}]+\}|[a-zA-Z0-9]+))\s*([a-zA-Z]_(?:\{[^{}]+\}|[a-zA-Z0-9]+)|[a-zA-Z]\^(?:\{[^{}]+\}|[a-zA-Z0-9]+))/g,
    '\\frac{$1}{$2}'
  );

  out = out.replace(
    /\\frac\{([^{}]+)\}\s*([a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)?)(?!\s*\{)/g,
    '\\frac{$1}{$2}'
  );

  out = out.replace(/(?<!\\)\bfrac([a-zA-Z0-9_\\\+\-\*\/\^\.\s]+)/g, (match, body) => {
    const trimmed = body.trim();
    if (!trimmed) return match;
    if (/^[a-zA-Z0-9]{2}$/.test(trimmed)) {
      return `\\frac{${trimmed[0]}}{${trimmed[1]}}`;
    }
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
    .replace(/\x09(ext(?:bf|it|rm)?|imes|heta|au|anh?|o\b|op\b|riangle|ilde|frac|iny)/g, '\\t$1')
    .replace(/\x0C(rac|orall|lat|rown)/g, '\\f$1')
    .replace(/\x0A(Cr|Pr|eq|eg|u\b|abla|otsubset|ot\b|i\b|ewline|ormalsize|mid|parallel|sim)/g, '\\n$1')
    .replace(/\x0D(ho|ight(?:arrow|harpoondown|harpoonup|leftarrows|leftharpoons)?|angle|ceil|floor)/g, '\\r$1')
    .replace(/\x08(eta|ar|inom|egin|ig(?:ger|g|l|r|m)?|ullet|ox|ot\b|ackslash|bmod|ecause)/g, '\\b$1');
}

/**
 * Repairs `\text{...}` and `\textrm{...}` blocks inside a math span so they never crash KaTeX.
 *
 * Why this is critical:
 * In KaTeX, `\text{...}` switches to text mode where math-mode commands like `\Omega`, `\mu`,
 * `\circ`, `\degree`, `\times`, `\pm`, `\cdot`, and superscripts/subscripts (`^`, `_`) throw:
 * `KaTeX parse error: Can't use function '\Omega' in text mode` (e.g. `P = 10 \text{ \Omega}` or `20 \text{ \Omega}`).
 */
function sanitizeTextBlocksInMath(span) {
  if (!span || typeof span !== 'string') return span;

  return span.replace(/\\text(?:rm)?\{([^{}]*)\}/g, (fullMatch, rawBody) => {
    // 1. Strip accidental backslashes before English words inside \text{...}
    let body = rawBody.replace(
      /\\(times|sec|min|max|in|to|and|or|for|if|is|of|volt|volts|amp|amps|ohm|ohms|watt|watts|joule|joules|meter|meters|cm|mm|km|kg|gm|hr|hrs|hour|hours|day|days)\b/gi,
      '$1'
    );

    // 2. Replace \degree or ^\circ inside \text{...}
    body = body.replace(/\\degree\b/g, '^\\circ');

    // 3. If the body has NO LaTeX commands (`\...`), NO superscripts (`^`), and NO subscripts (`_`),
    // it is pure plain text (e.g. `\text{ Volt}`, `\text{ times}`, `\text{ V/m}`), which is 100% valid in KaTeX!
    if (!/[\\^_]/.test(body)) {
      return `\\text{${body}}`;
    }

    // 4. Otherwise, the \text{...} block contains math-mode tokens (e.g. `\Omega`, `k\Omega`, `\mu F`, `^\circ C`, `m/s^2`).
    // Convert it into math-mode Roman + symbol notation so KaTeX renders it without error!
    const hasLeadingSpace = /^\s/.test(body);
    let mathUnit = body.trim();

    // Handle standalone^\circ at start of unit (e.g. `^\circ C` -> `{}^{\circ}\mathrm{C}`)
    mathUnit = mathUnit.replace(/^\^\s*\\circ\s*([a-zA-Z]*)/, (_, unitAfter) => {
      return unitAfter ? `{}^{\\circ}\\mathrm{${unitAfter}}` : `{}^{\\circ}`;
    });

    // Protect existing `\command` tokens while wrapping bare ASCII letter runs in `\mathrm{...}`
    const cmdTokens = [];
    mathUnit = mathUnit.replace(/\\[a-zA-Z]+/g, (cmd) => {
      const idx = cmdTokens.length;
      cmdTokens.push(cmd);
      return `@@CMD${idx}@@`;
    });

    // Wrap consecutive ASCII letters (not part of @@CMD...) in \mathrm{...}
    mathUnit = mathUnit.replace(/\b([a-zA-Z]+)\b/g, (match) => {
      if (match.startsWith('CMD')) return match;
      return `\\mathrm{${match}}`;
    });

    // Restore LaTeX commands (e.g. \Omega, \mu, \circ)
    mathUnit = mathUnit.replace(/@@CMD(\d+)@@/g, (_, idx) => cmdTokens[Number(idx)]);

    // Replace remaining spaces between unit tokens with thin spaces `\,`
    mathUnit = mathUnit.replace(/\s+/g, '\\,');

    return (hasLeadingSpace ? '\\,' : '') + mathUnit;
  });
}

/**
 * Cleans up accidental LaTeX backslashes leaked into plain English text OUTSIDE `<math>` tags
 * (such as `"High resistance \in parallel"` -> `"High resistance in parallel"` or `"\Gamma rays"` -> `"Gamma rays"`).
 */
function cleanLeakedBackslashesInPlainText(plainSegment) {
  if (!plainSegment || typeof plainSegment !== 'string') return plainSegment;
  return plainSegment
    // Fix `\in parallel`, `\in series`, `\in air`, `\to convert`, `\times`, etc. in plain English
    .replace(
      /\\+(in|to|times|sec|min|max|pm|mp|bar|hat|vec|sum|int|lim|log|ln|sin|cos|tan|cot|csc|and|or|if|for|is|of)\b/g,
      '$1'
    )
    // Fix `\Gamma rays`, `\Alpha particles`, `\Beta decay`, `\Delta`, etc. in plain English
    .replace(
      /\\+(Gamma|Alpha|Beta|Delta|Theta|Lambda|Sigma|Phi|Psi|Omega|gamma|alpha|beta|delta|theta|lambda|sigma|omega)\b/g,
      '$1'
    );
}

/**
 * Auto-repairs missing LaTeX backslashes, over-escaped double backslashes (\\text, \\frac),
 * `\text{ \Omega}` text-mode crashes, `\text{ \times}` spans, fake XML tags, & brackets in math expressions.
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

    // Collapse any sequence of 2 or more backslashes before a command letter (e.g. \\text -> \text, \\\frac -> \frac, \\\\Omega -> \Omega)
    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    // Sanitize \text{...} blocks so \text{ \Omega}, \text{ k\Omega}, \text{ \mu F}, \text{ \times} never crash KaTeX
    span = sanitizeTextBlocksInMath(span);

    // Ensure standalone ^\circ (not preceded by a variable/number/brace) has an empty base {}^\circ
    span = span.replace(/(?<![a-zA-Z0-9\}\)])\^\s*\\circ\b/g, '{}^{\\circ}');

    // Protect \text{...}, \mathrm{...}, \ce{...}, and \pu{...} blocks before running bare-command regexes
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
    // Process plain text segments outside <math>...</math> to strip leaked backslashes (\in parallel, \Gamma rays),
    // and process inner <math>...</math> segments with replaceInSpan!
    const parts = [];
    const mathRegex = /<math>([\s\S]*?)<\/math>/gi;
    let lastIdx = 0;
    let m;
    while ((m = mathRegex.exec(cleaned)) !== null) {
      if (m.index > lastIdx) {
        parts.push(cleanLeakedBackslashesInPlainText(cleaned.substring(lastIdx, m.index)));
      }
      parts.push(`<math>${replaceInSpan(m[1])}</math>`);
      lastIdx = mathRegex.lastIndex;
    }
    if (lastIdx < cleaned.length) {
      parts.push(cleanLeakedBackslashesInPlainText(cleaned.substring(lastIdx)));
    }
    return parts.join('');
  }

  // When called on a string WITHOUT <math> tags:
  // Distinguish between plain English phrases (e.g. "High resistance in parallel", "Gamma rays", "Q1. (1) The circuit has 2R and X in series")
  // vs raw inner math formulas passed directly by MathRenderer / reviewEvaluator / unit tests (e.g. "2R \Omega", "P = 10 \text{ \Omega}", "frac3pilambdar8").
  const looksLikePlainEnglishSentence =
    !BARE_COMMAND_RUN_REGEX.test(cleaned) &&
    !/\\(?:frac|sqrt|text|mathrm|pu|ce|Omega|omega|mu|pi|alpha|beta|gamma|delta|theta|lambda|sigma|times|cdot|pm|int|sum|lim)\b/.test(
      cleaned
    ) &&
    !/[\^_{}=]/.test(cleaned);

  if (looksLikePlainEnglishSentence) {
    return cleanLeakedBackslashesInPlainText(cleaned);
  }

  return replaceInSpan(cleaned);
}

module.exports = {
  hasBareCommandRun,
  repairMissingMathBackslashes,
  convertMathMLToKaTeX,
  repairFractionSyntax,
  sanitizeTextBlocksInMath,
  cleanLeakedBackslashesInPlainText,
  BARE_COMMAND_RUN_REGEX,
};
