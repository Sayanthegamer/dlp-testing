import React, { useState } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { computeNeedsReview } from '../../services/reviewEvaluator';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import { Check, Edit2, Copy, Trash2, CheckCircle2, Circle, Type, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function QuestionCard({
  question,
  index,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onSelectMathForEdit
}) {
  const [isEditingStem, setIsEditingStem] = useState(false);
  const [editingOptionIdx, setEditingOptionIdx] = useState(null);

  const { id, questionText, type, options, correctAnswer } = question;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Deterministic Needs Review Evaluation
  const reviewEvaluation = computeNeedsReview(question);
  const needsReview = reviewEvaluation.needsReview;
  const reviewReasons = reviewEvaluation.reasons;

  // Smart options layout classifier: 2-column grid if short, 1-column list if long
  const isLongOptions = isLongOptionsLayout(options);

  const handleStemChange = (val) => {
    onUpdateQuestion(id, { ...question, questionText: val });
  };

  const handleOptionChange = (idx, val) => {
    const newOptions = [...options];
    newOptions[idx] = val;
    onUpdateQuestion(id, { ...question, options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions = [...(options || []), `Option ${(options || []).length + 1}`];
    onUpdateQuestion(id, { ...question, options: newOptions });
  };

  const handleRemoveOption = (optIdx) => {
    const newOptions = options.filter((_, i) => i !== optIdx);
    onUpdateQuestion(id, { ...question, options: newOptions });
  };

  return (
    <div
      id={`question-card-${index}`}
      className={`exam-paper rounded-2xl p-4 sm:p-6 md:p-8 text-[#1c1b18] relative transition-all shadow-sm ${
        needsReview ? 'border-2 border-amber-400 bg-[#fefdfa]' : ''
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#e5dcd0] pb-3 mb-4 sm:mb-5 gap-2">
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#8c4a17] text-white flex items-center justify-center font-serif font-bold text-xs sm:text-sm shadow-xs shrink-0">
            #{index + 1}
          </span>

          {/* Question Type Switcher */}
          <select
            value={type === 'mcq' ? 'mcq' : type === 'short_answer_numeric' ? 'short_answer_numeric' : ''}
            onChange={(e) => onUpdateQuestion(id, { ...question, type: e.target.value })}
            className="text-xs px-2 sm:px-2.5 py-1 rounded-lg bg-[#f0e6d8] border border-[#dcd0be] text-[#4a4237] font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[#8c4a17] cursor-pointer"
          >
            {!['mcq', 'short_answer_numeric'].includes(type) && (
              <option value="" disabled>Select Type (Unclassified)</option>
            )}
            <option value="mcq">MCQ</option>
            <option value="short_answer_numeric">Numerical Question</option>
          </select>

          {/* Deterministic Review Badge */}
          {needsReview ? (
            <span
              className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-sans font-semibold leading-tight"
              title={`Action required: ${reviewReasons.join(', ')}`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Needs Review ({reviewReasons.join(', ')})</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 font-sans font-semibold shrink-0"
              title="Verified: Math syntax valid and answer key present"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Verified Ready</span>
            </span>
          )}
        </div>

        {/* Card Actions (Duplicate / Delete) */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => onDuplicateQuestion(id)}
            className="p-1.5 sm:p-2 rounded-lg text-[#736c62] hover:bg-[#ede5d8] transition-colors"
            title="Duplicate Question"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteQuestion(id)}
            className="p-1.5 sm:p-2 rounded-lg text-[#c53030] hover:bg-red-50 transition-colors"
            title="Delete Question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Question Stem Text (Direct Inline Editing) */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between text-xs text-[#786f63] font-sans mb-1">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-[#8c4a17]">
            Question Stem
          </span>
          <span className="text-[11px] text-[#8c4a17] font-medium flex items-center gap-1">
            <Type className="w-3 h-3" />
            <span>Edit Text Inline</span>
          </span>
        </div>

        {isEditingStem ? (
          <textarea
            value={questionText}
            onChange={(e) => onUpdateQuestion(id, { ...question, questionText: e.target.value })}
            onBlur={() => setIsEditingStem(false)}
            rows={3}
            className="w-full p-3 rounded-xl border border-[#a86e2d] bg-white font-serif text-lg text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditingStem(true)}
            className="font-serif text-lg sm:text-xl text-[#1c1b18] leading-relaxed cursor-pointer p-2 rounded-xl border border-transparent hover:border-[#e5dcd0] hover:bg-[#faf7f2] transition-colors"
            title="Click to edit question text directly inline"
          >
            <MathRenderer
              text={questionText}
              needsReview={needsReview}
              onSelectMathForEdit={onSelectMathForEdit}
            />
          </div>
        )}
      </div>

      {/* Options (MCQ mode) */}
      {type === 'mcq' && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between text-xs text-[#786f63] font-sans">
            <span className="text-[11px] sm:text-xs">Options (Click letter badge to set Correct Key):</span>
            <button
              type="button"
              onClick={handleAddOption}
              className="text-[#a86e2d] font-semibold hover:underline text-xs"
            >
              + Add Option
            </button>
          </div>

          <div
            className={
              isLongOptions
                ? 'space-y-2.5 sm:space-y-3'
                : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3'
            }
          >
            {(options || []).map((opt, optIdx) => {
              const isCorrect = correctAnswer === optIdx;
              const letter = optionLetters[optIdx] || (optIdx + 1).toString();
              const isEditingThisOpt = editingOptionIdx === optIdx;

              return (
                <div
                  key={optIdx}
                  className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border transition-all ${
                    isCorrect
                      ? 'bg-[#f4f9f4] border-[#81c784] shadow-xs'
                      : 'bg-[#faf7f2] border-[#e2d8ca] hover:border-[#cbbfad]'
                  }`}
                >
                  {/* Correct Key Badge Toggle */}
                  <button
                    type="button"
                    onClick={() => onUpdateQuestion(id, { ...question, correctAnswer: optIdx })}
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-sans font-bold text-xs shrink-0 mt-0.5 transition-transform active:scale-95 ${
                      isCorrect
                        ? 'bg-[#2e7d32] text-white shadow-xs'
                        : 'bg-[#e5dcd0] text-[#4a443b] hover:bg-[#d8ccbc]'
                    }`}
                    title={`Click to set Option ${letter} as correct answer key`}
                  >
                    {letter}
                  </button>

                  {/* Inline Option Text / Math */}
                  <div className="flex-1 min-w-0 pt-0.5 overflow-x-auto max-w-full">
                    {isEditingThisOpt ? (
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                        onBlur={() => setEditingOptionIdx(null)}
                        className="w-full px-2 py-1 rounded border border-[#a86e2d] bg-white font-serif text-base text-[#1c1b18]"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => setEditingOptionIdx(optIdx)}
                        className="font-serif text-base text-[#2c2825] leading-normal cursor-pointer hover:underline"
                        title="Click to edit option text"
                      >
                        <MathRenderer
                          text={opt}
                          needsReview={needsReview}
                          onSelectMathForEdit={onSelectMathForEdit}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQuestion(id, { ...question, correctAnswer: optIdx })}
                      className={`flex items-center gap-1 text-[11px] font-sans font-semibold px-2 py-1 rounded-lg transition-all ${
                        isCorrect
                          ? 'text-[#2e7d32] bg-[#e8f5e9] border border-[#a5d6a7]'
                          : 'text-[#8c8275] bg-[#f0e8dc] hover:bg-[#e4dbcc]'
                      }`}
                    >
                      {isCorrect ? <Check className="w-3 h-3 text-[#2e7d32]" /> : <Circle className="w-3 h-3 text-[#8c8275]" />}
                      <span className="hidden sm:inline">{isCorrect ? 'Correct Key' : 'Set Correct'}</span>
                    </button>

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(optIdx)}
                        className="text-[#a0aec0] hover:text-[#e53e3e] p-1 rounded"
                        title="Remove Option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Numeric Short Answer Mode */}
      {type === 'short_answer_numeric' && (
        <div className="mt-4 p-4 rounded-xl bg-[#faf7f2] border border-[#e2d8ca] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#736c62] block">
              Numeric Answer Key & Tolerance Range
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuestion(id, { ...question, numericalConfirmed: !question.numericalConfirmed })}
              className={`flex items-center gap-1.5 text-xs font-sans font-bold px-3 py-1.5 rounded-lg transition-all ${
                question.numericalConfirmed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs animate-pulse'
              }`}
            >
              {question.numericalConfirmed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Answer Range Confirmed</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Confirm Answer Range (Required to Publish)</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
            <div>
              <label className="block text-[11px] font-medium text-[#5c5346] mb-1">
                Center Target Value
              </label>
              <input
                type="number"
                step="any"
                value={correctAnswer !== undefined && correctAnswer !== null ? correctAnswer : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                  onUpdateQuestion(id, { ...question, correctAnswer: val, numericalConfirmed: true });
                }}
                placeholder="e.g. 15"
                className="w-full px-3 py-1.5 rounded-lg border border-[#c9bea9] bg-white font-mono text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5c5346] mb-1">
                Min Accepted Value (Inclusive)
              </label>
              <input
                type="number"
                step="any"
                value={Array.isArray(question.acceptedRange) && typeof question.acceptedRange[0] === 'number' ? question.acceptedRange[0] : ''}
                onChange={(e) => {
                  const minVal = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const currentMax = Array.isArray(question.acceptedRange) ? question.acceptedRange[1] : undefined;
                  const newRange = (minVal === undefined && currentMax === undefined) ? undefined : [minVal, currentMax];
                  onUpdateQuestion(id, { ...question, acceptedRange: newRange, numericalConfirmed: true });
                }}
                placeholder="e.g. 14.5"
                className="w-full px-3 py-1.5 rounded-lg border border-[#c9bea9] bg-white font-mono text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5c5346] mb-1">
                Max Accepted Value (Inclusive)
              </label>
              <input
                type="number"
                step="any"
                value={Array.isArray(question.acceptedRange) && typeof question.acceptedRange[1] === 'number' ? question.acceptedRange[1] : ''}
                onChange={(e) => {
                  const maxVal = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const currentMin = Array.isArray(question.acceptedRange) ? question.acceptedRange[0] : undefined;
                  const newRange = (currentMin === undefined && maxVal === undefined) ? undefined : [currentMin, maxVal];
                  onUpdateQuestion(id, { ...question, acceptedRange: newRange, numericalConfirmed: true });
                }}
                placeholder="e.g. 15.5"
                className="w-full px-3 py-1.5 rounded-lg border border-[#c9bea9] bg-white font-mono text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
