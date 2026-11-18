/**
 * Shared Math Sanitizer & Malformed LaTeX Detection Service.
 * Used in server/routes/parse.js, reviewEvaluator.js, and MathRenderer.jsx.
 */

const GREEK_NAMES =
  'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Omega|Delta|Theta|Lambda|Gamma|Sigma|Phi|Psi';

// Note: Plain English prepositions like "in" or "to" are intentionally excluded from bare-word
// auto-prefixing so phrases like "High resistance in parallel" are never corrupted into "\in parallel".
const OP_NAMES =
  'times|cdot|pm|mp|infty|text|mathrm|ce|pu|hat|bar|vec|sqrt|sum|int|oint|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|det|adj|neq|leq|geq|approx|equiv|propto|partial|nabla|forall|exists|notin|subset|subseteq|cup|cap|therefore|angle|rightarrow|Rightarrow|leftarrow|Leftarrow|leftrightarrow';

// Single-letter ASCII tokens that are NOT valid standalone math-mode LaTeX commands inside a matrix cell
// (when JSON.parse decodes an unescaped row break `\\a` or `\\x^3` into `\a` or `\x^3`).
// Valid 2+ letter LaTeX commands (like \operatorname, \varepsilon, \varphi, \vartheta, \exp, \hline, \implies, \iff, \ell, \Re, \Im, \dim, \ker, \big, \Big, \dot, \cancel, \boxed)
// are NEVER touched when preceded by a single backslash!
const SINGLE_LETTER_MATRIX_VARS = /^[a-zA-Z]$/;

// Detect likely-broken LaTeX: bare commands without backslash glued to numbers or other terms (e.g. "frac3pilambdar8", "sqrt3", "fracx5", "fracN_pN_s")
const BARE_COMMAND_RUN_REGEX =
  /(?<!\\)\b(frac|sqrt|pi|lambda|theta|alpha|beta|gamma|delta|sigma|omega)([0-9a-zA-Z\{\}\+\-\*\/\^\._]+)/i;

/**
 * Repairs matrix, determinant, and cases environments (\begin{bmatrix|vmatrix|pmatrix|matrix|Bmatrix|Vmatrix|cases|array|aligned}...\end{...})
 * so that row breaks (`\\`) are never collapsed into single backslashes (`\ `, `\-1`, `\a`, `\x^3`, `\alpha`)
 * while preserving all valid multi-letter LaTeX commands (`\operatorname{adj}`, `\varepsilon`, `\hline`, `\exp`, `\Re`, `\Im`, etc.).
 */
function repairMatrixEnvironments(span) {
  if (!span || typeof span !== 'string' || !span.includes('begin{')) return span;

  return span.replace(
    /(\\begin\{(?:[bpvBV]?matrix|cases|array|aligned)\})([\s\S]*?)(\\end\{(?:[bpvBV]?matrix|cases|array|aligned)\})/g,
    (_, beginTag, body, endTag) => {
      let fixedBody = body;

      // 1. If 3+ backslashes precede a letter word (e.g. \\\alpha, \\\operatorname{adj}, \\\beta):
      //    If it's a single letter variable (e.g. \\\a & \beta), treat as row break + variable `\\ a`;
      //    If it's a multi-letter command (e.g. \\\alpha), treat as row break + command `\\ \alpha`.
      fixedBody = fixedBody.replace(/\\{3,}([a-zA-Z]+)/g, (m, word) => {
        if (SINGLE_LETTER_MATRIX_VARS.test(word)) {
          return `\\\\ ${word}`;
        }
        return `\\\\ \\${word}`;
      });

      // 2. If exactly 2 backslashes precede a letter word (`\\a`, `\\x^3`, `\\alpha`):
      //    - If `word` is a single-letter variable (`a`, `b`, `c`, `x`, `y`, `z`, `r`, `n`, `m`, etc.), it is a row break `\\` + variable (`\\ a`).
      //    - If `word` is a multi-letter command (`\\alpha`, `\\operatorname`), it is a row break `\\` + command (`\\ \alpha`).
      fixedBody = fixedBody.replace(/\\{2}([a-zA-Z]+)/g, (m, word) => {
        if (SINGLE_LETTER_MATRIX_VARS.test(word)) {
          return `\\\\ ${word}`;
        }
        return `\\\\ \\${word}`;
      });

      // 3. If 1 or more backslashes precede a digit, minus, or plus (`\1`, `\\1`, `\-1`, `\\-1`, `\\2r`), it's a row break!
      fixedBody = fixedBody.replace(/\\+(?=[0-9\-\+])/g, '\\\\ ');

      // 4. If a single backslash is followed by whitespace (`\ 1 & 0`, `\ \alpha`, `\ -\beta`), restore to row break `\\ `
      fixedBody = fixedBody.replace(/(?<!\\)\\(?=\s)/g, '\\\\');

      // 5. If a single backslash precedes a SINGLE ASCII letter variable (e.g. `\a & \beta`, `\x^3 - x`, `\r & 1`),
      //    where JSON.parse turned `\\a` into `\a`, restore it to `\\ a`.
      //    NEVER touch any multi-letter LaTeX command (e.g. `\varepsilon`, `\operatorname`, `\hline`, `\exp`, `\Re`, `\Im`, `\ell`, `\dim`, `\ker`)!
      fixedBody = fixedBody.replace(/(?<!\\)\\([a-zA-Z])(?![a-zA-Z])/g, '\\\\ $1');

      return `${beginTag}${fixedBody}${endTag}`;
    }
  );
}

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
function convertMathMLToKaTeX(text) {
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
 * inside LaTeX commands (e.g. `\text`, `\times`, `\theta`, `\frac`, `\nCr`, `\rho`, `\beta`, `\neq`, `\nu`).
 */
function repairControlCharEscapes(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/\x09(ext(?:bf|it|rm)?|imes|heta|au|anh?|o(?![a-zA-Z])|op(?![a-zA-Z])|riangle|ilde|frac|iny)/g, '\\t$1')
    .replace(/\x0C(rac|orall|lat|rown)/g, '\\f$1')
    .replace(
      /\x0A(Cr|Pr|eq|eg|u(?![a-zA-Z])|abla|otsubset|ot(?![a-zA-Z])|i(?![a-zA-Z])|ewline|ormalsize|mid|parallel|sim|atural|oindent)/g,
      '\\n$1'
    )
    .replace(/\x0D(ho|ight(?:arrow|harpoondown|harpoonup|leftarrows|leftharpoons)?|angle|ceil|floor)/g, '\\r$1')
    .replace(
      /\x08(eta|ar|inom|egin|ig(?:ger|g|l|r|m)?|ullet|ox|ot(?![a-zA-Z])|ackslash|bmod|ecause)/g,
      '\\b$1'
    );
}

