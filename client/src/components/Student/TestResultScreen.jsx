import React, { useState, useEffect } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import ResultPrintModal from './ResultPrintModal';
import { gradeAttempt } from '../../services/gradingService';
import { submitStudentTest } from '../../services/apiService';
import { CheckCircle2, XCircle, Clock, RotateCcw, Home, Printer, Send } from 'lucide-react';

export default function TestResultScreen({
  questions,
  studentAnswers,
  studentName,
  testTitle,
  examId,
  rollingCodeUsed,
  onRestartTest,
  onExitStudentMode,
  cheatingFlagged = false,
  cheatingReason = ''
}) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('submitting'); // 'submitting' | 'submitted' | 'offline'

  const result = gradeAttempt(questions, studentAnswers);
  let { autoGraded, pendingReview, perQuestion } = result;

  if (cheatingFlagged) {
    autoGraded = { score: 0, total: questions.length, percentage: 0 };
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  useEffect(() => {
    let isMounted = true;
    async function doSubmit() {
      const payload = {
        examId: examId || 'exam_default',
        rollingCodeUsed: rollingCodeUsed || '',
        testTitle: testTitle || 'Mathematics Practice Test',
        studentName: studentName || 'Candidate',
        autoGraded,
        pendingCount: pendingReview.length,
        questions,
        studentAnswers,
        cheatingFlagged,
        cheatingReason
      };
      const res = await submitStudentTest(payload);
      if (isMounted) {
        if (res && res.success) {
          setSubmissionStatus('submitted');
        } else {
          setSubmissionStatus('offline');
        }
      }
    }
    doSubmit();
    return () => { isMounted = false; };
  }, []);


  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-10 px-4 sm:px-6">
      <div className="max-w-3xl w-full mx-auto space-y-8 print:hidden">
        
        {/* Top Summary Card (Exam Native Tone) */}
        <div className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm space-y-4">
          {cheatingFlagged && (
            <div className="p-4 rounded-2xl bg-red-600 text-white font-sans space-y-1 shadow-md">
              <div className="font-bold flex items-center gap-2 text-base">
                <span>🛡️ SESSION DISQUALIFIED & FLAGGED FOR MALPRACTICE</span>
              </div>
              <p className="text-xs text-red-100">
                Reason: {cheatingReason || 'Excessive tab switching or window inactivity detected during examination.'}
              </p>
            </div>
          )}
          <div className="border-b border-[#DCD5C4] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8c4a17] block">
                Official Examination Summary
              </span>
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-[#232323]">
                Test Evaluation Results
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans text-[#5c5346] bg-[#f0e6d8] px-3 py-1 rounded-full font-medium">
                Candidate: <strong className="text-[#232323]">{studentName}</strong>
              </span>

              {/* Submission Status Badge */}
              {submissionStatus === 'submitted' && (
                <span className="text-xs font-sans font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Submitted to Teacher</span>
                </span>
              )}
              {submissionStatus === 'submitting' && (
                <span className="text-xs font-sans font-medium bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                  <span>Saving...</span>
                </span>
              )}
              {submissionStatus === 'offline' && (
                <span className="text-xs font-sans text-gray-700 bg-gray-100 border border-gray-300 px-3 py-1 rounded-full">
                  Saved Locally
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-sans font-semibold shadow-xs transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Result</span>
              </button>
            </div>
          </div>

          {/* Score Header */}
          {autoGraded.total > 0 ? (
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 pt-1">
              <div className="font-serif font-bold text-2xl sm:text-4xl text-[#232323]">
                {autoGraded.score} <span className="text-lg sm:text-xl text-[#736c62] font-normal">/ {autoGraded.total}</span>
              </div>
              <div className="text-xs sm:text-sm font-sans font-semibold text-[#5c5346]">
                Auto-graded Score ({autoGraded.percentage}%)
              </div>
            </div>
          ) : (
            <div className="pt-2 font-serif text-base sm:text-lg text-[#5c5346] italic">
              All responses submitted and flagged for teacher evaluation.
            </div>
          )}

          {/* Pending Review Tally Banner */}
          {pendingReview.length > 0 && (
            <div className="p-3.5 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>{pendingReview.length} {pendingReview.length === 1 ? 'question' : 'questions'}</strong> routed for teacher review (short answer / unclassified type).
              </span>
            </div>
          )}
        </div>

        {/* Question-by-Question Detailed Breakdown */}
        <div className="space-y-4 sm:space-y-5">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#5c5346]">
            Itemized Response Breakdown
          </h3>

          {questions.map((q, idx) => {
            const item = perQuestion[idx] || {};
            const studentAns = studentAnswers[q.id];
            
            // Format Student Answer
            let formattedStudentAns = 'No response provided';
            if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
              if (q.type === 'mcq' && typeof studentAns === 'number') {
                const letter = optionLetters[studentAns] || studentAns;
                formattedStudentAns = `Option ${letter}`;
              } else {
                formattedStudentAns = `"${studentAns}"`;
              }
            }

            // Format Revealed Correct Answer
            let revealedCorrectAns = null;
            if (q.type === 'mcq' && typeof q.correctAnswer === 'number') {
              const correctLetter = optionLetters[q.correctAnswer] || q.correctAnswer;
              revealedCorrectAns = `Option ${correctLetter}`;
            } else if (q.type === 'short_answer_numeric') {
              if (Array.isArray(q.acceptedRange)) {
                revealedCorrectAns = `Center: ${q.correctAnswer} (Accepted Range: ${q.acceptedRange[0]} to ${q.acceptedRange[1]})`;
              } else if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
                revealedCorrectAns = `${q.correctAnswer}`;
              }
            } else if (q.correctAnswer !== null && q.correctAnswer !== undefined && q.correctAnswer !== '') {
              revealedCorrectAns = `"${q.correctAnswer}"`;
            }

            return (
              <div
                key={q.id || idx}
                className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-2xl p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0e6d8] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#232323] text-white flex items-center justify-center font-serif font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-sans font-medium text-[#736c62] uppercase tracking-wider">
                      {q.type === 'mcq' ? 'MCQ' : q.type === 'short_answer_numeric' ? 'Numeric Short Answer' : 'Text Short Answer'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {item.status === 'correct' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f4f9f4] border border-[#81c784] text-[#2e7d32] text-xs font-sans font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                      <span>Correct (+1)</span>
                    </span>
                  )}
                  {item.status === 'incorrect' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-sans font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Incorrect (0)</span>
                    </span>
                  )}
                  {item.status === 'pending_review' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-sans font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Pending Teacher Review</span>
                    </span>
                  )}
                </div>

                {/* Question Stem */}
                <div className="font-serif text-lg text-[#232323] leading-relaxed">
                  <MathRenderer text={q.questionText} readOnly={true} />
                  <DiagramBlock diagrams={q.diagrams} diagramImages={q.diagramImages} />
                </div>

                {/* MCQ Options with Visual Badges */}
                {q.type === 'mcq' && q.options && q.options.length > 0 && (
                  <div className="space-y-2 pt-1 font-serif text-sm">
                    <span className="text-[11px] font-sans font-semibold text-[#736c62] uppercase tracking-wider block">
                      Options:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const letter = optionLetters[optIdx] || optIdx + 1;
                        const isCandidateChoice = studentAns === optIdx;
                        const isCorrectKey = q.correctAnswer === optIdx;

                        let badgeText = null;
                        let badgeStyle = '';

                        if (isCandidateChoice && isCorrectKey) {
                          badgeText = 'Your Choice • Correct Key';
                          badgeStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                        } else if (isCandidateChoice) {
                          badgeText = 'Your Choice';
                          badgeStyle = 'bg-red-100 border-red-300 text-red-800 font-bold';
                        } else if (isCorrectKey && item.status !== 'pending_review') {
                          badgeText = 'Correct Key';
                          badgeStyle = 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-start justify-between gap-3 p-2.5 rounded-xl border text-xs font-sans ${
                              isCandidateChoice
                                ? isCorrectKey
                                  ? 'bg-emerald-50/70 border-emerald-300'
                                  : 'bg-red-50/70 border-red-200'
                                : isCorrectKey && item.status !== 'pending_review'
                                ? 'bg-[#f4f9f4] border-[#a5d6a7]'
                                : 'bg-[#faf7f2] border-[#e2d8ca]'
                            }`}
                          >
                            <div className="flex items-start gap-2 font-serif text-sm text-[#1c1b18] overflow-x-auto max-w-full">
                              <span className="font-bold font-sans text-xs text-gray-700 shrink-0 mt-0.5">
                                ({letter})
                              </span>
                              <div>
                                <MathRenderer text={opt} readOnly={true} />
                              </div>
                            </div>

                            {badgeText && (
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] shrink-0 border ${badgeStyle}`}>
                                {badgeText}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Answer Summary Box (For numerical & short answer questions without option badges) */}
                {q.type !== 'mcq' && (
                  <div className="bg-[#FAF7F0] border border-[#e8ded0] rounded-xl p-4 text-xs font-sans space-y-2">
                    <div>
                      <span className="text-[#736c62] font-medium">Your Response: </span>
                      <strong className="text-[#232323]">{formattedStudentAns}</strong>
                    </div>

                    {revealedCorrectAns && item.status !== 'pending_review' && (
                      <div className="pt-1 border-t border-[#e8ded0]">
                        <span className="text-[#3f6b4a] font-medium">Correct Answer Key: </span>
                        <strong className="text-[#232323]">{revealedCorrectAns}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#DCD5C4]">
          <button
            type="button"
            onClick={onRestartTest}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#232323] font-serif font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Assessment</span>
          </button>

          <button
            type="button"
            onClick={onExitStudentMode}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Exit Portal</span>
          </button>
        </div>

      </div>

      {/* Printable Result Modal */}
      {showPrintModal && (
        <ResultPrintModal
          testTitle={testTitle}
          studentName={studentName}
          questions={questions}
          studentAnswers={studentAnswers}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
