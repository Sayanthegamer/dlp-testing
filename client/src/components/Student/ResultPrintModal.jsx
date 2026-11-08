import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import { gradeAttempt } from '../../services/gradingService';
import { Printer, X, FileText, AlignLeft } from 'lucide-react';

export default function ResultPrintModal({ testTitle, studentName, questions, studentAnswers, onClose }) {
  const [printStyle, setPrintStyle] = useState('short'); // 'short' | 'long'

  const { autoGraded, pendingReview, perQuestion } = gradeAttempt(questions, studentAnswers);
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-[#161513]/60 overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div className="print-modal-container bg-[#fdfbf7] border-0 sm:border border-[#dcd5c4] rounded-none sm:rounded-2xl max-w-4xl w-full h-dvh sm:h-auto sm:max-h-[90vh] flex flex-col shadow-xl overflow-hidden font-sans print:bg-white print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible relative">
        {/* Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[#dcd5c4] bg-[#efe9df] print:hidden gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Printer className="w-4 h-4 text-[#5e554a] shrink-0" strokeWidth={1.5} />
            <h3 className="font-serif font-medium text-base text-[#1f1b16] truncate">
              Printable scorecard report
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-[#fdfbf7] p-1 rounded-lg border border-[#dcd5c4] text-xs shrink-0">
            <button
              type="button"
              onClick={() => setPrintStyle('short')}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md font-medium transition-calm ${
                printStyle === 'short'
                  ? 'bg-[#1f1b16] text-[#fdfbf7]'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Summary table</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintStyle('long')}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md font-medium transition-calm ${
                printStyle === 'long'
                  ? 'bg-[#1f1b16] text-[#fdfbf7]'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Itemized script</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
              <span>Print report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 h-9 w-9 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] text-[#5e554a] hover:text-[#1f1b16] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div id="printable-result-paper" className="p-8 sm:p-12 overflow-y-auto font-serif text-[#1f1b16] bg-white space-y-6 print:p-0 print:overflow-visible">
          <div className="exam-rule-double pb-4 space-y-2">
            <div className="flex justify-between items-baseline font-sans text-xs text-[#5e554a]">
              <span>Student examination report</span>
              <span className="font-mono tabular-nums">{formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#1f1b16]">
              {testTitle || 'Mathematics Examination Paper'}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs font-sans border-t border-[#dcd5c4] mt-3">
              <div>
                <span className="text-[#7b7266] block">Candidate</span>
                <strong className="text-[#1f1b16] text-sm font-medium">{studentName || 'Candidate'}</strong>
              </div>
              <div>
                <span className="text-[#7b7266] block">Questions</span>
                <strong className="text-[#1f1b16] text-sm font-mono tabular-nums font-medium">{questions.length}</strong>
              </div>
              <div>
                <span className="text-[#7b7266] block">Score</span>
                <strong className="text-[#1f1b16] text-sm font-mono tabular-nums font-medium">
                  {autoGraded.total > 0 ? `${autoGraded.score} / ${autoGraded.total} (${autoGraded.percentage}%)` : 'Pending'}
                </strong>
              </div>
              <div>
                <span className="text-[#7b7266] block">Pending review</span>
                <strong className="text-[#1f1b16] text-sm font-mono tabular-nums font-medium">{pendingReview.length}</strong>
              </div>
            </div>
          </div>

          {printStyle === 'short' && (
            <div className="space-y-3 pt-2">
              <h2 className="font-sans font-medium text-xs text-[#5e554a]">
                Response summary scorecard
              </h2>
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1f1b16] bg-[#f7f4ee]">
                    <th className="py-2.5 px-3 font-medium text-[#1f1b16]">Item</th>
                    <th className="py-2.5 px-3 font-medium text-[#1f1b16]">Type</th>
                    <th className="py-2.5 px-3 font-medium text-[#1f1b16]">Candidate response</th>
                    <th className="py-2.5 px-3 font-medium text-[#1f1b16]">Answer key</th>
                    <th className="py-2.5 px-3 font-medium text-[#1f1b16] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dcd5c4] font-mono tabular-nums">
                  {questions.map((q, idx) => {
                    const item = perQuestion[idx] || {};
                    const studentAns = studentAnswers[q.id];

                    let formattedStudentAns = '—';
                    if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                      if ((q.type === 'mcq' || q.type === 'match_following') && typeof studentAns === 'number') {
                        formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                      } else {
                        formattedStudentAns = `${studentAns}`;
                      }
                    }

                    let revealedCorrectAns = '—';
                    if ((q.type === 'mcq' || q.type === 'match_following') && typeof q.correctAnswer === 'number') {
                      revealedCorrectAns = `Option ${optionLetters[q.correctAnswer] || q.correctAnswer}`;
                    } else if (q.type === 'short_answer_numeric') {
                      if (Array.isArray(q.acceptedRange)) {
                        revealedCorrectAns = `${q.correctAnswer} [${q.acceptedRange[0]}–${q.acceptedRange[1]}]`;
                      } else if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
                        revealedCorrectAns = `${q.correctAnswer}`;
                      }
                    }

                    return (
                      <tr key={q.id || idx} className="page-break-inside-avoid">
                        <td className="py-2 px-3 font-serif font-medium">Q{idx + 1}.</td>
                        <td className="py-2 px-3 font-sans text-[#5e554a]">
                          {q.type === 'mcq' ? 'MCQ' : q.type === 'short_answer_numeric' ? 'Numerical' : 'Match'}
                        </td>
                        <td className="py-2 px-3 text-[#1f1b16]">{formattedStudentAns}</td>
                        <td className="py-2 px-3 text-[#5e554a]">{item.status !== 'pending_review' ? revealedCorrectAns : 'Instructor review'}</td>
                        <td className="py-2 px-3 text-right font-medium">
                          {item.status === 'correct' && <span className="text-[#3f6b4a]">+1</span>}
                          {item.status === 'incorrect' && <span className="text-[#dc2626]">0</span>}
                          {item.status === 'pending_review' && <span className="text-[#b8622e]">Pending</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {printStyle === 'long' && (
            <div className="space-y-4 pt-2">
              <h2 className="font-sans font-medium text-xs text-[#5e554a]">
                Itemized evaluation script
              </h2>
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const item = perQuestion[idx] || {};
                  const studentAns = studentAnswers[q.id];

                  let formattedStudentAns = 'No response provided';
                  if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                    if ((q.type === 'mcq' || q.type === 'match_following') && typeof studentAns === 'number') {
                      formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                    } else {
                      formattedStudentAns = `${studentAns}`;
                    }
                  }

                  return (
                    <div key={q.id || idx} className="border border-[#dcd5c4] rounded-lg p-4 space-y-2.5 page-break-inside-avoid">
                      <div className="flex items-center justify-between font-sans text-xs border-b border-[#efe9df] pb-2">
                        <span className="font-serif font-medium text-sm text-[#1f1b16] tabular-nums">Q{idx + 1}.</span>
                        <span className="font-mono tabular-nums font-medium">
                          {item.status === 'correct' && <span className="text-[#3f6b4a]">Correct (+1)</span>}
                          {item.status === 'incorrect' && <span className="text-[#dc2626]">Incorrect (0)</span>}
                          {item.status === 'pending_review' && <span className="text-[#b8622e]">Pending review</span>}
                        </span>
                      </div>

                      <div className="font-serif text-base text-[#1f1b16]">
                        <MathRenderer text={q.questionText} readOnly={true} />
                        <DiagramBlock diagrams={q.diagrams} diagramImages={q.diagramImages} />
                      </div>

                      <div className="bg-[#f7f4ee] p-2.5 rounded font-mono tabular-nums text-xs text-[#5e554a]">
                        Candidate response: <strong className="text-[#1f1b16]">{formattedStudentAns}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-[#dcd5c4] text-center font-sans text-xs text-[#7b7266]">
            End of student evaluation report
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
