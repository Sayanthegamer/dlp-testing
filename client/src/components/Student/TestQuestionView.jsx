import React from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import { ChevronLeft, ChevronRight, CheckSquare, CheckCircle } from 'lucide-react';

export default function TestQuestionView({
  questions,
  currentIndex,
  answers,
  onAnswerChange,
  onNext,
  onPrevious,
  onReview,
  studentName
}) {
  const question = questions[currentIndex];
  if (!question) return null;

  const { id, questionText, type, options } = question;
  const currentAnswer = answers[id];

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const isLongOptions = isLongOptionsLayout(options);

  const isLastQuestion = currentIndex === questions.length - 1;
  const totalQuestions = questions.length;

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-4 sm:py-8 px-3 sm:px-6 flex flex-col justify-between">
      <div className="max-w-3xl w-full mx-auto space-y-4 sm:space-y-6">
        
        {/* Top Progress & Navigation Bar */}
        <div className="flex items-center justify-between border-b border-[#DCD5C4] pb-3 sm:pb-4 font-sans text-xs text-[#5c5346] gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="font-serif font-bold text-base sm:text-lg text-[#232323]">
              Question {currentIndex + 1} <span className="text-[#8c8275] text-xs sm:text-sm font-normal">of {totalQuestions}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-[#8c8275]">
              Candidate: <strong className="text-[#232323]">{studentName}</strong>
            </span>
            <button
              type="button"
              onClick={onReview}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#232323] text-xs font-semibold transition-colors shadow-xs active:scale-95"
            >
              <CheckSquare className="w-4 h-4 text-[#8c4a17]" />
              <span>Review ({Object.keys(answers).length}/{totalQuestions})</span>
            </button>
          </div>
        </div>

        {/* Exam Question Card */}
        <div className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-2xl sm:rounded-3xl p-4 sm:p-10 shadow-sm space-y-6 sm:space-y-8">
          
          {/* Question Stem */}
          <div className="space-y-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8c4a17] block">
              Question {currentIndex + 1}
            </span>
            <div className="font-serif text-lg sm:text-2xl text-[#232323] leading-relaxed">
              <MathRenderer text={questionText} readOnly={true} />
            </div>
          </div>

          {/* MCQ Options */}
          {type === 'mcq' && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-sans font-semibold text-[#5c5346] block">
                Select your choice:
              </span>
              <div
                className={
                  isLongOptions
                    ? 'space-y-2.5 sm:space-y-3'
                    : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5'
                }
              >
                {(options || []).map((opt, optIdx) => {
                  const isSelected = currentAnswer === optIdx;
                  const letter = optionLetters[optIdx] || (optIdx + 1).toString();

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => onAnswerChange(id, optIdx)}
                      className={`w-full text-left flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#232323] text-white border-[#232323] shadow-md scale-[1.01]'
                          : 'bg-white text-[#232323] border-[#DCD5C4] hover:border-[#b8ad99] hover:bg-[#faf7f2]'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-sans font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                          isSelected
                            ? 'bg-white text-[#232323]'
                            : 'bg-[#f0e6d8] text-[#5c5346]'
                        }`}
                      >
                        {letter}
                      </span>
                      <div className="flex-1 min-w-0 pt-0.5 font-serif text-sm sm:text-base leading-snug">
                        <MathRenderer text={opt} readOnly={true} />
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Short Answer Input (Numeric, Text, or Legacy) */}
          {(type === 'short_answer_numeric' || type === 'short_answer_text' || type === 'short_answer') && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-sans font-semibold text-[#5c5346]">
                Type your answer below:
              </label>
              <input
                type="text"
                value={currentAnswer !== undefined && currentAnswer !== null ? currentAnswer : ''}
                onChange={(e) => onAnswerChange(id, e.target.value)}
                placeholder="Enter numerical value (integer or decimal, e.g. 15, -3.5)..."
                autoFocus
                className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-[#DCD5C4] bg-white font-serif text-base sm:text-lg text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#232323] shadow-inner"
              />
            </div>
          )}

        </div>

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-2 gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl bg-[#f0e6d8] hover:bg-[#e4d8c5] disabled:opacity-40 text-[#232323] font-serif font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={onReview}
              className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[44px]"
            >
              <span>Review Answers</span>
              <CheckSquare className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[44px]"
            >
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
