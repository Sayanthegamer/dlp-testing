import React, { useEffect, useRef } from 'react';
import QuestionCard from './QuestionCard';
import { computeNeedsReview } from '../../services/reviewEvaluator';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';

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

  useEffect(() => {
    if (isJustParsed && topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isJustParsed]);

  const sortedQuestions = questions
    .map((question, originalIdx) => ({ question, originalIdx }))
    .sort((a, b) => {
      const aNeeds = computeNeedsReview(a.question).needsReview;
      const bNeeds = computeNeedsReview(b.question).needsReview;
      if (aNeeds && !bNeeds) return -1;
      if (!aNeeds && bNeeds) return 1;
      return a.originalIdx - b.originalIdx;
    });

  const flaggedCount = questions.filter(q => computeNeedsReview(q).needsReview).length;

  return (
    <div ref={topRef} className="space-y-6">
      {/* Post-Parse Status Banner */}
      {isJustParsed && (
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#efe9df] text-[#3f6b4a] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="font-serif font-medium text-base text-[#1f1b16]">
                {questions.length} {questions.length === 1 ? 'question' : 'questions'} typeset
              </h4>
              <p className="text-xs text-[#5e554a]">
                Click any text to edit in place, or click a formula to open the visual math toolbar.
              </p>
            </div>
          </div>
          {flaggedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#efe9df] border border-[#b8622e] text-xs font-medium text-[#b8622e] tabular-nums shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{flaggedCount} to review</span>
            </span>
          )}
        </div>
      )}

      {/* Exam Paper Sheet Container */}
      <div className="exam-paper rounded-xl overflow-hidden">
        {/* Authentic Printed Exam Header with Signature Double Rule */}
        <div className="p-6 sm:p-8 exam-rule-double bg-[#fdfbf7] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#7b7266] font-sans">
            <span>Examination paper title</span>
            <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
              <span>{questions.length} {questions.length === 1 ? 'question' : 'questions'}</span>
              <span>•</span>
              <span>{questions.length * 4} marks</span>
              {flaggedCount > 0 ? (
                <>
                  <span>•</span>
                  <span className="text-[#b8622e] font-medium">{flaggedCount} needs review</span>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span className="text-[#3f6b4a] font-medium">Ready to publish</span>
                </>
              )}
            </div>
          </div>

          <input
            type="text"
            value={testTitle || 'Mathematics Practice Assessment'}
            onChange={(e) => onUpdateTestTitle(e.target.value)}
            placeholder="Enter examination paper title"
            className="w-full font-serif font-medium text-2xl sm:text-3xl text-[#1f1b16] bg-transparent border-b border-transparent hover:border-[#dcd5c4] focus:border-[#8c4a17] focus:outline-none py-1 leading-tight transition-calm"
          />
          <p className="text-xs text-[#5e554a] font-sans">
            Click any question stem or option to edit inline. Click any math expression to open the visual equation builder.
          </p>
        </div>

        {/* Continuous Ruled Question Blocks */}
        <div className="divide-y divide-[#dcd5c4]">
          {sortedQuestions.map(({ question, originalIdx }) => (
            <QuestionCard
              key={question.id || originalIdx}
              question={question}
              index={originalIdx}
              onUpdateQuestion={onUpdateQuestion}
              onDeleteQuestion={onDeleteQuestion}
              onDuplicateQuestion={onDuplicateQuestion}
              onSelectMathForEdit={(math) => onSelectMathForEdit(question.id, math)}
            />
          ))}
        </div>

        {/* Add Question Footer */}
        <div className="p-5 bg-[#faf7f0] border-t border-[#dcd5c4] flex items-center justify-between">
          <span className="text-xs text-[#7b7266] font-mono tabular-nums">
            Total: {questions.length} {questions.length === 1 ? 'item' : 'items'}
          </span>
          <button
            type="button"
            onClick={onAddQuestion}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] font-sans font-medium text-xs transition-calm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
            <span>Add question</span>
          </button>
        </div>
      </div>
    </div>
  );
}
