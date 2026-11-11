import React, { useState, useEffect } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import ResultPrintModal from './ResultPrintModal';
import { gradeAttempt } from '../../services/gradingService';
import { submitStudentTest } from '../../services/apiService';
import { CheckCircle2, XCircle, Clock, RotateCcw, Home, Printer, ShieldAlert, AlertTriangle, BookOpen } from 'lucide-react';

export default function TestResultScreen({
  questions,
  studentAnswers,
  studentName,
  studentId,
  isDevDemo,
  testTitle,
  examId,
  rollingCodeUsed,
  onRestartTest,
  onExitStudentMode,
  cheatingFlagged = false,
  cheatingReason = ''
}) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('submitting');
  const [submissionError, setSubmissionError] = useState('');
  const [serverSubmission, setServerSubmission] = useState(null);

  const localFallbackResult = gradeAttempt(questions, studentAnswers);
  const effectiveQuestions = Array.isArray(serverSubmission?.questions) && serverSubmission.questions.length > 0
    ? serverSubmission.questions
    : questions;

  let autoGraded = serverSubmission?.autoGraded || localFallbackResult.autoGraded;
  const perQuestion = Array.isArray(serverSubmission?.perQuestion)
    ? serverSubmission.perQuestion
    : localFallbackResult.perQuestion;
  const pendingReviewCount = typeof serverSubmission?.pendingCount === 'number'
    ? serverSubmission.pendingCount
    : localFallbackResult.pendingReview.length;

  if (cheatingFlagged) {
    autoGraded = { score: 0, total: effectiveQuestions.length, percentage: 0 };
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const isDevEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  const isLocalSamplePaper = (!examId || examId === 'exam_default' || !rollingCodeUsed);
  const isProdDemoPreview = Boolean(isDevDemo) && !isDevEnv;
  const isLocalPracticeRun = isLocalSamplePaper || isProdDemoPreview;

  useEffect(() => {
    let isMounted = true;
    async function doSubmit() {
      if (isLocalPracticeRun) {
        if (isMounted) {
          setSubmissionStatus('demo_local');
          setSubmissionError('');
        }
        return;
      }

      const payload = {
        examId: examId || 'exam_default',
        rollingCodeUsed: rollingCodeUsed || '',
        testTitle: testTitle || 'Mathematics Practice Test',
        studentName: studentName || 'Candidate',
        studentId: studentId || null,
        isDevDemo: Boolean(isDevDemo),
        questions,
        studentAnswers,
        cheatingFlagged,
        cheatingReason
      };
      const res = await submitStudentTest(payload);
      if (isMounted) {
        if (res && res.success) {
          if (res.submission) {
            setServerSubmission(res.submission);
          }
          setSubmissionStatus('submitted');
          setSubmissionError('');
        } else {
          setSubmissionStatus('failed');
          setSubmissionError(res?.error || 'Could not record submission on the server.');
        }
      }
    }
    doSubmit();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f1b16] py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl w-full mx-auto space-y-6 print:hidden">
        {/* Top Summary Card */}
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-6 sm:p-8 space-y-4">
          {cheatingFlagged && (
            <div className="p-4 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] space-y-1">
              <div className="font-medium flex items-center gap-2 text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>Session disqualified due to focus violation</span>
              </div>
              <p className="text-xs text-[#5e554a]">
                {cheatingReason || 'Window focus lost during active examination.'}
              </p>
            </div>
          )}

          {submissionStatus === 'demo_local' && (
            <div className="p-3.5 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] text-[#5e554a] space-y-1">
              <div className="font-medium flex items-center gap-2 text-xs text-[#1f1b16]">
                <BookOpen className="w-4 h-4 text-[#8c4a17] shrink-0" strokeWidth={1.5} />
                <span>Sample practice mode</span>
              </div>
              <p className="text-xs text-[#5e554a]">
                {isProdDemoPreview
                  ? 'Local preview mode — scorecard computed locally. Sign in with your permanent Roll Number and join with a 6-digit passcode to store an official grade.'
                  : 'Local preview mode — scorecard computed locally and not stored as an official grade.'}
              </p>
            </div>
          )}

          {submissionStatus === 'failed' && (
            <div className="p-4 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] space-y-1">
              <div className="font-medium flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>Submission failed to save</span>
              </div>
              <p className="text-xs text-[#5e554a]">
                {submissionError}
              </p>
            </div>
          )}

          <div className="exam-rule-double pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-[#8c4a17] block">
                {submissionStatus === 'demo_local' ? 'Practice preview scorecard' : 'Official evaluation scorecard'}
              </span>
              <h1 className="font-serif font-medium text-2xl text-[#1f1b16]">
                {serverSubmission?.testTitle || testTitle || 'Mathematics Assessment'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#5e554a] bg-[#efe9df] px-2.5 py-1 rounded-md">
                Candidate: <strong className="text-[#1f1b16] font-medium">{studentName}</strong>
              </span>

              {submissionStatus === 'submitted' && (
                <span className="text-xs font-medium bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Recorded</span>
                </span>
              )}
              {submissionStatus === 'demo_local' && (
                <span className="text-xs font-medium bg-[#efe9df] border border-[#dcd5c4] text-[#5e554a] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                  <span>Sample practice mode</span>
                </span>
              )}
              {submissionStatus === 'submitting' && (
                <span className="text-xs font-medium bg-[#efe9df] border border-[#dcd5c4] text-[#5e554a] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  <span>Saving</span>
                </span>
              )}
              {submissionStatus === 'failed' && (
                <span className="text-xs font-medium bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Not saved</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm"
              >
                <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Print report</span>
              </button>
            </div>
          </div>

          {autoGraded.total > 0 ? (
            <div className="flex flex-wrap items-baseline gap-3 pt-1 font-mono tabular-nums">
              <div className="font-medium text-3xl text-[#1f1b16]">
                {autoGraded.score} <span className="text-lg text-[#7b7266] font-normal">/ {autoGraded.total}</span>
              </div>
              <div className="text-xs font-sans font-medium text-[#5e554a]">
                Auto-graded score ({autoGraded.percentage}%)
              </div>
            </div>
          ) : (
            <div className="pt-2 font-serif text-base text-[#5e554a]">
              Responses recorded and routed for instructor evaluation
            </div>
          )}

          {pendingReviewCount > 0 && (
            <div className="p-3 rounded-lg bg-[#f7f4ee] border border-[#b8622e] text-[#1f1b16] text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#b8622e] shrink-0" strokeWidth={1.5} />
              <span>
                <strong className="font-mono tabular-nums">{pendingReviewCount}</strong> {pendingReviewCount === 1 ? 'question' : 'questions'} routed for instructor review
              </span>
            </div>
          )}
        </div>

        {/* Itemized Response Breakdown */}
        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl divide-y divide-[#dcd5c4] overflow-hidden">
          {effectiveQuestions.map((q, idx) => {
            const item = perQuestion[idx] || {};
            const studentAns = studentAnswers[q.id];
            const correctAns = q.correctAnswer !== undefined ? q.correctAnswer : item.correctAnswer;
            const acceptedRange = q.acceptedRange !== undefined ? q.acceptedRange : item.acceptedRange;

            let formattedStudentAns = 'No response provided';
            if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
              if ((q.type === 'mcq' || q.type === 'match_following') && typeof studentAns === 'number') {
                const letter = optionLetters[studentAns] || studentAns;
                formattedStudentAns = `Option ${letter}`;
              } else {
                formattedStudentAns = `${studentAns}`;
              }
            }

            let revealedCorrectAns = null;
            if ((q.type === 'mcq' || q.type === 'match_following') && typeof correctAns === 'number') {
              const correctLetter = optionLetters[correctAns] || correctAns;
              revealedCorrectAns = `Option ${correctLetter}`;
            } else if (q.type === 'short_answer_numeric') {
              if (Array.isArray(acceptedRange)) {
                revealedCorrectAns = `${correctAns ?? acceptedRange[0]} (accepted: ${acceptedRange[0]} to ${acceptedRange[1]})`;
              } else if (correctAns !== null && correctAns !== undefined) {
                revealedCorrectAns = `${correctAns}`;
              }
            }

            return (
              <div key={q.id || idx} className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efe9df] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-serif font-medium text-base text-[#1f1b16] tabular-nums">
                      Q{idx + 1}.
                    </span>
                    <span className="text-xs text-[#7b7266]">
                      {q.type === 'mcq' ? 'Multiple choice' : q.type === 'short_answer_numeric' ? 'Numerical value' : 'Match the following'}
                    </span>
                  </div>

                  {item.status === 'correct' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] text-xs font-mono tabular-nums font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Correct (+1)</span>
                    </span>
                  )}
                  {item.status === 'incorrect' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs font-mono tabular-nums font-medium flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Incorrect (0)</span>
                    </span>
                  )}
                  {item.status === 'pending_review' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#efe9df] border border-[#b8622e] text-[#b8622e] text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Pending review</span>
                    </span>
                  )}
                </div>

                <div className="font-serif text-lg text-[#1f1b16] leading-relaxed">
                  <MathRenderer text={q.questionText} readOnly={true} />
                  <DiagramBlock diagrams={q.diagrams} diagramImages={q.diagramImages} />
                </div>

                {(q.type === 'mcq' || q.type === 'match_following') && q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const letter = optionLetters[optIdx] || optIdx + 1;
                      const isCandidateChoice = studentAns === optIdx;
                      const isCorrectKey = correctAns === optIdx;

                      let badgeText = null;
                      let badgeStyle = '';

                      if (isCandidateChoice && isCorrectKey) {
                        badgeText = 'Selected • Key';
                        badgeStyle = 'bg-[#f4f8f5] border-[#3f6b4a] text-[#3f6b4a] font-medium';
                      } else if (isCandidateChoice) {
                        badgeText = 'Selected';
                        badgeStyle = 'bg-[#fdf2f2] border-[#dc2626] text-[#dc2626] font-medium';
                      } else if (isCorrectKey && item.status !== 'pending_review') {
                        badgeText = 'Key';
                        badgeStyle = 'bg-[#f4f8f5] border-[#3f6b4a] text-[#3f6b4a] font-medium';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border text-xs ${
                            isCandidateChoice
                              ? isCorrectKey
                                ? 'bg-[#f4f8f5] border-[#3f6b4a]'
                                : 'bg-[#fdf2f2] border-[#dc2626]'
                              : isCorrectKey && item.status !== 'pending_review'
                              ? 'bg-[#f4f8f5] border-[#3f6b4a]'
                              : 'bg-[#f7f4ee] border-[#dcd5c4]'
                          }`}
                        >
                          <div className="flex items-start gap-2 font-serif text-sm text-[#1f1b16] overflow-x-auto">
                            <span className="font-mono text-xs text-[#5e554a] shrink-0 mt-0.5">
                              ({letter})
                            </span>
                            <div>
                              <MathRenderer text={opt} readOnly={true} />
                            </div>
                          </div>

                          {badgeText && (
                            <span className={`px-2 py-0.5 rounded text-[11px] shrink-0 border ${badgeStyle}`}>
                              {badgeText}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type !== 'mcq' && q.type !== 'match_following' && (
                  <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3.5 text-xs font-mono tabular-nums space-y-1.5">
                    <div>
                      <span className="font-sans text-[#5e554a]">Your response: </span>
                      <strong className="text-[#1f1b16]">{formattedStudentAns}</strong>
                    </div>

                    {revealedCorrectAns && item.status !== 'pending_review' && (
                      <div className="pt-1.5 border-t border-[#dcd5c4]">
                        <span className="font-sans text-[#3f6b4a]">Answer key: </span>
                        <strong className="text-[#1f1b16]">{revealedCorrectAns}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onRestartTest}
            className="w-full sm:w-auto px-4 h-10 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] hover:bg-[#efe9df] text-[#1f1b16] font-sans font-medium text-xs transition-calm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            <span>Return to student portal</span>
          </button>

          <button
            type="button"
            onClick={onExitStudentMode}
            className="w-full sm:w-auto px-5 h-10 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to teacher studio</span>
          </button>
        </div>
      </div>

      {showPrintModal && (
        <ResultPrintModal
          testTitle={serverSubmission?.testTitle || testTitle}
          studentName={studentName}
          questions={effectiveQuestions}
          studentAnswers={studentAnswers}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
