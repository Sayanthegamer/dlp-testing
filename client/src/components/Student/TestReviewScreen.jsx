import React from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { CheckCircle2, AlertCircle, ArrowLeft, Send } from 'lucide-react';

export default function TestReviewScreen({
  questions,
  answers,
  onJumpToQuestion,
  onSubmitTest
}) {
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).filter(
    (key) => answers[key] !== undefined && answers[key] !== null && answers[key] !== ''
  ).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-10 px-4 sm:px-6">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif font-bold text-2xl text-[#232323]">Pre-Submission Review</h1>
            <p className="text-xs text-[#5c5346] font-sans mt-1">
              Check your responses before submitting your test paper for grading.
            </p>
          </div>

          <div className="flex items-center gap-3 font-sans text-xs shrink-0">
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{answeredCount} Answered</span>
            </span>
            {unansweredCount > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>{unansweredCount} Unanswered</span>
              </span>
            )}
          </div>
        </div>

        {/* Question Grid Review */}
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const hasAnswer = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
            let answerSummary = 'Not answered';

            if (hasAnswer) {
              if (q.type === 'mcq' && typeof answers[q.id] === 'number') {
                const letter = ['A', 'B', 'C', 'D', 'E', 'F'][answers[q.id]] || answers[q.id];
                answerSummary = `Option ${letter}`;
              } else {
                answerSummary = `"${answers[q.id]}"`;
              }
            }

            return (
              <div
                key={q.id || idx}
                onClick={() => onJumpToQuestion(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  hasAnswer
                    ? 'bg-[#fcfbfa] border-[#DCD5C4] hover:border-[#232323]'
                    : 'bg-amber-50/60 border-amber-300 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className={`w-8 h-8 rounded-xl font-serif font-bold text-xs flex items-center justify-center shrink-0 ${
                    hasAnswer ? 'bg-[#232323] text-white' : 'bg-amber-700 text-white'
                  }`}>
                    #{idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-sm text-[#232323] truncate">
                      <MathRenderer text={q.questionText} readOnly={true} />
                    </div>
                    <div className="text-xs font-sans mt-0.5">
                      {hasAnswer ? (
                        <span className="text-emerald-800 font-medium">Selected Answer: {answerSummary}</span>
                      ) : (
                        <span className="text-amber-900 font-semibold">Answer missing</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="text-xs font-sans font-semibold text-[#8c4a17] hover:underline shrink-0"
                >
                  Jump to Q#{idx + 1}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#DCD5C4]">
          <button
            type="button"
            onClick={() => onJumpToQuestion(0)}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#232323] font-serif font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Questions</span>
          </button>

          <button
            type="button"
            onClick={onSubmitTest}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#8c4a17] hover:bg-[#703a11] text-white font-serif font-bold text-base shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            <span>Submit Test Paper</span>
          </button>
        </div>

      </div>
    </div>
  );
}
