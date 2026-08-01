/**
 * Visual Math Helper: Enables visual formula manipulation for teachers without LaTeX.
 */

// Convert LaTeX string to visual symbol tokens for visual editor display
export function latexToVisualText(latex) {
  if (!latex) return '';
  
  let visual = latex;

  // Replace matrices \begin{bmatrix} a & b \\ c & d \end{bmatrix} -> matrix(a, b; c, d)
  visual = visual.replace(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/gs, (_, body) => {
    const rows = body.trim().split('\\\\').map(r => r.split('&').map(cell => cell.trim()).join(', '));
    return `matrix(${rows.join('; ')})`;
  });

  // Replace determinants \begin{vmatrix} a & b \\ c & d \end{vmatrix} -> det(a, b; c, d)
  visual = visual.replace(/\\begin\{vmatrix\}(.*?)\\end\{vmatrix\}/gs, (_, body) => {
    const rows = body.trim().split('\\\\').map(r => r.split('&').map(cell => cell.trim()).join(', '));
    return `det(${rows.join('; ')})`;
  });

  // Replace cases \begin{cases} a, & b \\ c, & d \end{cases} -> cases(a if b, c if d)
  visual = visual.replace(/\\begin\{cases\}(.*?)\\end\{cases\}/gs, (_, body) => {
    const rows = body.trim().split('\\\\').map(r => {
      const cleanR = r.replace(/\\text\{if\s*\}/g, '').replace(/\\text\{if\}/g, '');
      const parts = cleanR.split('&').map(p => p.trim());
      if (parts.length === 2) return `${parts[0].replace(/,$/, '').trim()} if ${parts[1].trim()}`;
      return r.trim();
    });
    return `cases(${rows.join(', ')})`;
  });

  // Replace chemistry \ce{...} -> chem(...)
  visual = visual.replace(/\\ce\{([^}]+)\}/g, 'chem($1)');
  // Replace physics unit \pu{...} -> unit(...)
  visual = visual.replace(/\\pu\{([^}]+)\}/g, 'unit($1)');

  // Replace combinatorics \nCr{n}{r} -> nCr(n, r)
  visual = visual.replace(/\\nCr\{([^}]+)\}\{([^}]+)\}/g, 'nCr($1, $2)');
  // Replace permutations \nPr{n}{r} -> nPr(n, r)
  visual = visual.replace(/\\nPr\{([^}]+)\}\{([^}]+)\}/g, 'nPr($1, $2)');
  // Replace binomial coefficient \binom{n}{r} -> binom(n, r)
  visual = visual.replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, 'binom($1, $2)');

  // Replace complex conjugate \bar{z} -> bar(z)
  visual = visual.replace(/\\bar\{([^}]+)\}/g, 'bar($1)');
  // Replace Re/Im/arg functions
  visual = visual.replace(/\\text\{Re\}\(([^)]+)\)/g, 'Re($1)')
                 .replace(/\\text\{Im\}\(([^)]+)\)/g, 'Im($1)')
                 .replace(/\\text\{arg\}\(([^)]+)\)/g, 'arg($1)');

  // Replace vector \vec{A} -> vec(A)
  visual = visual.replace(/\\vec\{([^}]+)\}/g, 'vec($1)');
  // Replace unit vector \hat{A} / \vhat{A} -> hat(A)
  visual = visual.replace(/\\(?:vhat|hat)\{([^}]+)\}/g, 'hat($1)');

  // Replace limits \lim_{a \to b} -> lim[a→b]
  visual = visual.replace(/\\lim_\{([^}\s]+)\s*\\to\s*([^}]+)\}/g, 'lim[$1→$2]');
  // Replace integrals \int_{a}^{b} -> int[a→b]
  visual = visual.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, 'int[$1→$2] ');
  // Replace summations \sum_{a}^{b} -> sum[a→b]
  visual = visual.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'sum[$1→$2] ');
  // Replace products \prod_{a}^{b} -> prod[a→b]
  visual = visual.replace(/\\prod_\{([^}]+)\}\^\{([^}]+)\}/g, 'prod[$1→$2] ');

  // Replace fractions \frac{a}{b} -> (a / b)
  visual = visual.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  // Replace square roots \sqrt{a} -> √(a)
  visual = visual.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  // Replace nth root \sqrt[n]{a} -> ⁿ√(a)
  visual = visual.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)');
  // Replace subscripts x_{n} -> x_n
  visual = visual.replace(/_\{([^}]+)\}/g, '_$1');
  // Replace superscripts x^{n} -> x^n
  visual = visual.replace(/\^\{([^}]+)\}/g, '^$1');

  // Replace blackboard bold sets
  visual = visual.replace(/\\mathbb\{R\}/g, 'ℝ')
                 .replace(/\\mathbb\{C\}/g, 'ℂ')
                 .replace(/\\mathbb\{N\}/g, 'ℕ')
                 .replace(/\\mathbb\{Z\}/g, 'ℤ');
  
  // Replace LaTeX command symbols with real math unicode
  const symbolMap = {
    '\\pm': '±',
    '\\cdot': '⋅',
    '\\times': '×',
    '\\div': '÷',
    '\\neq': '≠',
    '\\leq': '≤',
    '\\geq': '≥',
    '\\partial': '∂',
    '\\nabla': '∇',
    '\\oint': '∮',
    '\\int': '∫',
    '\\sum': '∑',
    '\\prod': '∏',
    '\\in': '∈',
    '\\notin': '∉',
    '\\subset': '⊂',
    '\\subseteq': '⊆',
    '\\cup': '∪',
    '\\cap': '∩',
    '\\therefore': '∴',
    '\\angle': '∠',
    '\\pi': 'π',
    '\\theta': 'θ',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\lambda': 'λ',
    '\\sigma': 'σ',
    '\\omega': 'ω',
    '\\phi': 'ϕ',
    '\\varphi': 'ϕ',
    '\\mu': 'μ',
    '\\epsilon': 'ε',
    '\\varepsilon': 'ε',
    '\\infty': '∞',
    '\\Delta': 'Δ',
    '\\approx': '≈',
    '\\rightarrow': '→',
    '\\to': '→',
    '\\,': ' ',
    '\\;': ' ',
    '\\quad': ' '
  };

  for (const [cmd, sym] of Object.entries(symbolMap)) {
    visual = visual.split(cmd).join(sym);
  }

  return visual.trim();
}

