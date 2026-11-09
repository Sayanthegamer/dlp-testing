import React from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { repairMissingMathBackslashes } from '../../services/mathSanitizerService';

export default function MathRenderer({ text = '', needsReview = false, readOnly = false, onSelectMathForEdit }) {
  if (!text || text.trim() === '') {
    return <span className="text-[#7b7266]">No text entered</span>;
  }

  const sanitizedText = repairMissingMathBackslashes(text);
  const parts = [];
  const mathRegex = /<math>([\s\S]*?)<\/math>/gi;
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(sanitizedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: sanitizedText.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'math', content: match[1] });
    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < sanitizedText.length) {
    parts.push({ type: 'text', content: sanitizedText.substring(lastIndex) });
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>;
        }

        let cleanMathContent = repairMissingMathBackslashes(part.content.replace(/<\/?math>/gi, '')).trim();
        if (!cleanMathContent) return null;

        cleanMathContent = cleanMathContent
          .replace(/\\{2,}(?=[a-zA-Z])/g, '\\')
          .replace(/(?<!\\)pu\{([^{}]+)\}/g, '\\mathrm{$1}')
          .replace(/(?<!\\)%/g, '\\%');

        cleanMathContent = cleanMathContent
          .replace(/\\text\{([^{}]*)\}/g, (_, inner) => {
            const fixedInner = inner
              .replace(/\\(times|sec|min|max|in|to|pm|mp|div|cdot)\b/g, '$1')
              .replace(/(?<!\\)_/g, '\\_');
            return `\\text{${fixedInner}}`;
          })
          .replace(/(?<!\\)_{2,}/g, (m) => `\\underline{\\hspace{${m.length * 0.5}em}}`);

        if (/^[a-zA-Z\s]{3,}$/.test(cleanMathContent) && !cleanMathContent.includes('\\')) {
          cleanMathContent = `\\text{${cleanMathContent}}`;
        }

        let renderedHtml = '';
        let isError = false;

        try {
          renderedHtml = katex.renderToString(cleanMathContent, {
            displayMode: false,
            throwOnError: true,
            trust: false,
            macros: {
              "\\pu": "\\mathrm{#1}",
              "\\nCr": "{}^{#1}\\mkern-2mu C_{#2}",
              "\\nPr": "{}^{#1}\\mkern-2mu P_{#2}",
              "\\vhat": "\\hat{\\mathbf{#1}}"
            }
          });
        } catch (_) {
          isError = true;
        }

        const isHighlighted = needsReview || isError;

        if (isError) {
          return (
            <span
              key={idx}
              onClick={(e) => {
                if (!readOnly && onSelectMathForEdit) {
                  e.stopPropagation();
                  onSelectMathForEdit(cleanMathContent);
                }
              }}
              className={`inline-block font-sans text-xs font-medium mx-1 rounded px-2 py-0.5 bg-[#efe9df] border border-[#b8622e] text-[#b8622e] ${
                readOnly ? '' : 'cursor-pointer hover:bg-[#e5dec9] transition-calm'
              }`}
              title={readOnly ? "Formula needs a check" : "This formula needs a check — click to edit visually"}
            >
              This formula needs a check
            </span>
          );
        }

        return (
          <span
            key={idx}
            onClick={(e) => {
              if (!readOnly && onSelectMathForEdit) {
                e.stopPropagation();
                onSelectMathForEdit(cleanMathContent);
              }
            }}
            className={`inline-block font-serif mx-0.5 rounded px-1 transition-calm ${
              readOnly
                ? ''
                : `cursor-pointer ${
                    isHighlighted
                      ? 'math-review-highlight'
                      : 'hover:bg-[#efe9df]'
                  }`
            }`}
            title={readOnly ? undefined : "Click to edit formula in visual builder"}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        );
      })}
    </span>
  );
}
