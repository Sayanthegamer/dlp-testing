import React, { useEffect, useRef } from 'react';
import QuestionCard from './QuestionCard';
import { Plus, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

export default function QuestionCatalogue({
  testTitle,
  questions,
  onUpdateTestTitle,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onAddQuestion,
  onSelectMathForEdit,
  isJustParsed
}) {
  const topRef = useRef(null);

  // Auto-scroll refocus to Question 1 upon complete parse
  useEffect(() => {
    if (isJustParsed && topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isJustParsed]);

  return (
    <div ref={topRef} className="space-y-6">
      
      {/* Parsing Completion Review Banner */}
      {isJustParsed && (
        <div className="bg-[#f0f9f0] border border-[#a5d6a7] rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2e7d32] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-[#1b4d1e]">
                {questions.length} Question{questions.length > 1 ? 's' : ''} Extracted & Typeset!
              </h4>
              <p className="text-xs text-[#2e7d32]">
                Automatically refocused to Question #1. Please review each question and option carefully below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Title Header */}
      <div className="exam-paper rounded-2xl p-6 sm:p-8 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#786f63] font-sans border-b border-[#e5dcd0] pb-2">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-[#8c4a17]">
            Test Paper Catalogue Title
          </span>
          <span>Google Forms Style Catalogue</span>
        </div>

        <input
          type="text"
          value={testTitle || 'Mathematics Practice Quiz'}
          onChange={(e) => onUpdateTestTitle(e.target.value)}
          placeholder="Enter test paper title..."
          className="w-full font-serif font-bold text-2xl sm:text-3xl text-[#1c1b18] bg-transparent border-b border-transparent hover:border-[#dcd0be] focus:border-[#8c4a17] focus:outline-none py-1 transition-colors"
        />
        <p className="text-xs text-[#736c62] font-sans">
          Click any text to edit inline. Click any math formula to open the floating visual equation popover.
        </p>
      </div>

      {/* Stacked Question Cards */}
      <div className="space-y-6">
        {questions.map((question, idx) => (
          <QuestionCard
            key={question.id || idx}
            question={question}
            index={idx}
            onUpdateQuestion={onUpdateQuestion}
            onDeleteQuestion={onDeleteQuestion}
            onDuplicateQuestion={onDuplicateQuestion}
            onSelectMathForEdit={(math) => onSelectMathForEdit(question.id, math)}
          />
        ))}
      </div>

      {/* Add New Question Button */}
      <div className="pt-2 flex items-center justify-center">
        <button
          type="button"
          onClick={onAddQuestion}
          className="flex items-center gap-2 py-3 px-6 rounded-2xl bg-[#ffffff] hover:bg-[#faf7f2] border-2 border-dashed border-[#c9bea9] hover:border-[#8c4a17] text-[#2c2825] font-serif font-semibold text-sm shadow-xs hover:shadow-sm transition-all active:scale-95 group"
        >
          <Plus className="w-5 h-5 text-[#8c4a17] group-hover:scale-110 transition-transform" />
          <span>+ Add New Question Card</span>
        </button>
      </div>

    </div>
  );
}
