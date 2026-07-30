/**
 * Deterministic OMML (Office Math Markup Language) to LaTeX converter.
 * Converts Microsoft Word <m:oMath> XML element trees into standard LaTeX.
 */

const SYMBOL_MAP = {
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
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'σ': '\\sigma ',
  'ω': '\\omega ',
  'Ω': '\\Omega ',
  'Δ': '\\Delta ',
  '∞': '\\infty ',
  '√': '\\sqrt',
  '∫': '\\int ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '→': '\\rightarrow ',
  '⇒': '\\Rightarrow ',
};

export function convertOmmlElementToLatex(element) {
  if (!element) return '';
  
  let result = '';
  const children = Array.from(element.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += mapTextSymbols(node.textContent);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tagName = node.tagName ? node.tagName.replace(/^.*:/, '') : '';

    switch (tagName) {
      case 'oMath':
      case 'oMathPara':
      case 'e': // Element container inside OMML
        result += convertOmmlElementToLatex(node);
        break;

      case 'r': // Math run
        const tNode = getDirectChild(node, 't');
        if (tNode) {
          result += mapTextSymbols(tNode.textContent);
        }
        break;

      case 't': // Direct text tag
        result += mapTextSymbols(node.textContent);
        break;

      case 'f': // Fraction: <m:num> and <m:den>
        const num = getDirectChild(node, 'num');
        const den = getDirectChild(node, 'den');
        const numLatex = num ? convertOmmlElementToLatex(num) : '';
        const denLatex = den ? convertOmmlElementToLatex(den) : '';
        result += `\\frac{${numLatex.trim()}}{${denLatex.trim()}}`;
        break;

      case 'sSup': // Superscript: <m:e> and <m:sup>
        const baseSup = getDirectChild(node, 'e');
        const supVal = getDirectChild(node, 'sup');
        const baseSupLatex = baseSup ? convertOmmlElementToLatex(baseSup) : '';
        const supLatex = supVal ? convertOmmlElementToLatex(supVal) : '';
        result += `${wrapIfNeeded(baseSupLatex)}^{${supLatex.trim()}}`;
        break;

      case 'sSub': // Subscript: <m:e> and <m:sub>
        const baseSub = getDirectChild(node, 'e');
        const subVal = getDirectChild(node, 'sub');
        const baseSubLatex = baseSub ? convertOmmlElementToLatex(baseSub) : '';
        const subLatex = subVal ? convertOmmlElementToLatex(subVal) : '';
        result += `${wrapIfNeeded(baseSubLatex)}_{${subLatex.trim()}}`;
        break;

      case 'sSubSup': // Subscript & Superscript
        const baseSubSup = getDirectChild(node, 'e');
        const subSupSub = getDirectChild(node, 'sub');
        const subSupSup = getDirectChild(node, 'sup');
        const bLatex = baseSubSup ? convertOmmlElementToLatex(baseSubSup) : '';
        const sLatex = subSupSub ? convertOmmlElementToLatex(subSupSub) : '';
        const pLatex = subSupSup ? convertOmmlElementToLatex(subSupSup) : '';
        result += `${wrapIfNeeded(bLatex)}_{${sLatex.trim()}}^{${pLatex.trim()}}`;
        break;

      case 'rad': // Radical / Square Root: <m:deg> (optional) and <m:e>
        const deg = getDirectChild(node, 'deg');
        const radBase = getDirectChild(node, 'e');
        const degLatex = deg ? convertOmmlElementToLatex(deg).trim() : '';
        const radBaseLatex = radBase ? convertOmmlElementToLatex(radBase).trim() : '';
        if (degLatex && degLatex !== '') {
          result += `\\sqrt[${degLatex}]{${radBaseLatex}}`;
        } else {
          result += `\\sqrt{${radBaseLatex}}`;
        }
        break;

      case 'nary': // Integral / Sum / Product: <m:naryPr>, <m:sub>, <m:sup>, <m:e>
        const naryPr = getDirectChild(node, 'naryPr');
        const chrNode = naryPr ? getDirectChild(naryPr, 'chr') : null;
        const chrVal = chrNode ? chrNode.getAttribute('m:val') || chrNode.getAttribute('val') || '∫' : '∫';
        let naryOp = '\\int ';
        if (chrVal === '∑' || chrVal.includes('sum')) naryOp = '\\sum ';
        if (chrVal === '∏' || chrVal.includes('prod')) naryOp = '\\prod ';
        
        const narySub = getDirectChild(node, 'sub');
        const narySup = getDirectChild(node, 'sup');
        const naryBody = getDirectChild(node, 'e');

        const nSubLatex = narySub ? convertOmmlElementToLatex(narySub).trim() : '';
        const nSupLatex = narySup ? convertOmmlElementToLatex(narySup).trim() : '';
        const nBodyLatex = naryBody ? convertOmmlElementToLatex(naryBody).trim() : '';

        let subSupStr = '';
        if (nSubLatex) subSupStr += `_{${nSubLatex}}`;
        if (nSupLatex) subSupStr += `^{${nSupLatex}}`;

        result += `${naryOp}${subSupStr} ${nBodyLatex}`;
        break;

      case 'd': // Delimiters / Parentheses
        const dPr = getDirectChild(node, 'dPr');
        const begChr = dPr ? getDirectChild(dPr, 'begChr') : null;
        const endChr = dPr ? getDirectChild(dPr, 'endChr') : null;
        const openSymbol = begChr ? begChr.getAttribute('m:val') || '(' : '(';
        const closeSymbol = endChr ? endChr.getAttribute('m:val') || ')' : ')';
        const dBody = getDirectChild(node, 'e');
        const dBodyLatex = dBody ? convertOmmlElementToLatex(dBody).trim() : '';
        result += `\\left${openSymbol} ${dBodyLatex} \\right${closeSymbol}`;
        break;

      default:
        // Recurse into unhandled containers
        result += convertOmmlElementToLatex(node);
        break;
    }
  }

  return result;
}

function getDirectChild(parent, targetTagName) {
  if (!parent || !parent.childNodes) return null;
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const cleanName = child.tagName ? child.tagName.replace(/^.*:/, '') : '';
      if (cleanName.toLowerCase() === targetTagName.toLowerCase()) {
        return child;
      }
    }
  }
  return null;
}

function mapTextSymbols(str) {
  if (!str) return '';
  let out = str;
  for (const [sym, latex] of Object.entries(SYMBOL_MAP)) {
    out = out.split(sym).join(latex);
  }
  return out;
}

function wrapIfNeeded(latex) {
  const trimmed = latex.trim();
  if (trimmed.length > 1 && !trimmed.startsWith('{')) {
    return `{${trimmed}}`;
  }
  return trimmed;
}

export function parseOmmlXmlString(ommlXmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ommlXmlString, 'text/xml');
    return convertOmmlElementToLatex(xmlDoc.documentElement || xmlDoc);
  } catch (err) {
    console.error('Error parsing OMML XML string:', err);
    return '';
  }
}
