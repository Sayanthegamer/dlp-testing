import React from 'react';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { isLongOptionsLayout } from '../../services/layoutHelpers';
import { Printer, X } from 'lucide-react';

export default function PrintViewModal({ testTitle, questions, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div className="print-modal-container bg-[#fbf9f5] border border-[#dcd2c4] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto print:bg-white print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible">
        
        {/* Modal Header Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2d8ca] bg-[#f5efe4] print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#8c4a17]" />
            <h3 className="font-serif font-bold text-base text-[#1c1b18]">
              Exam Paper Print / PDF Export Preview
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2c2825] hover:bg-[#1c1b18] text-[#fbf9f5] text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-[#e6cca6]" />
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

        {/* Printable Exam Content */}
        <div id="printable-exam-paper" className="p-8 sm:p-12 overflow-y-auto font-serif text-[#1c1b18] bg-white space-y-8 print:p-0 print:overflow-visible">
          
          {/* Exam Title & Header Info */}
          <div className="border-b-2 border-[#1c1b18] pb-6 text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#1c1b18]">
              {testTitle || 'Mathematics Examination Paper'}
            </h1>
            <div className="flex items-center justify-between text-xs font-sans text-[#5c5346] max-w-md mx-auto pt-4 border-t border-[#e2dacd]">
              <span>Time Allowed: 60 mins</span>
              <span>Total Questions: {questions.length}</span>
              <span>Maximum Marks: {questions.length * 4}</span>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const isLongOptions = isLongOptionsLayout(q.options);

              return (
                <div key={q.id || idx} className="space-y-3 page-break-inside-avoid">
                  <div className="flex items-start gap-2 text-base sm:text-lg text-[#1c1b18]">
                    <span className="font-bold">{idx + 1}.</span>
                    <div className="flex-1">
                      <MathRenderer text={q.questionText} />
                    </div>
                  </div>

                  {/* MCQ Options (Smart Layout: 2-column for short, 1-column stack for long options) */}
                  {q.type === 'mcq' && q.options && q.options.length > 0 && (
                    <div
                      className={
                        isLongOptions
                          ? 'space-y-2 pl-6 pt-1 text-base'
                          : 'grid grid-cols-2 gap-x-8 gap-y-2 pl-6 pt-1 text-base'
                      }
                    >
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-start gap-2">
                          <span className="font-bold text-[#4a443b] shrink-0">
                            ({optionLetters[optIdx] || optIdx + 1})
                          </span>
                          <div>
                            <MathRenderer text={opt} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Short Answer blank line */}
                  {q.type === 'short_answer' && (
                    <div className="pl-6 pt-2">
                      <div className="border-b border-dashed border-gray-400 w-64 h-6"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Exam Footer */}
          <div className="pt-8 border-t border-gray-300 text-center font-sans text-xs text-gray-500">
            *** End of Examination Paper ***
          </div>

        </div>

      </div>
    </div>
  );
}
