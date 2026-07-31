import React, { useState } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import ResultPrintModal from './ResultPrintModal';
import { gradeAttempt } from '../../services/gradingService';
import { CheckCircle2, XCircle, Clock, RotateCcw, Home, Printer } from 'lucide-react';

export default function TestResultScreen({
  questions,
  studentAnswers,
  studentName,
  testTitle,
  onRestartTest,
  onExitStudentMode
}) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const result = gradeAttempt(questions, studentAnswers);
  const { autoGraded, pendingReview, perQuestion } = result;

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-10 px-4 sm:px-6">
      <div className="max-w-3xl w-full mx-auto space-y-8 print:hidden">
        
        {/* Top Summary Card (Exam Native Tone) */}
        <div className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-[#DCD5C4] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8c4a17] block">
                Official Examination Summary
              </span>
              <h1 className="font-serif font-bold text-2xl text-[#232323]">
                Test Evaluation Results
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans text-[#5c5346] bg-[#f0e6d8] px-3.5 py-1.5 rounded-full font-medium">
                Candidate: <strong className="text-[#232323]">{studentName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-sans font-semibold shadow-xs transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Result Report</span>
              </button>
            </div>
          </div>

          {/* Score Header */}
          {autoGraded.total > 0 ? (
            <div className="flex flex-wrap items-baseline gap-4 pt-2">
              <div className="font-serif font-bold text-3xl sm:text-4xl text-[#232323]">
                {autoGraded.score} <span className="text-xl text-[#736c62] font-normal">/ {autoGraded.total}</span>
              </div>
              <div className="text-sm font-sans font-semibold text-[#5c5346]">
                Auto-graded Score ({autoGraded.percentage}%)
              </div>
            </div>
          ) : (
            <div className="pt-2 font-serif text-lg text-[#5c5346] italic">
              All responses submitted and flagged for teacher evaluation.
            </div>
          )}

          {/* Pending Review Tally Banner */}
          {pendingReview.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>{pendingReview.length} {pendingReview.length === 1 ? 'question' : 'questions'}</strong> routed for teacher review (short answer / unclassified type).
              </span>
            </div>
          )}
        </div>

        {/* Question-by-Question Detailed Breakdown */}
        <div className="space-y-5">
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
                className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-2xl p-6 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[#f0e6d8] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#232323] text-white flex items-center justify-center font-serif font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-sans font-medium text-[#736c62] uppercase tracking-wider">
                      {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'short_answer_numeric' ? 'Numeric Short Answer' : 'Text Short Answer'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {item.status === 'correct' && (
                    <span className="px-3 py-1 rounded-full bg-[#f4f9f4] border border-[#81c784] text-[#2e7d32] text-xs font-sans font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                      <span>Correct (+1)</span>
                    </span>
                  )}
                  {item.status === 'incorrect' && (
                    <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-sans font-semibold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Incorrect (0)</span>
                    </span>
                  )}
                  {item.status === 'pending_review' && (
                    <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-sans font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Pending Teacher Review</span>
                    </span>
                  )}
                </div>

                {/* Question Stem */}
                <div className="font-serif text-lg text-[#232323] leading-relaxed">
                  <MathRenderer text={q.questionText} readOnly={true} />
                </div>

                {/* Answer Summary Box */}
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
