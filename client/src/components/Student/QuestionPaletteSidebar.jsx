import React, { useState } from 'react';
import { Check, LayoutGrid, X } from 'lucide-react';

/**
 * Exam-Native Question Palette Sidebar Component
 * Uses Warm Paper tokens and clear tabular counters instead of jarring purple/rainbow shapes.
 */
export default function QuestionPaletteSidebar({
  questions = [],
  currentIndex = 0,
  questionStatuses = {},
  answers = {},
  onSelectQuestion,
  onSubmitExam
}) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const totalQuestions = questions.length;

  let notVisitedCount = 0;
  let notAnsweredCount = 0;
  let answeredCount = 0;
  let markedForReviewCount = 0;
  let answeredAndMarkedCount = 0;

  questions.forEach((q, idx) => {
    const status = questionStatuses[q.id] || (idx === currentIndex ? 'not_answered' : 'not_visited');
    const hasAns = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';

    if (status === 'answered_marked_for_review' || (status === 'marked_for_review' && hasAns)) {
      answeredAndMarkedCount++;
    } else if (status === 'marked_for_review') {
      markedForReviewCount++;
    } else if (status === 'answered' || hasAns) {
      answeredCount++;
    } else if (status === 'not_answered' || idx === currentIndex) {
      notAnsweredCount++;
    } else {
      notVisitedCount++;
    }
  });

  const getStatusStyle = (status, hasAns, isCurrent) => {
    if (status === 'answered_marked_for_review' || (status === 'marked_for_review' && hasAns)) {
      return {
        bg: 'bg-[#8c4a17] text-[#fdfbf7] border-[#8c4a17]',
        badge: true
      };
    }
    if (status === 'marked_for_review') {
      return {
        bg: 'bg-[#efe9df] text-[#8c4a17] border-[#8c4a17]',
        badge: false
      };
    }
    if (status === 'answered' || hasAns) {
      return {
        bg: 'bg-[#3f6b4a] text-[#fdfbf7] border-[#3f6b4a]',
        badge: false
      };
    }
    if (status === 'not_answered' || isCurrent) {
      return {
        bg: 'bg-[#fdfbf7] text-[#b8622e] border-[#b8622e]',
        badge: false
      };
    }
    return {
      bg: 'bg-[#f7f4ee] text-[#5e554a] border-[#dcd5c4] hover:bg-[#efe9df]',
      badge: false
    };
  };

  const paletteContent = (
    <div className="flex flex-col h-full bg-[#fdfbf7] border border-[#dcd5c4] rounded-t-2xl sm:rounded-xl overflow-hidden text-xs font-sans">
      <div className="p-4 bg-[#efe9df] border-b border-[#dcd5c4] flex items-center justify-between">
        <div>
          <h4 className="font-serif font-medium text-sm text-[#1f1b16]">Question palette</h4>
          <p className="text-[11px] text-[#5e554a]">Select a number to jump directly</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpenMobile(false)}
          className="sm:hidden p-1.5 rounded-md bg-[#fdfbf7] border border-[#dcd5c4] text-[#5e554a]"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Legend */}
      <div className="p-4 bg-[#f7f4ee] border-b border-[#dcd5c4] space-y-2 font-mono tabular-nums text-[11px] text-[#5e554a]">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#3f6b4a] text-[#fdfbf7] font-medium flex items-center justify-center shrink-0">
              {answeredCount}
            </span>
            <span className="font-sans truncate">Answered</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#fdfbf7] border border-[#b8622e] text-[#b8622e] font-medium flex items-center justify-center shrink-0">
              {notAnsweredCount}
            </span>
            <span className="font-sans truncate">Unanswered</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#efe9df] border border-[#8c4a17] text-[#8c4a17] font-medium flex items-center justify-center shrink-0">
              {markedForReviewCount}
            </span>
            <span className="font-sans truncate">Marked</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#f7f4ee] border border-[#dcd5c4] text-[#5e554a] font-medium flex items-center justify-center shrink-0">
              {notVisitedCount}
            </span>
            <span className="font-sans truncate">Not visited</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#dcd5c4]">
          <span className="w-6 h-6 rounded-md bg-[#8c4a17] text-[#fdfbf7] font-medium flex items-center justify-center shrink-0 relative">
            {answeredAndMarkedCount}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#3f6b4a] border border-[#fdfbf7] flex items-center justify-center">
              <Check className="w-1.5 h-1.5 text-[#fdfbf7]" strokeWidth={2} />
            </span>
          </span>
          <span className="font-sans text-[11px] text-[#5e554a]">
            Answered and marked (evaluated)
          </span>
        </div>
      </div>

      {/* Numbered Grid */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[340px] sm:max-h-none">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const status = questionStatuses[q.id] || (isCurrent ? 'not_answered' : 'not_visited');
            const hasAns = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
            const style = getStatusStyle(status, hasAns, isCurrent);

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => {
                  onSelectQuestion(idx);
                  setIsOpenMobile(false);
                }}
                className={`h-9 rounded-md text-xs font-mono tabular-nums font-medium transition-calm flex items-center justify-center border relative ${style.bg} ${
                  isCurrent ? 'ring-2 ring-offset-1 ring-[#1f1b16]' : ''
                }`}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
                {style.badge && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#3f6b4a] border border-[#fdfbf7] flex items-center justify-center">
                    <Check className="w-2 h-2 text-[#fdfbf7]" strokeWidth={2} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-[#efe9df] border-t border-[#dcd5c4]">
        <button
          type="button"
          onClick={onSubmitExam}
          className="w-full h-10 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center"
        >
          <span>Review and submit paper</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#fdfbf7] border-t border-[#dcd5c4] z-40 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() => setIsOpenMobile(true)}
          className="flex items-center gap-2 text-xs font-medium text-[#1f1b16] bg-[#efe9df] border border-[#dcd5c4] px-3 h-9 rounded-lg tabular-nums"
        >
          <LayoutGrid className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
          <span>Palette ({answeredCount + answeredAndMarkedCount}/{totalQuestions})</span>
        </button>
        <button
          type="button"
          onClick={onSubmitExam}
          className="px-4 h-9 bg-[#1f1b16] text-[#fdfbf7] rounded-lg text-xs font-medium"
        >
          Submit paper
        </button>
      </div>

      {isOpenMobile && (
        <div className="fixed inset-0 bg-[#161513]/60 z-50 flex items-end justify-center p-2 sm:hidden">
          <div className="w-full max-h-[82vh] h-full">
            {paletteContent}
          </div>
        </div>
      )}

      <aside className="hidden sm:block w-68 shrink-0 sticky top-6 self-start">
        {paletteContent}
      </aside>
    </>
  );
}
