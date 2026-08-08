import React from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { repairMissingMathBackslashes } from '../../services/mathSanitizerService';

export default function MathRenderer({ text = '', needsReview = false, readOnly = false, onSelectMathForEdit }) {
  if (!text || text.trim() === '') {
    return <span className="italic text-[#8c8275]">No text transcribed yet.</span>;
  }

  // Pre-sanitize incoming text to convert raw MathML tags (<mn>, <mi>, <mo>) & repair missing LaTeX backslashes
  const sanitizedText = repairMissingMathBackslashes(text);

  // Split text by <math>...</math> tags
  const parts = [];
  const mathRegex = /<math>(.*?)<\/math>/gs;
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(sanitizedText)) !== null) {
    // Plain text before math
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: sanitizedText.substring(lastIndex, match.index) });
    }
    // Math content
    parts.push({ type: 'math', content: match[1] });
    lastIndex = mathRegex.lastIndex;
  }

  // Remaining text
  if (lastIndex < sanitizedText.length) {
    parts.push({ type: 'text', content: sanitizedText.substring(lastIndex) });
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          // Render plain text preserving spaces & multiline breaks
          return <span key={idx}>{part.content}</span>;
        }

        // Clean & repair math content using shared mathSanitizerService
        let cleanMathContent = repairMissingMathBackslashes(part.content.replace(/<\/?math>/gi, '')).trim();
        if (!cleanMathContent) return null;



        // Fix unescaped physical unit tags e.g. pu{10cm} -> \mathrm{10cm}
        cleanMathContent = cleanMathContent.replace(/(?<!\\)pu\{([^{}]+)\}/g, '\\mathrm{$1}');

        // Auto-escape unescaped percent signs inside math tags so KaTeX does not treat them as comments
        cleanMathContent = cleanMathContent.replace(/(?<!\\)%/g, '\\%');

        // Fix fill-in-the-blank underscores inside \text{} or standalone consecutive underscores
        cleanMathContent = cleanMathContent
          .replace(/\\text\{([^{}]*)\}/g, (_, inner) => `\\text{${inner.replace(/(?<!\\)_/g, '\\_')}}`)
          .replace(/(?<!\\)_{2,}/g, (match) => `\\underline{\\hspace{${match.length * 0.5}em}}`);

        // If math content is purely plain English text words without math symbols, wrap in \text{} so spaces are preserved
        if (/^[a-zA-Z\s]{3,}$/.test(cleanMathContent) && !cleanMathContent.includes('\\')) {
          cleanMathContent = `\\text{${cleanMathContent}}`;
        }


        // Render Math with KaTeX
        let renderedHtml = '';
        let isError = false;

        try {
          renderedHtml = katex.renderToString(cleanMathContent, {
            displayMode: false,
            throwOnError: true,
            trust: true,
            macros: {
              "\\pu": "\\mathrm{#1}",
              "\\nCr": "{}^{#1}\\mkern-2mu C_{#2}",
              "\\nPr": "{}^{#1}\\mkern-2mu P_{#2}",
              "\\vhat": "\\hat{\\mathbf{#1}}"
            }
          });
        } catch (e) {
          isError = true;
        }

        const isHighlighted = needsReview || isError;

        if (isError) {
          return (
            <span
              key={idx}
              onClick={() => !readOnly && onSelectMathForEdit && onSelectMathForEdit(cleanMathContent)}
              className={`inline-block font-sans text-xs font-semibold mx-1 rounded px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 ${
                readOnly ? '' : 'cursor-pointer hover:bg-amber-200 transition-all'
              }`}
              title={readOnly ? "Math formula needs review" : "Math formula syntax needs review — click to edit visually"}
            >
              [Math Formula Needs Review]
            </span>
          );
        }

        return (
          <span
            key={idx}
            onClick={() => !readOnly && onSelectMathForEdit && onSelectMathForEdit(cleanMathContent)}
            className={`inline-block font-serif mx-0.5 rounded px-1 transition-all ${
              readOnly
                ? ''
                : `cursor-pointer ${isHighlighted ? 'math-review-highlight hover:bg-amber-200/70' : 'hover:bg-amber-100/50 hover:underline'}`
            }`}
            title={readOnly ? undefined : "Click to edit formula visually"}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        );
      })}
    </span>
  );
}
