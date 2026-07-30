import React from 'react';
import katex from 'katex';

export default function MathRenderer({ text = '', needsReview = false, onSelectMathForEdit }) {
  if (!text || text.trim() === '') {
    return <span className="italic text-[#8c8275]">No text transcribed yet.</span>;
  }

  // Split text by <math>...</math> tags
  const parts = [];
  const mathRegex = /<math>(.*?)<\/math>/gs;
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    // Plain text before math
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    // Math content
    parts.push({ type: 'math', content: match[1] });
    lastIndex = mathRegex.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          // Render plain text preserving spaces & multiline breaks
          return <span key={idx}>{part.content}</span>;
        }

        // Clean math content: strip residual nested <math> tags
        let cleanMathContent = part.content.replace(/<\/?math>/gi, '').trim();
        if (!cleanMathContent) return null;

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
            throwOnError: false,
            errorColor: '#c97a2b'
          });
        } catch (e) {
          isError = true;
        }

        const isHighlighted = needsReview || isError;

        return (
          <span
            key={idx}
            onClick={() => onSelectMathForEdit && onSelectMathForEdit(cleanMathContent)}
            className={`inline-block font-serif mx-0.5 cursor-pointer rounded px-1 transition-all ${
              isHighlighted
                ? 'math-review-highlight hover:bg-amber-200/70'
                : 'hover:bg-amber-100/50 hover:underline'
            }`}
            title="Click to edit formula visually"
            dangerouslySetInnerHTML={{ __html: renderedHtml || cleanMathContent }}
          />
        );
      })}
    </span>
  );
}