// Convert teacher's visual editor inputs into valid LaTeX behind the scenes
export function visualTextToLatex(visual) {
  if (!visual) return '';

  let latex = visual;

  // Convert chem(...) -> \ce{...}
  latex = latex.replace(/chem\(([^)]+)\)/gi, '\\ce{$1}');
  // Convert unit(...) -> \pu{...}
  latex = latex.replace(/unit\(([^)]+)\)/gi, '\\pu{$1}');

  // Convert nCr(n, r) -> \nCr{n}{r}
  latex = latex.replace(/nCr\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)/gi, '\\nCr{$1}{$2}');
  // Convert nPr(n, r) -> \nPr{n}{r}
  latex = latex.replace(/nPr\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)/gi, '\\nPr{$1}{$2}');
  // Convert binom(n, r) -> \binom{n}{r}
  latex = latex.replace(/binom\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)/gi, '\\binom{$1}{$2}');

  // Convert bar(z) -> \bar{z}
  latex = latex.replace(/bar\(([^)]+)\)/g, '\\bar{$1}');
  // Convert Re(z), Im(z), arg(z) -> \text{Re}(z), \text{Im}(z), \text{arg}(z)
  latex = latex.replace(/Re\(([^)]+)\)/gi, '\\text{Re}($1)')
               .replace(/Im\(([^)]+)\)/gi, '\\text{Im}($1)')
               .replace(/arg\(([^)]+)\)/gi, '\\text{arg}($1)');

  // Convert matrix(a,b; c,d) -> \begin{bmatrix} a & b \\ c & d \end{bmatrix}
  latex = latex.replace(/matrix\(([^)]+)\)/gi, (_, body) => {
    const rows = body.split(';').map(row => row.split(',').map(cell => cell.trim()).join(' & '));
    return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
  });

  // Convert det(a,b; c,d) -> \begin{vmatrix} a & b \\ c & d \end{vmatrix}
  latex = latex.replace(/det\(([^)]+)\)/gi, (_, body) => {
    const rows = body.split(';').map(row => row.split(',').map(cell => cell.trim()).join(' & '));
    return `\\begin{vmatrix} ${rows.join(' \\\\ ')} \\end{vmatrix}`;
  });

  // Convert cases(a if b, c if d) -> \begin{cases} a, & b \\ c, & d \end{cases}
  latex = latex.replace(/cases\(([^)]+)\)/gi, (_, body) => {
    const items = body.split(',').map(item => {
      const parts = item.split(/\s+if\s+/i);
      if (parts.length === 2) return `${parts[0].trim()}, & \\text{if } ${parts[1].trim()}`;
      return item.trim();
    });
    return `\\begin{cases} ${items.join(' \\\\ ')} \\end{cases}`;
  });

  // Convert vec(A) -> \vec{A}
  latex = latex.replace(/vec\(([^)]+)\)/g, '\\vec{$1}');
  // Convert hat(A) -> \hat{A}
  latex = latex.replace(/hat\(([^)]+)\)/g, '\\hat{$1}');

  // Convert lim[a→b] or lim[a->b] -> \lim_{a \to b}
  latex = latex.replace(/lim\[([^→\->]+)(?:→|->)([^\]]+)\]/gi, '\\lim_{$1 \\to $2}');
  // Convert int[a→b] or int[a->b] -> \int_{a}^{b}
  latex = latex.replace(/int\[([^→\->]+)(?:→|->)([^\]]+)\]/gi, '\\int_{$1}^{$2}');
  // Convert sum[a→b] or sum[a->b] -> \sum_{a}^{b}
  latex = latex.replace(/sum\[([^→\->]+)(?:→|->)([^\]]+)\]/gi, '\\sum_{$1}^{$2}');
  // Convert prod[a→b] or prod[a->b] -> \prod_{a}^{b}
  latex = latex.replace(/prod\[([^→\->]+)(?:→|->)([^\]]+)\]/gi, '\\prod_{$1}^{$2}');

  // Map visual symbols back to LaTeX commands
  const reverseMap = {
    '±': '\\pm ',
    '⋅': '\\cdot ',
    '×': '\\times ',
    '÷': '\\div ',
    '≠': '\\neq ',
    '≤': '\\leq ',
    '≥': '\\geq ',
    '∂': '\\partial ',
    '∇': '\\nabla ',
    '∮': '\\oint ',
    '∫': '\\int ',
    '∑': '\\sum ',
    '∏': '\\prod ',
    '∈': '\\in ',
    '∉': '\\notin ',
    '⊂': '\\subset ',
    '⊆': '\\subseteq ',
    '∪': '\\cup ',
    '∩': '\\cap ',
    '∴': '\\therefore ',
    '∠': '\\angle ',
    'π': '\\pi ',
    'θ': '\\theta ',
    'α': '\\alpha ',
    'β': '\\beta ',
    'γ': '\\gamma ',
    'δ': '\\delta ',
    'λ': '\\lambda ',
    'σ': '\\sigma ',
    'ω': '\\omega ',
    'ϕ': '\\phi ',
    'μ': '\\mu ',
    'ε': '\\epsilon ',
    '∞': '\\infty ',
    'Δ': '\\Delta ',
    '≈': '\\approx ',
    '→': '\\rightarrow ',
    'ℝ': '\\mathbb{R}',
    'ℂ': '\\mathbb{C}',
    'ℕ': '\\mathbb{N}',
    'ℤ': '\\mathbb{Z}'
  };

  for (const [sym, cmd] of Object.entries(reverseMap)) {
    latex = latex.split(sym).join(cmd);
  }

  // Parse fractions with balanced parenthetical matching: (num / den)
  latex = parseFractionsBalanced(latex);

  // Convert all variations of square root (e.g. \sqrt(3), sqrt(3), \sqrt 3, sqrt3, √(3), √3) to \sqrt{3}
  latex = latex
    .replace(/\\?sqrt\(([^)]+)\)/gi, '\\sqrt{$1}')
    .replace(/\\?sqrt\{([^}]+)\}/gi, '\\sqrt{$1}')
    .replace(/\\?sqrt\s*([0-9a-zA-Z]+)/gi, '\\sqrt{$1}')
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

  return latex.trim();
}


function parseFractionsBalanced(input) {
  let str = input;
  let changed = true;
  let iterations = 0;

  // Loop to resolve fractions, starting with outer matching parens
  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    let i = 0;
    while (i < str.length) {
      if (str[i] === '(') {
        let depth = 1;
        let slashIndex = -1;
        let j = i + 1;
        
        while (j < str.length && depth > 0) {
          if (str[j] === '(') depth++;
          else if (str[j] === ')') depth--;
          else if (str[j] === '/' && depth === 1) {
            slashIndex = j;
          }
          j++;
        }

        if (depth === 0 && slashIndex > i) {
          const numPart = str.substring(i + 1, slashIndex).trim();
          const denPart = str.substring(slashIndex + 1, j - 1).trim();

          if (numPart.length > 0 && denPart.length > 0) {
            const fracLatex = `\\frac{${numPart}}{${denPart}}`;
            str = str.substring(0, i) + fracLatex + str.substring(j);
            changed = true;
            break;
          }
        }
      }
      i++;
    }
  }

  return str;
}
