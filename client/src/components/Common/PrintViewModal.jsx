import React from 'react';
import { createPortal } from 'react-dom';
import MathRenderer from '../PreviewPanel/MathRenderer';
import DiagramBlock from '../PreviewPanel/DiagramBlock';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import { Printer, X } from 'lucide-react';

export default function PrintViewModal({ testTitle, questions, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const modalContent = (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-[#161513]/60 overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div className="print-modal-container bg-[#fdfbf7] border-0 sm:border border-[#dcd5c4] rounded-none sm:rounded-2xl max-w-4xl w-full h-dvh sm:h-auto sm:max-h-[90vh] flex flex-col shadow-xl overflow-hidden font-sans print:bg-white print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible relative">
        {/* Sticky Modal Header Bar (Hidden on print) */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[#dcd5c4] bg-[#efe9df] print:hidden gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Printer className="w-4 h-4 text-[#5e554a] shrink-0" strokeWidth={1.5} />
            <h3 className="font-serif font-medium text-base text-[#1f1b16] truncate">
              Printable examination paper
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
              <span>Print or save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 h-9 w-9 rounded-lg bg-[#fdfbf7] border border-[#dcd5c4] text-[#5e554a] hover:text-[#1f1b16] transition-calm flex items-center justify-center"
              title="Close preview"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Printable Exam Content */}
        <div id="printable-exam-paper" className="p-8 sm:p-12 overflow-y-auto font-serif text-[#1f1b16] bg-white space-y-8 print:p-0 print:overflow-visible">
          {/* Exam Title & Header Info */}
          <div className="exam-rule-double pb-5 text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#1f1b16]">
              {testTitle || 'Mathematics Examination Paper'}
            </h1>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#5e554a] max-w-md mx-auto pt-3 border-t border-[#dcd5c4]">
              <span>Duration: 60 mins</span>
              <span>Questions: {questions.length}</span>
              <span>Maximum marks: {questions.length * 4}</span>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const isLongOptions = isLongOptionsLayout(q.options);

              return (
                <div key={q.id || idx} className="space-y-3 page-break-inside-avoid">
                  <div className="flex items-start gap-3 text-base sm:text-lg text-[#1f1b16]">
                    <span className="font-medium tabular-nums shrink-0">Q{idx + 1}.</span>
                    <div className="flex-1">
                      <MathRenderer text={q.questionText} readOnly={true} />
                      <DiagramBlock diagrams={q.diagrams} diagramImages={q.diagramImages} />
                    </div>
                  </div>

                  {(q.type === 'mcq' || q.type === 'match_following') && q.options && q.options.length > 0 && (
                    <div
                      className={
                        isLongOptions
                          ? 'space-y-2 pl-8 pt-1 text-base'
                          : 'grid grid-cols-2 gap-x-8 gap-y-2 pl-8 pt-1 text-base'
                      }
                    >
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-start gap-2">
                          <span className="font-mono text-sm text-[#5e554a] shrink-0 mt-0.5">
                            ({optionLetters[optIdx] || optIdx + 1})
                          </span>
                          <div>
                            <MathRenderer text={opt} readOnly={true} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'short_answer_numeric' && (
                    <div className="pl-8 pt-2">
                      <div className="border-b border-dashed border-[#7b7266] w-56 h-6" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Exam Footer */}
          <div className="pt-8 border-t border-[#dcd5c4] text-center font-sans text-xs text-[#7b7266]">
            End of examination paper
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
