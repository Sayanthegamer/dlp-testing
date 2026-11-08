import React, { useState, useEffect } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import QuestionPaletteSidebar from './QuestionPaletteSidebar';
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Bookmark,
  RotateCcw,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { fetchExamSessionStatus } from '../../services/apiService';

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
  cheatingFlagged = false,
  studentName = 'Candidate',
  examId,
  rollingCode,
  durationMinutes = 180
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [extendedNotice, setExtendedNotice] = useState('');
  const [prevExtendedMins, setPrevExtendedMins] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [totalSessionMins, setTotalSessionMins] = useState(durationMinutes);
  const [timeExpiredModal, setTimeExpiredModal] = useState(false);

  useEffect(() => {
    let start = localStorage.getItem(`exam_start_${examId || 'current'}`);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(`exam_start_${examId || 'current'}`, start);
    }
    setSessionStartTime(parseInt(start, 10));
  }, [examId]);

  useEffect(() => {
    const checkStatus = async () => {
      if (!examId && !rollingCode) return;
      const res = await fetchExamSessionStatus(examId, rollingCode);
      if (res.success) {
        const ext = res.extendedMinutes || 0;
        const base = res.durationMinutes || durationMinutes;
        const total = base + ext;
        setTotalSessionMins(total);

        if (ext > prevExtendedMins && prevExtendedMins > 0) {
          const diff = ext - prevExtendedMins;
          setExtendedNotice(`Session extended by +${diff} minutes by the instructor`);
          setTimeout(() => setExtendedNotice(''), 6000);
        }
        setPrevExtendedMins(ext);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [examId, rollingCode, prevExtendedMins, durationMinutes]);

  useEffect(() => {
    if (!sessionStartTime) return;

    const tick = () => {
      const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      const totalAllowedSec = totalSessionMins * 60;
      const remSec = Math.max(0, totalAllowedSec - elapsedSec);
      setSecondsLeft(remSec);

      if (remSec === 0 && !timeExpiredModal) {
        setTimeExpiredModal(true);
        setTimeout(() => {
          if (onSubmitExam) onSubmitExam();
        }, 3000);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime, totalSessionMins, timeExpiredModal, onSubmitExam]);

  const formatCountdown = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const question = questions[currentIndex];
  if (!question) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-6 text-center font-sans">
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-8 max-w-md w-full space-y-4">
          <AlertTriangle className="w-8 h-8 text-[#b8622e] mx-auto" strokeWidth={1.5} />
          <h2 className="text-xl font-serif font-medium text-[#1f1b16]">No questions available</h2>
          <p className="text-xs text-[#5e554a] leading-relaxed">
            This examination paper contains no active questions. Ask your instructor to verify the published snapshot.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-10 rounded-lg bg-[#1f1b16] text-[#fdfbf7] font-medium text-xs transition-calm"
          >
            Return to portal
          </button>
        </div>
      </div>
    );
  }

  const { id, questionText, type, options } = question;
  const currentAnswer = answers[id];

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const isLongOptions = isLongOptionsLayout(options);
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const hasAnswer = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';

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

  const handleClearResponse = () => {
    onAnswerChange(id, null);
    onUpdateQuestionStatus(id, 'not_answered');
  };

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

  const handleSaveAndMarkForReview = () => {
    onUpdateQuestionStatus(id, 'answered_marked_for_review');
    if (!isLastQuestion) {
      onNext();
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f1b16] py-6 pb-24 sm:pb-8 px-4 sm:px-6 flex flex-col justify-between font-sans">
      {cheatingFlagged && (
        <div className="max-w-6xl w-full mx-auto mb-4 p-4 rounded-xl bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>Session disqualified due to focus violation</span>
          </div>
          <span className="font-mono tabular-nums">0 marks</span>
        </div>
      )}

      {extendedNotice && (
        <div className="max-w-6xl w-full mx-auto mb-4 p-3.5 rounded-xl bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{extendedNotice}</span>
          </div>
          <span className="font-mono tabular-nums">Updated</span>
        </div>
      )}

      {timeExpiredModal && (
        <div className="fixed inset-0 z-50 bg-[#161513]/70 flex items-center justify-center p-4 font-sans">
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-8 max-w-md w-full shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-[#efe9df] text-[#b8622e] mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h3 className="font-serif font-medium text-2xl text-[#1f1b16]">
              Session time completed
            </h3>
            <p className="text-xs text-[#5e554a] leading-relaxed">
              Your allotted examination time has ended. Submitting your recorded responses now.
            </p>
          </div>
        </div>
      )}

      {/* Main 2-Column CBT Container */}
      <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row gap-6 flex-1">
        {/* Left Column: Question Sheet */}
        <div className="flex-1 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Top Progress & Timer Bar */}
            <div className="flex items-center justify-between border-b border-[#dcd5c4] pb-3.5 text-xs text-[#5e554a] gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-serif font-medium text-lg text-[#1f1b16] tabular-nums">
                  Question {currentIndex + 1} <span className="text-[#7b7266] text-sm font-normal">of {totalQuestions}</span>
                </span>
              </div>

              <div
                className={`px-3 h-8 rounded-lg font-mono tabular-nums font-medium text-xs flex items-center gap-1.5 border ${
                  secondsLeft <= 300
                    ? 'bg-[#fdf2f2] text-[#dc2626] border-[#dc2626]'
                    : secondsLeft <= 900
                    ? 'bg-[#efe9df] text-[#b8622e] border-[#b8622e]'
                    : 'bg-[#fdfbf7] text-[#1f1b16] border-[#dcd5c4]'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                <span>{formatCountdown(secondsLeft)}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-[#7b7266]">
                  Candidate: <strong className="text-[#1f1b16] font-medium">{studentName}</strong>
                </span>
                <button
                  type="button"
                  onClick={onReview}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] border border-[#dcd5c4] text-[#1f1b16] text-xs font-medium transition-calm tabular-nums"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#5e554a]" strokeWidth={1.5} />
                  <span>Review ({Object.keys(answers).filter(k => answers[k] !== null && answers[k] !== undefined && answers[k] !== '').length}/{totalQuestions})</span>
                </button>
              </div>
            </div>

            {/* Question Paper Sheet */}
            <div className="exam-paper rounded-xl p-6 sm:p-8 space-y-6">
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

              {/* Question Stem with Left Margin Q# */}
              <div className="flex items-start gap-4">
                <span className="font-serif font-medium text-xl text-[#1f1b16] tabular-nums shrink-0 pt-0.5">
                  Q{currentIndex + 1}.
                </span>
                <div className="flex-1 space-y-3">
                  <div className="font-serif text-lg sm:text-xl text-[#1f1b16] leading-relaxed">
                    <MathRenderer text={questionText} readOnly={true} />
                  </div>
                  <DiagramBlock diagrams={question.diagrams} diagramImages={question.diagramImages} />
                </div>
              </div>

              {/* MCQ / Match the Following Options */}
              {(type === 'mcq' || type === 'match_following') && (
                <div className="space-y-3 pt-2 pl-0 sm:pl-10">
                  <span className="text-xs font-medium text-[#5e554a] block">
                    Select one option
                  </span>

                  <div
                    className={
                      isLongOptions
                        ? 'space-y-2.5'
                        : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
                    }
                  >
                    {(options || []).map((opt, optIdx) => {
                      const isSelected = currentAnswer === optIdx;
                      const letter = optionLetters[optIdx] || (optIdx + 1).toString();

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => {
                            onAnswerChange(id, optIdx);
                            onUpdateQuestionStatus(id, 'answered');
                          }}
                          disabled={cheatingFlagged}
                          className={`w-full text-left flex items-start gap-3 p-3.5 rounded-lg border transition-calm active:scale-[0.99] ${
                            isSelected
                              ? 'bg-[#1f1b16] text-[#fdfbf7] border-[#1f1b16]'
                              : 'bg-[#f7f4ee] text-[#1f1b16] border-[#dcd5c4] hover:bg-[#efe9df]'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center font-mono font-medium text-xs shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-[#fdfbf7] text-[#1f1b16]'
                                : 'bg-[#fdfbf7] border border-[#dcd5c4] text-[#5e554a]'
                            }`}
                          >
                            {letter}
                          </span>
                          <div className="flex-1 min-w-0 pt-0.5 font-serif text-base leading-snug">
                            <MathRenderer text={opt} readOnly={true} />
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#fdfbf7] shrink-0 mt-1" strokeWidth={1.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Numerical Answer Input */}
              {type === 'short_answer_numeric' && (
                <div className="space-y-2 pt-2 pl-0 sm:pl-10">
                  <label className="block text-xs font-medium text-[#5e554a]">
                    Numerical answer
                  </label>
                  <input
                    type="text"
                    value={currentAnswer !== undefined && currentAnswer !== null ? currentAnswer : ''}
                    onChange={(e) => {
                      onAnswerChange(id, e.target.value);
                      onUpdateQuestionStatus(id, e.target.value ? 'answered' : 'not_answered');
                    }}
                    disabled={cheatingFlagged}
                    placeholder="Enter integer or decimal value"
                    className="w-full max-w-sm px-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono tabular-nums text-base text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  />
                </div>
              )}

              {type !== 'mcq' && type !== 'match_following' && type !== 'short_answer_numeric' && (
                <div className="p-4 rounded-lg bg-[#f7f4ee] border border-[#b8622e] text-[#1f1b16] text-xs space-y-1">
                  <div className="font-medium flex items-center gap-1.5 text-[#b8622e]">
                    <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>Pending question classification</span>
                  </div>
                  <p className="text-[#5e554a]">
                    This item requires classification by the instructor in the question catalogue.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4-Button Control Action Bar (Warm Paper palette, no purple/rainbow buttons) */}
          <div className="space-y-3 pt-4 border-t border-[#dcd5c4]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleSaveAndNext}
                disabled={cheatingFlagged}
                className="px-3 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Save and next</span>
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                disabled={cheatingFlagged || !hasAnswer}
                className="px-3 h-9 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] hover:bg-[#efe9df] disabled:opacity-40 text-[#1f1b16] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                <span>Clear response</span>
              </button>

              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                disabled={cheatingFlagged}
                className="px-3 h-9 rounded-lg bg-[#efe9df] border border-[#dcd5c4] hover:bg-[#e5dec9] text-[#1f1b16] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                <span>Mark and next</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                disabled={cheatingFlagged}
                className="px-3 h-9 rounded-lg bg-[#efe9df] border border-[#8c4a17] hover:bg-[#e5dec9] text-[#8c4a17] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Save and mark</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onPrevious}
                disabled={currentIndex === 0}
                className="px-3.5 h-8 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] hover:bg-[#efe9df] disabled:opacity-40 text-[#1f1b16] font-sans font-medium text-xs transition-calm flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={isLastQuestion}
                className="px-3.5 h-8 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] hover:bg-[#efe9df] disabled:opacity-40 text-[#1f1b16] font-sans font-medium text-xs transition-calm flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette Sidebar */}
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
