import React, { useState } from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
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

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div className="print-modal-container bg-[#fbf9f5] border border-[#dcd2c4] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto print:bg-white print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible">
        
        {/* Modal Header Bar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-[#e2d8ca] bg-[#f5efe4] print:hidden gap-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#8c4a17]" />
            <h3 className="font-serif font-bold text-base text-[#1c1b18]">
              Print Examination Result Report
            </h3>
          </div>

          {/* Style Selector Buttons */}
          <div className="flex items-center gap-2 font-sans text-xs">
            <button
              type="button"
              onClick={() => setPrintStyle('short')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                printStyle === 'short'
                  ? 'bg-[#2c2825] text-white shadow-xs'
                  : 'bg-[#e5dcd0] text-[#4a443b] hover:bg-[#d8ccbc]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Short Style (Summary)</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintStyle('long')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                printStyle === 'long'
                  ? 'bg-[#2c2825] text-[#FAF7F0] shadow-xs'
                  : 'bg-[#e5dcd0] text-[#4a443b] hover:bg-[#d8ccbc]'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Long Style (Detailed)</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#786f63] hover:bg-[#e8decb] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Result Document Content */}
        <div id="printable-result-paper" className="p-8 sm:p-12 overflow-y-auto font-serif text-[#1c1b18] bg-white space-y-6 print:p-0 print:overflow-visible">
          
          {/* Paper Header */}
          <div className="border-b-2 border-[#1c1b18] pb-4 space-y-2">
            <div className="flex justify-between items-baseline font-sans text-xs text-[#5c5346]">
              <span>Official Student Examination Report</span>
              <span>Date: {formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1b18]">
              {testTitle || 'Mathematics Examination Paper'}
            </h1>

            {/* Candidate & Score Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs font-sans border-t border-[#e2dacd] mt-3">
              <div>
                <span className="text-gray-500 block">Candidate Name</span>
                <strong className="text-[#1c1b18] text-sm">{studentName || 'Student'}</strong>
              </div>
              <div>
                <span className="text-gray-500 block">Total Questions</span>
                <strong className="text-[#1c1b18] text-sm">{questions.length}</strong>
              </div>
              <div>
                <span className="text-gray-500 block">Auto-Graded Score</span>
                <strong className="text-[#1c1b18] text-sm">
                  {autoGraded.total > 0 ? `${autoGraded.score} / ${autoGraded.total} (${autoGraded.percentage}%)` : 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-gray-500 block">Pending Review</span>
                <strong className="text-[#1c1b18] text-sm">{pendingReview.length} Questions</strong>
              </div>
            </div>
          </div>

          {/* SHORT STYLE (Compact Scorecard Table) */}
          {printStyle === 'short' && (
            <div className="space-y-4 pt-2">
              <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-[#5c5346]">
                Response Summary Scorecard
              </h2>
              <table className="w-full text-left font-sans text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800 bg-[#f7f4ee]">
                    <th className="py-2.5 px-3 font-bold text-gray-800">Q#</th>
                    <th className="py-2.5 px-3 font-bold text-gray-800">Type</th>
                    <th className="py-2.5 px-3 font-bold text-gray-800">Student Response</th>
                    <th className="py-2.5 px-3 font-bold text-gray-800">Correct Answer Key</th>
                    <th className="py-2.5 px-3 font-bold text-gray-800 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {questions.map((q, idx) => {
                    const item = perQuestion[idx] || {};
                    const studentAns = studentAnswers[q.id];

                    let formattedStudentAns = '-';
                    if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                      if (q.type === 'mcq' && typeof studentAns === 'number') {
                        formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                      } else {
                        formattedStudentAns = `${studentAns}`;
                      }
                    }

                    let revealedCorrectAns = '-';
                    if (q.type === 'mcq' && typeof q.correctAnswer === 'number') {
                      revealedCorrectAns = `Option ${optionLetters[q.correctAnswer] || q.correctAnswer}`;
                    } else if (q.type === 'short_answer_numeric') {
                      if (Array.isArray(q.acceptedRange)) {
                        revealedCorrectAns = `${q.correctAnswer} [Range: ${q.acceptedRange[0]}–${q.acceptedRange[1]}]`;
                      } else if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
                        revealedCorrectAns = `${q.correctAnswer}`;
                      }
                    } else if (q.correctAnswer !== null && q.correctAnswer !== undefined && q.correctAnswer !== '') {
                      revealedCorrectAns = `${q.correctAnswer}`;
                    }

                    return (
                      <tr key={q.id || idx} className="page-break-inside-avoid">
                        <td className="py-2 px-3 font-serif font-bold">#{idx + 1}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {q.type === 'mcq' ? 'MCQ' : q.type === 'short_answer_numeric' ? 'Numeric' : 'Text'}
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-900">{formattedStudentAns}</td>
                        <td className="py-2 px-3 text-gray-700">{item.status !== 'pending_review' ? revealedCorrectAns : 'Teacher Evaluation'}</td>
                        <td className="py-2 px-3 text-right font-bold">
                          {item.status === 'correct' && <span className="text-emerald-700">Correct (+1)</span>}
                          {item.status === 'incorrect' && <span className="text-red-700">Incorrect (0)</span>}
                          {item.status === 'pending_review' && <span className="text-amber-800">Pending Review</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* LONG STYLE (Detailed Itemized Report with Stems) */}
          {printStyle === 'long' && (
            <div className="space-y-6 pt-2">
              <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-[#5c5346]">
                Itemized Question & Evaluation Report
              </h2>
              <div className="space-y-6">
                {questions.map((q, idx) => {
                  const item = perQuestion[idx] || {};
                  const studentAns = studentAnswers[q.id];

                  let formattedStudentAns = 'No response provided';
                  if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
                    if (q.type === 'mcq' && typeof studentAns === 'number') {
                      formattedStudentAns = `Option ${optionLetters[studentAns] || studentAns}`;
                    } else {
                      formattedStudentAns = `"${studentAns}"`;
                    }
                  }

                  let revealedCorrectAns = null;
                  if (q.type === 'mcq' && typeof q.correctAnswer === 'number') {
                    revealedCorrectAns = `Option ${optionLetters[q.correctAnswer] || q.correctAnswer}`;
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
                    <div key={q.id || idx} className="border border-gray-300 rounded-xl p-5 space-y-3 page-break-inside-avoid">
                      <div className="flex items-center justify-between font-sans text-xs border-b border-gray-200 pb-2">
                        <span className="font-bold text-gray-900">Question #{idx + 1}</span>
                        <span className="font-bold">
                          {item.status === 'correct' && <span className="text-emerald-700">Correct (+1)</span>}
                          {item.status === 'incorrect' && <span className="text-red-700">Incorrect (0)</span>}
                          {item.status === 'pending_review' && <span className="text-amber-800">Pending Review</span>}
                        </span>
                      </div>

                      {/* Stem */}
                      <div className="font-serif text-base text-[#1c1b18]">
                        <MathRenderer text={q.questionText} readOnly={true} />
                      </div>

                      {/* Details */}
                      <div className="bg-[#FAF7F0] p-3 rounded-lg font-sans text-xs space-y-1">
                        <div><span className="text-gray-500">Student Response: </span><strong className="text-gray-900">{formattedStudentAns}</strong></div>
                        {revealedCorrectAns && item.status !== 'pending_review' && (
                          <div><span className="text-[#3f6b4a]">Correct Key: </span><strong className="text-gray-900">{revealedCorrectAns}</strong></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paper Footer */}
          <div className="pt-6 border-t border-gray-300 text-center font-sans text-xs text-gray-500">
            *** End of Student Result Report ***
          </div>

        </div>

      </div>
    </div>
  );
}
