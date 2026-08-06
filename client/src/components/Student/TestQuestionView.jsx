import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import QuestionPaletteSidebar from './QuestionPaletteSidebar';
import ProctoringSecurityGuard from './ProctoringSecurityGuard';
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Bookmark,
  RotateCcw,
  ShieldAlert,
  Clock
} from 'lucide-react';

export default function TestQuestionView({
  questions = [],
  currentIndex = 0,
  answers = {},
  questionStatuses = {},
  onAnswerChange,
  onUpdateQuestionStatus,
  onSelectQuestion,
  onNext,
  onPrevious,
  onReview,
  onSubmitExam,
  onDisqualifyCheating,
  cheatingFlagged = false,
  studentName = 'Candidate'
}) {
  const question = questions[currentIndex];
  if (!question) return null;

  const { id, questionText, type, options } = question;
  const currentAnswer = answers[id];

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const isLongOptions = isLongOptionsLayout(options);
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const hasAnswer = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';

  // 1. Save & Next
  const handleSaveAndNext = () => {
    if (hasAnswer) {
      onUpdateQuestionStatus(id, 'answered');
    } else {
      onUpdateQuestionStatus(id, 'not_answered');
    }
    if (!isLastQuestion) {
      onNext();
    }
  };

  // 2. Clear Response
  const handleClearResponse = () => {
    onAnswerChange(id, null);
    onUpdateQuestionStatus(id, 'not_answered');
  };

  // 3. Mark for Review & Next
  const handleMarkForReviewAndNext = () => {
    if (hasAnswer) {
      onUpdateQuestionStatus(id, 'answered_marked_for_review');
    } else {
      onUpdateQuestionStatus(id, 'marked_for_review');
    }
    if (!isLastQuestion) {
      onNext();
    }
  };

  // 4. Save & Mark for Review
  const handleSaveAndMarkForReview = () => {
    onUpdateQuestionStatus(id, 'answered_marked_for_review');
    if (!isLastQuestion) {
      onNext();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-4 sm:py-6 px-3 sm:px-6 flex flex-col justify-between">
      {/* Proctoring Security Guard Monitor */}
      <ProctoringSecurityGuard
        isActive={!cheatingFlagged}
        onDisqualifyCheating={onDisqualifyCheating}
        studentName={studentName}
      />

      {/* Disqualification Banner */}
      {cheatingFlagged && (
        <div className="max-w-7xl w-full mx-auto mb-4 p-4 rounded-2xl bg-red-600 text-white shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-sans font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>SESSION DISQUALIFIED: Cheating / Excessive Tab Switching Detected.</span>
          </div>
          <span className="bg-red-800 px-3 py-1 rounded-lg text-xs font-mono">0 Marks</span>
        </div>
      )}

      {/* Main 2-Column CBT Container */}
      <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row gap-6 flex-1">
        
        {/* Left Column: Question Canvas */}
        <div className="flex-1 space-y-4 sm:space-y-6 flex flex-col justify-between">
          <div className="space-y-4 sm:space-y-6">
            
            {/* Top Progress & Header Bar */}
            <div className="flex items-center justify-between border-b border-[#DCD5C4] pb-3 sm:pb-4 font-sans text-xs text-[#5c5346] gap-2">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="font-serif font-bold text-base sm:text-xl text-[#232323]">
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
                  <span>Review Paper ({Object.keys(answers).length}/{totalQuestions})</span>
                </button>
              </div>
            </div>

            {/* Animated Exam Question Card */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={id || currentIndex}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm space-y-6"
              >

                {/* Reading Passage / Comprehension Block */}
                {question.passageText && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#f4eee4] border border-[#e0d6c7] space-y-2">
                    <div className="flex items-center gap-2 font-serif font-bold text-sm text-[#8c4a17]">
                      <BookOpen className="w-4 h-4 shrink-0" />
                      <span>{question.passageTitle || 'Comprehension Passage / Case Study'}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-[#3c3730] font-sans leading-relaxed">
                      <MathRenderer text={question.passageText} readOnly={true} />
                    </div>
                  </div>
                )}

                {/* Question Stem */}
                <div className="space-y-2">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8c4a17] block">
                    {type === 'match_following' ? 'Match the Following Question' : `Question ${currentIndex + 1}`}
                  </span>
                  <div className="font-serif text-lg sm:text-2xl text-[#232323] leading-relaxed">
                    <MathRenderer text={questionText} readOnly={true} />
                  </div>
                  <DiagramBlock diagrams={question.diagrams} diagramImages={question.diagramImages} />
                </div>

                {/* MCQ / Match the Following Options */}
                {(type === 'mcq' || type === 'match_following') && (
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-sans font-semibold text-[#5c5346] block">
                      {type === 'match_following' ? 'Select the correct matching combination:' : 'Select your choice:'}
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
                          <motion.button
                            key={optIdx}
                            type="button"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onAnswerChange(id, optIdx);
                              onUpdateQuestionStatus(id, 'answered');
                            }}
                            disabled={cheatingFlagged}
                            className={`w-full text-left flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                              isSelected
                                ? 'bg-[#232323] text-white border-[#232323] shadow-md'
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
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Numerical Answer Input */}
                {type === 'short_answer_numeric' && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-sans font-semibold text-[#5c5346]">
                      Type your answer below:
                    </label>
                    <input
                      type="text"
                      value={currentAnswer !== undefined && currentAnswer !== null ? currentAnswer : ''}
                      onChange={(e) => {
                        onAnswerChange(id, e.target.value);
                        onUpdateQuestionStatus(id, e.target.value ? 'answered' : 'not_answered');
                      }}
                      disabled={cheatingFlagged}
                      placeholder="Enter numerical value (integer or decimal, e.g. 15, -3.5)..."
                      className="w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-[#DCD5C4] bg-white font-serif text-base sm:text-lg text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#232323] shadow-inner"
                    />
                  </div>
                )}

                {/* Unclassified Question Notice */}
                {type !== 'mcq' && type !== 'short_answer_numeric' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans font-medium space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Question Pending Teacher Classification</span>
                    </div>
                    <p className="text-[#6e5833]">
                      This question requires teacher review in the catalogue before it can be auto-graded on a student exam paper.
                    </p>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Authentic NTA / Aakash CBT Style 4-Button Control Action Bar */}
          <div className="space-y-3 pt-4 border-t border-[#DCD5C4]">
            {/* Top Action Buttons (Save & Mark Review / Clear Response / Mark Review & Next) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {/* 1. Save & Next */}
              <button
                type="button"
                onClick={handleSaveAndNext}
                disabled={cheatingFlagged}
                className="px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-semibold text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Save & Next</span>
              </button>

              {/* 2. Clear Response */}
              <button
                type="button"
                onClick={handleClearResponse}
                disabled={cheatingFlagged || !hasAnswer}
                className="px-3 sm:px-4 py-2.5 rounded-xl bg-white border border-[#DCD5C4] hover:bg-[#f0e6d8] disabled:opacity-40 text-[#232323] font-sans font-semibold text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
                <span>Clear Response</span>
              </button>

              {/* 3. Mark for Review & Next */}
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                disabled={cheatingFlagged}
                className="px-3 sm:px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-sans font-semibold text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Mark for Review & Next</span>
              </button>

              {/* 4. Save & Mark for Review */}
              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                disabled={cheatingFlagged}
                className="px-3 sm:px-4 py-2.5 rounded-xl bg-purple-800 hover:bg-purple-900 text-white font-sans font-semibold text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save & Mark Review</span>
              </button>
            </div>

            {/* Bottom Nav Prev / Next Controls */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onPrevious}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl bg-[#f0e6d8] hover:bg-[#e4d8c5] disabled:opacity-40 text-[#232323] font-serif font-semibold text-xs transition-all flex items-center gap-1 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={isLastQuestion}
                className="px-4 py-2 rounded-xl bg-[#f0e6d8] hover:bg-[#e4d8c5] disabled:opacity-40 text-[#232323] font-serif font-semibold text-xs transition-all flex items-center gap-1 active:scale-95"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: NTA CBT Question Palette Sidebar */}
        <QuestionPaletteSidebar
          questions={questions}
          currentIndex={currentIndex}
          questionStatuses={questionStatuses}
          answers={answers}
          onSelectQuestion={onSelectQuestion}
          onSubmitExam={onSubmitExam || onReview}
        />

      </div>
    </div>
  );
}
