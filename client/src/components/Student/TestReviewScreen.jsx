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
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f1b16] py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif font-medium text-2xl text-[#1f1b16]">Review responses before submission</h1>
            <p className="text-xs text-[#5e554a] mt-1">
              Click any item below to return to that question, or submit your paper for grading
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums text-xs shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{answeredCount} answered</span>
            </span>
            {unansweredCount > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-[#efe9df] border border-[#b8622e] text-[#b8622e] font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{unansweredCount} unanswered</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl divide-y divide-[#dcd5c4] overflow-hidden">
          {questions.map((q, idx) => {
            const isUnclassified = q.type !== 'mcq' && q.type !== 'match_following' && q.type !== 'short_answer_numeric';
            const hasAnswer = !isUnclassified && answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
            let answerSummary = 'Unanswered';

            if (isUnclassified) {
              answerSummary = 'Pending classification';
            } else if (hasAnswer) {
              if ((q.type === 'mcq' || q.type === 'match_following') && typeof answers[q.id] === 'number') {
                const letter = ['A', 'B', 'C', 'D', 'E', 'F'][answers[q.id]] || answers[q.id];
                answerSummary = `Option ${letter}`;
              } else {
                answerSummary = `${answers[q.id]}`;
              }
            }

            return (
              <div
                key={q.id || idx}
                onClick={() => onJumpToQuestion(idx)}
                className="p-4 sm:p-5 hover:bg-[#f7f4ee] transition-calm cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="font-serif font-medium text-base text-[#1f1b16] tabular-nums w-8 shrink-0">
                    Q{idx + 1}.
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-serif text-base text-[#1f1b16] truncate">
                      <MathRenderer text={q.questionText} readOnly={true} />
                    </div>
                    <div className="text-xs font-mono tabular-nums">
                      {hasAnswer ? (
                        <span className="text-[#3f6b4a] font-medium">Response: {answerSummary}</span>
                      ) : (
                        <span className="text-[#b8622e]">{answerSummary}</span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-xs font-medium text-[#8c4a17] hover:underline shrink-0">
                  Edit
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onJumpToQuestion(0)}
            className="w-full sm:w-auto px-4 h-10 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] hover:bg-[#efe9df] text-[#1f1b16] font-sans font-medium text-xs transition-calm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to questions</span>
          </button>

          <button
            type="button"
            onClick={onSubmitTest}
            className="w-full sm:w-auto px-6 h-10 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
            <span>Submit examination paper</span>
          </button>
        </div>
      </div>
    </div>
  );
}
