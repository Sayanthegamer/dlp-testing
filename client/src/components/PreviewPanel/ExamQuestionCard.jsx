import React from 'react';
import MathRenderer from './MathRenderer';
import ReviewBanner from './ReviewBanner';
import { Check, Edit2, Circle } from 'lucide-react';

export default function ExamQuestionCard({
  questionData,
  onSelectMathForEdit,
  onOpenEditor,
  onChangeCorrectAnswer
}) {
  if (!questionData) return null;

  const { questionText, type, options, correctAnswer, confidenceScore, needsReview } = questionData;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="space-y-4">
      {needsReview && (
        <ReviewBanner
          confidenceScore={confidenceScore}
          onOpenEditor={onOpenEditor}
        />
      )}

      {/* Main Exam Card */}
      <div className="exam-paper rounded-xl p-6 sm:p-8 text-[#1c1b18] relative transition-all">
        
        {/* Exam Header Meta */}
        <div className="flex items-center justify-between border-b border-[#e5dcd0] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-[#8c4a17] text-sm uppercase tracking-wider">
              Question 1
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0e6d8] text-[#5c5346] font-sans font-medium">
              {type === 'mcq' ? 'Multiple Choice (MCQ)' : 'Short Answer'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#786f63] font-sans">
            <span>Exam Paper Preview</span>
          </div>
        </div>

        {/* Question Stem Text */}
        <div className="font-serif text-lg sm:text-xl text-[#22201c] leading-relaxed mb-6">
          <MathRenderer
            text={questionText}
            needsReview={needsReview}
            onSelectMathForEdit={onSelectMathForEdit}
          />
        </div>

        {/* Options (MCQ mode) */}
        {type === 'mcq' && options && options.length > 0 && (
          <div className="space-y-2.5 mt-4">
            <div className="flex items-center justify-between text-xs text-[#786f63] font-sans px-1 mb-1">
              <span>Select Options or click badge to change Correct Answer Key:</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((opt, idx) => {
                const isCorrect = correctAnswer === idx;
                const letter = optionLetters[idx] || (idx + 1).toString();

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all ${
                      isCorrect
                        ? 'bg-[#f4f9f4] border-[#81c784] shadow-sm'
                        : 'bg-[#faf7f2] border-[#e2d8ca] hover:border-[#cbbfad]'
                    }`}
                  >
                    {/* Click Letter Badge to set Correct Answer */}
                    <button
                      type="button"
                      onClick={() => onChangeCorrectAnswer && onChangeCorrectAnswer(idx)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-sans font-bold text-xs shrink-0 mt-0.5 transition-transform active:scale-95 ${
                        isCorrect
                          ? 'bg-[#2e7d32] text-white shadow-xs'
                          : 'bg-[#e5dcd0] text-[#4a443b] hover:bg-[#d8ccbc]'
                      }`}
                      title={`Click to set Option ${letter} as the correct answer key`}
                    >
                      {letter}
                    </button>

                    {/* Option Text */}
                    <div
                      onClick={() => onSelectMathForEdit && onSelectMathForEdit(opt)}
                      className="font-serif text-base text-[#2c2825] flex-1 leading-normal pt-0.5 cursor-pointer hover:underline"
                      title="Click text to edit formula visually"
                    >
                      <MathRenderer
                        text={opt}
                        needsReview={needsReview}
                        onSelectMathForEdit={onSelectMathForEdit}
                      />
                    </div>

                    {/* Correct Key Button / Indicator */}
                    <button
                      type="button"
                      onClick={() => onChangeCorrectAnswer && onChangeCorrectAnswer(idx)}
                      className={`flex items-center gap-1 text-[11px] font-sans font-semibold px-2 py-1 rounded transition-all shrink-0 ${
                        isCorrect
                          ? 'text-[#2e7d32] bg-[#e8f5e9] border border-[#a5d6a7]'
                          : 'text-[#8c8275] bg-[#f0e8dc] hover:bg-[#e4dbcc] hover:text-[#2c2825]'
                      }`}
                      title="Set as correct answer"
                    >
                      {isCorrect ? (
                        <>
                          <Check className="w-3 h-3 text-[#2e7d32]" />
                          <span>Correct Key</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3 h-3 text-[#8c8275]" />
                          <span>Set Correct</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Short Answer mode display & edit */}
        {type === 'short_answer' && (
          <div className="mt-4 p-4 rounded-lg bg-[#faf7f2] border border-[#e2d8ca] space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#736c62] block">
              Expected Answer Key (Short Answer)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={correctAnswer !== undefined && correctAnswer !== null ? correctAnswer : ''}
                onChange={(e) => onChangeCorrectAnswer && onChangeCorrectAnswer(e.target.value)}
                placeholder="Enter correct answer value (e.g. 5, x = 2, or short text)..."
                className="flex-1 px-3 py-2 rounded-lg border border-[#c9bea9] bg-white font-serif text-base text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d]"
              />
            </div>
          </div>
        )}

        {/* Teacher Edit Help Prompt */}
        <div className="mt-6 pt-4 border-t border-[#ede5d8] flex items-center justify-between text-xs text-[#8c8275] font-sans">
          <span>💡 Click any option badge (A/B/C/D) or "Set Correct" button to change answer key</span>
          <button
            type="button"
            onClick={onOpenEditor}
            className="flex items-center gap-1 text-[#a86e2d] hover:underline font-medium"
          >
            <Edit2 className="w-3 h-3" /> Edit Formulas Visually
          </button>
        </div>

      </div>
    </div>
  );
}
