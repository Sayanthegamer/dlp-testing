import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Bookmark, AlertCircle, EyeOff, LayoutGrid, X } from 'lucide-react';

/**
 * NTA / Aakash / Allen CBT Style Question Palette Sidebar Component
 * Displays live question counts, status legends, and an interactive quick-jump grid.
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

  // Calculate live counts for the 5 NTA CBT question states
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
        bg: 'bg-purple-700 text-white border-purple-800',
        shape: 'rounded-full relative',
        badge: true
      };
    }
    if (status === 'marked_for_review') {
      return {
        bg: 'bg-purple-600 text-white border-purple-700',
        shape: 'rounded-full',
        badge: false
      };
    }
    if (status === 'answered' || hasAns) {
      return {
        bg: 'bg-emerald-600 text-white border-emerald-700',
        shape: 'rounded-tl-xl rounded-tr-sm rounded-br-xl rounded-bl-sm',
        badge: false
      };
    }
    if (status === 'not_answered' || isCurrent) {
      return {
        bg: 'bg-amber-600 text-white border-amber-700',
        shape: 'rounded-tl-sm rounded-tr-xl rounded-br-sm rounded-bl-xl',
        badge: false
      };
    }
    // not_visited
    return {
      bg: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
      shape: 'rounded-md',
      badge: false
    };
  };

  const paletteContent = (
    <div className="flex flex-col h-full bg-white border border-[#DCD5C4] rounded-2xl shadow-sm overflow-hidden text-xs font-sans">
      {/* Sidebar Header */}
      <div className="p-3 sm:p-4 bg-[#F5EFDF] border-b border-[#DCD5C4] flex items-center justify-between">
        <div>
          <h4 className="font-serif font-bold text-sm text-[#232323]">Question Palette</h4>
          <p className="text-[11px] text-[#786f63]">Click any question number to jump directly</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpenMobile(false)}
          className="sm:hidden p-1.5 rounded-lg bg-white border border-[#DCD5C4] text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* CBT Legend Box */}
      <div className="p-3 sm:p-4 bg-[#FAF7F0] border-b border-[#DCD5C4] space-y-2.5">
        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-[#3c3730]">
          {/* Not Visited */}
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-gray-100 border border-gray-300 text-gray-700 font-bold flex items-center justify-center shrink-0">
              {notVisitedCount}
            </span>
            <span className="truncate">Not Visited</span>
          </div>

          {/* Not Answered */}
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-tl-sm rounded-tr-xl rounded-br-sm rounded-bl-xl bg-amber-600 border border-amber-700 text-white font-bold flex items-center justify-center shrink-0">
              {notAnsweredCount}
            </span>
            <span className="truncate">Not Answered</span>
          </div>

          {/* Answered */}
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-tl-xl rounded-tr-sm rounded-br-xl rounded-bl-sm bg-emerald-600 border border-emerald-700 text-white font-bold flex items-center justify-center shrink-0">
              {answeredCount}
            </span>
            <span className="truncate">Answered</span>
          </div>

          {/* Marked for Review */}
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-600 border border-purple-700 text-white font-bold flex items-center justify-center shrink-0">
              {markedForReviewCount}
            </span>
            <span className="truncate">Marked Review</span>
          </div>
        </div>

        {/* Answered & Marked for Review (Evaluated) */}
        <div className="flex items-center gap-2 pt-1 border-t border-[#e8dfcf] text-[11px] font-medium text-[#3c3730]">
          <span className="w-6 h-6 rounded-full bg-purple-700 border border-purple-800 text-white font-bold flex items-center justify-center shrink-0 relative">
            {answeredAndMarkedCount}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
              <Check className="w-1.5 h-1.5 text-white" />
            </span>
          </span>
          <span className="leading-tight text-[10.5px]">
            Answered & Marked for Review <span className="text-emerald-700 font-semibold">(Will be evaluated)</span>
          </span>
        </div>
      </div>

      {/* Numbered Question Grid */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-h-[360px] sm:max-h-none">
        <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
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
                className={`w-9 h-9 sm:w-10 sm:h-10 text-xs font-bold font-mono transition-all flex items-center justify-center border shadow-xs ${style.bg} ${style.shape} ${
                  isCurrent ? 'ring-2 ring-offset-1 ring-[#8c4a17] scale-105 z-10' : ''
                }`}
                title={`Question ${idx + 1}: ${status.replace(/_/g, ' ')}`}
              >
                {String(idx + 1).padStart(2, '0')}
                {style.badge && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Exam Button Footer */}
      <div className="p-3 sm:p-4 bg-[#F5EFDF] border-t border-[#DCD5C4]">
        <button
          type="button"
          onClick={onSubmitExam}
          className="w-full py-2.5 sm:py-3 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span>Submit Examination</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-[#DCD5C4] z-40 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() => setIsOpenMobile(true)}
          className="flex items-center gap-2 text-xs font-bold text-[#232323] bg-[#FAF7F0] border border-[#DCD5C4] px-3 py-2 rounded-xl"
        >
          <LayoutGrid className="w-4 h-4 text-[#8c4a17]" />
          <span>Question Palette ({answeredCount + answeredAndMarkedCount}/{totalQuestions})</span>
        </button>
        <button
          type="button"
          onClick={onSubmitExam}
          className="px-4 py-2 bg-[#232323] text-white rounded-xl text-xs font-bold font-serif"
        >
          Submit Test
        </button>
      </div>

      {/* Mobile Overlay Modal */}
      <AnimatePresence>
        {isOpenMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center p-2 sm:hidden"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-h-[85vh] h-full"
            >
              {paletteContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Fixed Right Column) */}
      <aside className="hidden sm:block w-72 shrink-0 sticky top-6 self-start">
        {paletteContent}
      </aside>
    </>
  );
}