/**
 * Repairs balanced `<math>` and `</math>` tags locally without swallowing plain English text
 * across multiple formulas when a single opening or closing tag is missing.
 */
function balanceMathTagsLocally(str) {
  if (typeof str !== 'string' || (!str.includes('<math>') && !str.includes('</math>'))) {
    return str;
  }

  let s = str;

  if (s.includes('</math>') && !s.includes('<math>')) {
    return s.replace(/^([\s\S]+?)\s*<\/math>/gi, (_, inner) => `<math>${inner.trim()}</math>`);
  }

  s = s.replace(/<math>\s*<math>/gi, '<math>').replace(/<\/math>\s*<\/math>/gi, '</math>');

  const tagRegex = /<\/?math>/gi;
  let result = '';
  let lastIndex = 0;
  let inMath = false;
  let match;

  while ((match = tagRegex.exec(s)) !== null) {
    const tag = match[0].toLowerCase();
    const segment = s.substring(lastIndex, match.index);

    if (tag === '<math>') {
      if (inMath) {
        const englishBridge = segment.match(/^([\s\S]*?)(\s+(?:and|or|where|if|then|such\s+that|is\s+equal\s+to|for\s+all)\s+[\s\S]*)$/i);
        if (englishBridge && englishBridge[1].trim()) {
          result += `${englishBridge[1].trim()}</math>${englishBridge[2]}<math>`;
        } else {
          result += `${segment}</math><math>`;
        }
      } else {
        result += segment + '<math>';
        inMath = true;
      }
    } else {
      if (inMath) {
        result += segment + '</math>';
        inMath = false;
      } else {
        if (!result && segment.trim()) {
          result += `<math>${segment.trim()}</math>`;
        } else {
          result += segment;
        }
      }
    }
    lastIndex = tagRegex.lastIndex;
  }

  const tail = s.substring(lastIndex);
  if (inMath) {
    const englishTail = tail.match(/^([\s\S]*?)(\s+(?:is\s+equal\s+to|has\s+infinitely|lie\s+in\s+the\s+interval|then\s+the\s+sum)[\s\S]*)$/i);
    if (englishTail && englishTail[1].trim()) {
      result += `${englishTail[1].trim()}</math>${englishTail[2]}`;
    } else {
      result += `${tail}</math>`;
    }
  } else {
    result += tail;
  }

  return result.replace(/<math>\s*<\/math>/gi, '');
}

/**
 * Repairs `\text{...}` and `\textrm{...}` blocks inside a math span so they never crash KaTeX.
 */
