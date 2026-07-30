/**
 * Visual Math Helper: Enables visual formula manipulation for teachers without LaTeX.
 */

// Convert LaTeX string to visual symbol tokens for visual editor display
export function latexToVisualText(latex) {
  if (!latex) return '';
  
  let visual = latex;
  // Replace fractions \frac{a}{b} -> (a / b)
  visual = visual.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  // Replace square roots \sqrt{a} -> √(a)
  visual = visual.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  // Replace nth root \sqrt[n]{a} -> ⁿ√(a)
  visual = visual.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)');
  // Replace integrals \int_{a}^{b} -> ∫[a to b]
  visual = visual.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1→$2] ');
  // Replace subscripts x_{n} -> x_n
  visual = visual.replace(/_\{([^}]+)\}/g, '_$1');
  // Replace superscripts x^{n} -> x^n
  visual = visual.replace(/\^\{([^}]+)\}/g, '^$1');
  
  // Replace LaTeX command symbols with real math unicode
  const symbolMap = {
    '\\pm': '±',
    '\\times': '×',
    '\\div': '÷',
    '\\neq': '≠',
    '\\leq': '≤',
    '\\geq': '≥',
    '\\pi': 'π',
    '\\theta': 'θ',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\infty': '∞',
    '\\int': '∫',
    '\\sum': '∑',
    '\\prod': '∏',
    '\\Delta': 'Δ',
    '\\approx': '≈',
    '\\rightarrow': '→',
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

  // Map visual symbols back to LaTeX commands
  const reverseMap = {
    '±': '\\pm ',
    '×': '\\times ',
    '÷': '\\div ',
    '≠': '\\neq ',
    '≤': '\\leq ',
    '≥': '\\geq ',
    'π': '\\pi ',
    'θ': '\\theta ',
    'α': '\\alpha ',
    'β': '\\beta ',
    'γ': '\\gamma ',
    'δ': '\\delta ',
    '∞': '\\infty ',
    '∫': '\\int ',
    '∑': '\\sum ',
    '∏': '\\prod ',
    'Δ': '\\Delta ',
    '≈': '\\approx ',
    '→': '\\rightarrow '
  };

  for (const [sym, cmd] of Object.entries(reverseMap)) {
    latex = latex.split(sym).join(cmd);
  }

  // Parse fractions with balanced parenthetical matching: (num / den)
  latex = parseFractionsBalanced(latex);

  // Convert √(a) back to \sqrt{a}
  latex = latex.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  // Convert √a back to \sqrt{a}
  latex = latex.replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

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
