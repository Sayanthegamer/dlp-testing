import React from 'react';
import { FileText, FileCode } from 'lucide-react';

export default function SamplePrompts({ onLoadTextSample, onLoadDocxSample }) {
  return (
    <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#5e554a]">
          Sample inputs
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onLoadTextSample("Solve for x: x squared plus 2x minus 3 = 0. Options: A) x = 1, -3  B) x = -1, 3  C) x = 2, -3  D) x = -2, 1. Correct answer: A")}
          className="flex items-center gap-2.5 text-left p-2.5 rounded-md bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] text-xs text-[#1f1b16] transition-calm"
        >
          <FileText className="w-4 h-4 text-[#7b7266] shrink-0" strokeWidth={1.5} />
          <div className="truncate">
            <span className="font-medium block truncate">Quadratic roots</span>
            <span className="text-[11px] text-[#7b7266] block truncate">Informal text</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onLoadTextSample("Evaluate the integral of x^2 dx from 0 to 1. Options: A) 1/3  B) 1/2  C) 1  D) 2/3. Correct answer is A")}
          className="flex items-center gap-2.5 text-left p-2.5 rounded-md bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] text-xs text-[#1f1b16] transition-calm"
        >
          <FileText className="w-4 h-4 text-[#7b7266] shrink-0" strokeWidth={1.5} />
          <div className="truncate">
            <span className="font-medium block truncate">Definite integral</span>
            <span className="text-[11px] text-[#7b7266] block truncate">Calculus notation</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onLoadDocxSample}
          className="flex items-center gap-2.5 text-left p-2.5 rounded-md bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] text-xs text-[#1f1b16] transition-calm"
        >
          <FileCode className="w-4 h-4 text-[#7b7266] shrink-0" strokeWidth={1.5} />
          <div className="truncate">
            <span className="font-medium block truncate">Word OMML sample</span>
            <span className="text-[11px] text-[#7b7266] block truncate">Native .docx equation</span>
          </div>
        </button>
      </div>
    </div>
  );
}