function sanitizeTextBlocksInMath(span) {
  if (!span || typeof span !== 'string') return span;

  return span.replace(/\\text(?:rm)?\{([^{}]*)\}/g, (fullMatch, rawBody) => {
    let body = rawBody.replace(
      /\\(times|sec|min|max|det|adj|in|to|and|or|for|if|is|of|volt|volts|amp|amps|ohm|ohms|watt|watts|joule|joules|meter|meters|cm|mm|km|kg|gm|hr|hrs|hour|hours|day|days)\b/gi,
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

/**
 * Cleans up accidental LaTeX backslashes leaked into plain English text OUTSIDE `<math>` tags
 * (such as `"High resistance \in parallel"` -> `"High resistance in parallel"` or `"\Gamma rays"` -> `"Gamma rays"`).
 */
function cleanLeakedBackslashesInPlainText(plainSegment) {
  if (!plainSegment || typeof plainSegment !== 'string') return plainSegment;
  return plainSegment
    .replace(
      /\\+(in|to|times|sec|min|max|pm|mp|bar|hat|vec|sum|int|lim|log|ln|sin|cos|tan|cot|csc|det|adj|and|or|if|for|is|of)\b/g,
      '$1'
    )
    .replace(
      /\\+(Gamma|Alpha|Beta|Delta|Theta|Lambda|Sigma|Phi|Psi|Omega|gamma|alpha|beta|delta|theta|lambda|sigma|omega)\b/g,
      '$1'
    );
}

/**
 * Auto-repairs missing LaTeX backslashes, over-escaped double backslashes (\\text, \\frac),
 * matrix/determinant row breaks (\\), `\text{ \Omega}` text-mode crashes, `\text{ \times}` spans,
 * fake XML tags, & brackets in math expressions.
 * Strictly idempotent across multiple passes.
 * @param {string} text
 * @returns {string} Repaired LaTeX text
 */
function repairMissingMathBackslashes(text) {
  if (typeof text !== 'string' || !text.trim()) return text;

  let cleaned = repairControlCharEscapes(text);
  cleaned = convertMathMLToKaTeX(cleaned);
  cleaned = cleaned.replace(
    /\n(?!(?:Cr|Pr|u|abla|eq|eg|ewline|otsubset|ot|i|n|ormalsize|mid|parallel|sim|atural|oindent)(?![a-zA-Z]))/gi,
    ' '
  );

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

  cleaned = balanceMathTagsLocally(cleaned);

  const replaceInSpan = (inner) => {
    let span = repairControlCharEscapes(inner);

    span = repairMatrixEnvironments(span);

    const matrixBlocks = [];
    span = span.replace(
      /\\begin\{(?:[bpvBV]?matrix|cases|array|aligned)\}[\s\S]*?\\end\{(?:[bpvBV]?matrix|cases|array|aligned)\}/g,
      (mat) => {
        const protectedMat = mat.replace(/\\\\(\s+)/g, '__MATRIX_ROW_SEP__$1');
        const idx = matrixBlocks.length;
        matrixBlocks.push(protectedMat);
        return `__MATRIX_ENV_BLOCK_${idx}__`;
      }
    );

    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');

    span = span.replace(/__MATRIX_ENV_BLOCK_(\d+)__/g, (_, idx) => {
      return matrixBlocks[Number(idx)].replace(/\\{2,}(?=[a-zA-Z])/g, '\\');
    });

    span = sanitizeTextBlocksInMath(span);
    span = span.replace(/\\adj\b/g, '\\text{adj}');
    span = span.replace(/(?<![a-zA-Z0-9\}\)])\^\s*\\circ\b/g, '{}^{\\circ}');

    const protectedBlocks = [];
    span = span.replace(/\\(?:text|mathrm|ce|pu|operatorname)\{[^{}]*\}/g, (match) => {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `__MATH_PROTECTED_BLOCK_${idx}__`;
    });

    span = span
      .replace(/(?<!\\)\bsqrt\s*\(?\s*([0-9a-zA-Z]+)\s*\)?/gi, '\\sqrt{$1}')
      .replace(/(?<!\\)\bsqrt\s*\{([^}]+)\}/gi, '\\sqrt{$1}');

    span = repairFractionSyntax(span);

    span = span.replace(new RegExp(`(?<!\\\\)\\b(${GREEK_NAMES})\\b`, 'g'), '\\$1');

    span = span.replace(new RegExp(`(?<!\\\\)\\b(${OP_NAMES})\\b`, 'g'), (m, op) => {
      if (op === 'adj') return '\\text{adj}';
      return `\\${op}`;
    });

    span = span.replace(/__MATH_PROTECTED_BLOCK_(\d+)__/g, (_, idx) => protectedBlocks[Number(idx)]);
    span = span.replace(/\\{2,}(?=[a-zA-Z])/g, '\\');
    span = span.replace(/__MATRIX_ROW_SEP__/g, '\\\\');

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
    !/\\(?:frac|sqrt|text|mathrm|pu|ce|Omega|omega|mu|pi|alpha|beta|gamma|delta|theta|lambda|sigma|times|cdot|pm|int|sum|lim|begin|end)\b/.test(
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
  repairMatrixEnvironments,
  balanceMathTagsLocally,
  convertMathMLToKaTeX,
  repairFractionSyntax,
  sanitizeTextBlocksInMath,
  cleanLeakedBackslashesInPlainText,
  BARE_COMMAND_RUN_REGEX,
};
