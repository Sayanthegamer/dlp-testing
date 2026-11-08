import React, { useState } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import DiagramAdjustModal from './DiagramAdjustModal';
import { computeNeedsReview } from '../../services/reviewEvaluator';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import {
  Check,
  Copy,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Crop,
  BookOpen,
  Plus
} from 'lucide-react';

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
  const [isAdjustingDiagram, setIsAdjustingDiagram] = useState(false);

  const { id, questionText, type, options, correctAnswer } = question;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const reviewEvaluation = computeNeedsReview(question);
  const needsReview = reviewEvaluation.needsReview;
  const reviewReasons = reviewEvaluation.reasons;

  const isLongOptions = isLongOptionsLayout(options);

  const handleOptionChange = (idx, val) => {
    const newOptions = [...(options || [])];
    newOptions[idx] = val;
    onUpdateQuestion(id, { ...question, options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions = [...(options || []), `Option ${(options || []).length + 1}`];
    onUpdateQuestion(id, { ...question, options: newOptions });
  };

  const handleRemoveOption = (optIdx) => {
    const newOptions = (options || []).filter((_, i) => i !== optIdx);
    let nextCorrect = correctAnswer;
    if (correctAnswer === optIdx) nextCorrect = null;
    else if (typeof correctAnswer === 'number' && correctAnswer > optIdx) nextCorrect = correctAnswer - 1;
    onUpdateQuestion(id, { ...question, options: newOptions, correctAnswer: nextCorrect });
  };

  return (
    <div
      id={`question-card-${index}`}
      className={`p-6 sm:p-8 text-[#1f1b16] relative transition-calm ${
        needsReview ? 'bg-[#faf7f0] border-l-4 border-l-[#b8622e]' : 'bg-[#fdfbf7]'
      }`}
    >
      {/* Question Layout: Left Margin Number + Right Content Column */}
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
        {/* Left Margin Exam Number ("Q1", "Q2" set in serif, per product guidelines) */}
        <div className="flex sm:flex-col items-center sm:items-start justify-between w-full sm:w-12 shrink-0 pt-0.5">
          <span className="font-serif font-medium text-xl text-[#1f1b16] tabular-nums">
            Q{index + 1}.
          </span>
          <span className="text-[11px] font-mono text-[#7b7266] tabular-nums sm:mt-1">
            4 pts
          </span>
        </div>

        {/* Main Question Content Column */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Quiet Control & Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#efe9df]">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={
                  type === 'mcq'
                    ? 'mcq'
                    : type === 'match_following'
                    ? 'match_following'
                    : type === 'short_answer_numeric'
                    ? 'short_answer_numeric'
                    : ''
                }
                onChange={(e) => onUpdateQuestion(id, { ...question, type: e.target.value })}
                className="text-xs px-2.5 h-7 rounded-md bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] font-sans font-medium focus:outline-none focus:ring-1 focus:ring-[#8c4a17] cursor-pointer"
              >
                {!['mcq', 'match_following', 'short_answer_numeric'].includes(type) && (
                  <option value="" disabled>Select question type</option>
                )}
                <option value="mcq">Multiple choice</option>
                <option value="short_answer_numeric">Numerical value</option>
                <option value="match_following">Match the following</option>
              </select>

              {Array.isArray(question.diagrams) && question.diagrams.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdateQuestion(id, { ...question, diagramsConfirmed: !question.diagramsConfirmed })}
                  className={`flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 h-7 rounded-md border transition-calm ${
                    question.diagramsConfirmed
                      ? 'bg-[#fdfbf7] border-[#dcd5c4] text-[#3f6b4a]'
                      : 'bg-[#efe9df] border-[#b8622e] text-[#b8622e] hover:bg-[#e5dec9]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  <span>{question.diagramsConfirmed ? 'Diagram verified' : 'Confirm diagram'}</span>
                </button>
              )}

              {needsReview ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-md bg-[#efe9df] border border-[#b8622e] text-[#b8622e] font-sans font-medium"
                  title={reviewReasons.join(', ')}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Needs review: {reviewReasons.join(', ')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-md bg-[#fdfbf7] border border-[#dcd5c4] text-[#3f6b4a] font-sans font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Verified</span>
                </span>
              )}
            </div>

            {/* Quiet Row Actions */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setIsAdjustingDiagram(true)}
                className="px-2.5 h-7 rounded-md text-xs font-medium text-[#5e554a] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm flex items-center gap-1.5"
                title="Crop or attach figure"
              >
                <Crop className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                <span>{Array.isArray(question.diagrams) && question.diagrams.length > 0 ? 'Adjust figure' : 'Add figure'}</span>
              </button>
              <button
                type="button"
                onClick={() => onDuplicateQuestion(id)}
                className="p-1.5 h-7 w-7 rounded-md text-[#7b7266] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
                title="Duplicate question"
              >
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => onDeleteQuestion(id)}
                className="p-1.5 h-7 w-7 rounded-md text-[#7b7266] hover:text-[#dc2626] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
                title="Delete question"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Comprehension Passage (if present) */}
          {question.passageText && (
            <div className="p-4 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] space-y-1.5">
              <div className="flex items-center gap-2 font-serif font-medium text-xs text-[#5e554a]">
                <BookOpen className="w-3.5 h-3.5 text-[#7b7266] shrink-0" strokeWidth={1.5} />
                <span>{question.passageTitle || 'Comprehension passage'}</span>
              </div>
              <div className="text-sm text-[#1f1b16] font-serif leading-relaxed">
                <MathRenderer text={question.passageText} readOnly={true} />
              </div>
            </div>
          )}

          {/* Question Stem (Inline Editable) */}
          <div>
            {isEditingStem ? (
              <textarea
                value={questionText}
                onChange={(e) => onUpdateQuestion(id, { ...question, questionText: e.target.value })}
                onBlur={() => setIsEditingStem(false)}
                rows={3}
                className="w-full p-3 rounded-lg border border-[#8c4a17] bg-[#fdfbf7] font-serif text-lg text-[#1f1b16] focus:outline-none leading-relaxed"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingStem(true)}
                className="font-serif text-lg sm:text-xl text-[#1f1b16] leading-relaxed cursor-text py-1.5 px-2 -mx-2 rounded-lg border border-transparent hover:border-[#dcd5c4] hover:bg-[#f7f4ee] transition-calm"
                title="Click to edit question stem inline"
              >
                <MathRenderer
                  text={questionText}
                  needsReview={needsReview}
                  onSelectMathForEdit={onSelectMathForEdit}
                />
              </div>
            )}

            <DiagramBlock diagrams={question.diagrams} diagramImages={question.diagramImages} />
          </div>

          {/* MCQ & Match the Following Options */}
          {(type === 'mcq' || type === 'match_following') && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-[#7b7266] font-sans">
                <span>Click a letter (A–D) to mark the answer key</span>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-[#8c4a17] font-medium hover:underline text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Add option</span>
                </button>
              </div>

              <div
                className={
                  isLongOptions
                    ? 'space-y-2'
                    : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
                }
              >
                {(options || []).map((opt, optIdx) => {
                  const isCorrect = correctAnswer === optIdx;
                  const letter = optionLetters[optIdx] || (optIdx + 1).toString();
                  const isEditingThisOpt = editingOptionIdx === optIdx;

                  return (
                    <div
                      key={optIdx}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-calm ${
                        isCorrect
                          ? 'bg-[#f4f8f5] border-[#3f6b4a]'
                          : 'bg-[#f7f4ee] border-[#dcd5c4] hover:border-[#c4bba6]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdateQuestion(id, { ...question, correctAnswer: optIdx })}
                        className={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5 transition-calm ${
                          isCorrect
                            ? 'bg-[#3f6b4a] text-[#fdfbf7]'
                            : 'bg-[#fdfbf7] border border-[#dcd5c4] text-[#5e554a] hover:border-[#8c4a17] hover:text-[#1f1b16]'
                        }`}
                        title={`Set Option ${letter} as answer key`}
                      >
                        {letter}
                      </button>

                      <div className="flex-1 min-w-0 pt-0.5 overflow-x-auto">
                        {isEditingThisOpt ? (
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                            onBlur={() => setEditingOptionIdx(null)}
                            className="w-full px-2 py-1 rounded-md border border-[#8c4a17] bg-[#fdfbf7] font-serif text-base text-[#1f1b16] focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingOptionIdx(optIdx)}
                            className="font-serif text-base text-[#1f1b16] leading-normal cursor-text hover:underline"
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

                      <div className="flex items-center gap-1 shrink-0">
                        {isCorrect && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium px-2 py-0.5 rounded-md bg-[#fdfbf7] border border-[#3f6b4a] text-[#3f6b4a]">
                            <Check className="w-3 h-3" strokeWidth={1.5} />
                            <span>Key</span>
                          </span>
                        )}

                        {(options || []).length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(optIdx)}
                            className="text-[#7b7266] hover:text-[#dc2626] p-1 rounded-md transition-calm"
                            title="Remove option"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Numerical Answer Key & Tolerance Range */}
          {type === 'short_answer_numeric' && (
            <div className="mt-3 p-4 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#5e554a]">
                  Numerical answer key and tolerance range
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuestion(id, { ...question, numericalConfirmed: !question.numericalConfirmed })}
                  className={`flex items-center gap-1.5 text-xs font-sans font-medium px-3 h-8 rounded-lg border transition-calm ${
                    question.numericalConfirmed
                      ? 'bg-[#fdfbf7] text-[#3f6b4a] border-[#3f6b4a]'
                      : 'bg-[#b8622e] text-[#fdfbf7] border-[#b8622e] hover:bg-[#9e5123]'
                  }`}
                >
                  {question.numericalConfirmed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Range confirmed</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Confirm range</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
                <div>
                  <label className="block text-xs text-[#5e554a] mb-1">
                    Exact value
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={correctAnswer !== undefined && correctAnswer !== null ? correctAnswer : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      onUpdateQuestion(id, { ...question, correctAnswer: val, numericalConfirmed: true });
                    }}
                    placeholder="15"
                    className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5e554a] mb-1">
                    Minimum accepted
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
                    placeholder="14.8"
                    className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5e554a] mb-1">
                    Maximum accepted
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
                    placeholder="15.2"
                    className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isAdjustingDiagram && (
        <DiagramAdjustModal
          question={{ ...question, index }}
          onUpdateQuestion={onUpdateQuestion}
          onClose={() => setIsAdjustingDiagram(false)}
        />
      )}
    </div>
  );
}
