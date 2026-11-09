/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service (Client ES Module).
 */

const GREEK_NAMES =
  'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';

// Note: Plain English prepositions like "in" or "to" are intentionally excluded from bare-word
// auto-prefixing so phrases like "High resistance in parallel" are never corrupted into "\in parallel".
const OP_NAMES =
  'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|oint|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|neq|leq|geq|approx|equiv|propto|partial|nabla|forall|exists|notin|subset|subseteq|cup|cap|therefore|angle|rightarrow|Rightarrow|leftarrow|Leftarrow|leftrightarrow';

export const BARE_COMMAND_RUN_REGEX =
  /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)([0-9a-zA-Z\{\}\+\-\*\/\^\._]+)/i;

/**
 * Checks if text contains malformed bare LaTeX command runs missing leading backslashes,
 * double-backslash command breaks (e.g. \\text, \\frac), or math-mode symbols trapped inside \text{...}.
 * @param {string} text
 * @returns {boolean} true if malformed bare command run detected
 */
export function hasBareCommandRun(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  const mathMatches = text.match(/<math>([\s\S]*?)<\/math>/gi);
  if (!mathMatches || mathMatches.length === 0) {
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
export function convertMathMLToKaTeX(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  if (!/<(?:mn|mi|mo|mfrac|msup|msub|msqrt|mrow|math\s|annotation)/i.test(text)) return text;

  let cleaned = text;

  cleaned = cleaned.replace(
    /<annotation\s+encoding=["']application\/x-tex["']\s*>([\s\S]*?)<\/annotation>/gi,
    (match, latex) => {
      return `<math>${latex.trim()}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<mn>([\d\.]+)\s*<\/mn>\s*(?:<mo>.*?<\/mo>\s*)?<mi\s+mathvariant=["']normal["']\s*>([a-zA-Z\Omega]+)<\/mi>/gi,
    (match, val, unit) => {
      return `<math>\\pu{${val} ${unit}}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<mfrac>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/mfrac>/gi,
    (match, num, den) => {
      const cleanNum = num.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanDen = den.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>\\frac{${cleanNum}}{${cleanDen}}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<msup>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msup>/gi,
    (match, base, exp) => {
      const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanExp = exp.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>{${cleanBase}}^{${cleanExp}}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<msub>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msub>/gi,
    (match, base, sub) => {
      const cleanBase = base.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      const cleanSub = sub.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>{${cleanBase}}_{${cleanSub}}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<msqrt>\s*(?:<mrow>)?([\s\S]*?)(?:<\/mrow>)?\s*<\/msqrt>/gi,
    (match, inner) => {
      const cleanInner = inner.replace(/<\/?(?:mn|mi|mo|mrow)\b[^>]*>/gi, '').trim();
      return `<math>\\sqrt{${cleanInner}}</math>`;
    }
  );

  cleaned = cleaned.replace(
    /<mi\s+mathvariant=["']normal["']\s*>([\s\S]*?)<\/mi>/gi,
    (match, inner) => {
      return `<math>\\mathrm{${inner.trim()}}</math>`;
    }
  );

  cleaned = cleaned.replace(/<mn>([\s\S]*?)<\/mn>/gi, '$1');

  cleaned = cleaned.replace(/<mi>([\s\S]*?)<\/mi>/gi, (match, varName) => {
    const trimmed = varName.trim();
    return trimmed ? `<math>${trimmed}</math>` : '';
  });

  cleaned = cleaned.replace(/<mo>([\s\S]*?)<\/mo>/gi, '$1');

  cleaned = cleaned.replace(/<\/?(?:mrow|semantics|annotation|style)\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<math\b[^>]*>/gi, '<math>').replace(/<\/math>/gi, '</math>');

  cleaned = cleaned.replace(/<\/math>\s*<math>/gi, ' ');

  return cleaned;
}

/**
 * Repairs bare or partially-braced `frac` expressions into valid 2-argument `\frac{num}{den}`.
 */
export function repairFractionSyntax(str) {
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
 */
export function sanitizeTextBlocksInMath(span) {
  if (!span || typeof span !== 'string') return span;

  return span.replace(/\\text(?:rm)?\{([^{}]*)\}/g, (fullMatch, rawBody) => {
    let body = rawBody.replace(
      /\\(times|sec|min|max|in|to|and|or|for|if|is|of|volt|volts|amp|amps|ohm|ohms|watt|watts|joule|joules|meter|meters|cm|mm|km|kg|gm|hr|hrs|hour|hours|day|days)\b/gi,
      '$1'
    );

    body = body.replace(/\\degree\b/g, '^\\circ');

    if (!/[\\^_]/.test(body)) {
      return `\\text{${body}}`;
    }

    const hasLeadingSpace = /^\s/.test(body);
    let mathUnit = body.trim();

    mathUnit = mathUnit.replace(/^\^\s*\\circ\s*([a-zA-Z]*)/, (_, unitAfter) => {
      return unitAfter ? `{}^{\\circ}\\mathrm{${unitAfter}}` : `{}^{\\circ}`;
    });

    const cmdTokens = [];
    mathUnit = mathUnit.replace(/\\[a-zA-Z]+/g, (cmd) => {
      const idx = cmdTokens.length;
      cmdTokens.push(cmd);
      return `@@CMD${idx}@@`;
    });

    mathUnit = mathUnit.replace(/\b([a-zA-Z]+)\b/g, (match) => {
      if (match.startsWith('CMD')) return match;
      return `\\mathrm{${match}}`;
    });

    mathUnit = mathUnit.replace(/@@CMD(\d+)@@/g, (_, idx) => cmdTokens[Number(idx)]);

    mathUnit = mathUnit.replace(/\s+/g, '\\,');

    return (hasLeadingSpace ? '\\,' : '') + mathUnit;
  });
}

export function cleanLeakedBackslashesInPlainText(plainSegment) {
  if (!plainSegment || typeof plainSegment !== 'string') return plainSegment;
  return plainSegment
    .replace(
      /\\+(in|to|times|sec|min|max|pm|mp|bar|hat|vec|sum|int|lim|log|ln|sin|cos|tan|cot|csc|and|or|if|for|is|of)\b/g,
      '$1'
    )
    .replace(
      /\\+(Gamma|Alpha|Beta|Delta|Theta|Lambda|Sigma|Phi|Psi|Omega|gamma|alpha|beta|delta|theta|lambda|sigma|omega)\b/g,
      '$1'
    );
}

/**
 * Auto-repairs missing LaTeX backslashes, over-escaped double backslashes (\\text, \\frac),
 * `\text{ \Omega}` text-mode crashes, `\text{ \times}` spans, fake XML tags, & brackets in math expressions.
 * @param {string} text
 * @returns {string} Repaired LaTeX text
 */
export function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  let cleaned = repairControlCharEscapes(text);
  cleaned = convertMathMLToKaTeX(cleaned);
  cleaned = cleaned.replace(/\n(?!(?:Cr|Pr|u|abla|eq|eg|ewline|otsubset|ot|i|n|ormalsize)\b)/gi, ' ');

  cleaned = cleaned
    .replace(/\\+pu\{\\?(?:Omega|ohm)\}/gi, '\\Omega')
    .replace(/\\+mathrm\{\\?(?:Omega|ohm)\}/gi, '\\Omega');

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

    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    span = sanitizeTextBlocksInMath(span);

    span = span.replace(/(?<![a-zA-Z0-9\}\)])\^\s*\\circ\b/g, '{}^{\\circ}');

    const protectedBlocks = [];
    span = span.replace(/\\(?:text|mathrm|ce|pu)\{[^{}]*\}/g, (match) => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `__MATH_PROTECTED_BLOCK_${idx}__`;
    });

    span = span
      .replace(/(?<!\\)\bsqrt\s*\(?\s*([0-9a-zA-Z]+)\s*\)?/gi, '\\sqrt{$1}')
      .replace(/(?<!\\)\bsqrt\s*\{([^}]+)\}/gi, '\\sqrt{$1}');

    span = repairFractionSyntax(span);

    span = span.replace(new RegExp(`(?<!\\\\)\\b(${GREEK_NAMES})\\b`, 'g'), '\\$1');
    span = span.replace(new RegExp(`(?<!\\\\)\\b(${OP_NAMES})\\b`, 'g'), '\\$1');

    span = span.replace(/__MATH_PROTECTED_BLOCK_(\d+)__/g, (_, idx) => protectedBlocks[Number(idx)]);
    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    return span;
  };

  if (cleaned.includes('<math>')) {
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
