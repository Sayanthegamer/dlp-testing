import React from 'react';
import { Sparkles, FileText, Image as ImageIcon, FileCode } from 'lucide-react';

export default function SamplePrompts({ onLoadTextSample, onLoadPhotoSample, onLoadDocxSample }) {
  return (
    <div className="bg-[#f5efe4] border border-[#e2d8c7] rounded-lg p-3.5 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#b86d1b]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6e5d48]">
          Quick Test Samples (Click to load)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onLoadTextSample("Solve for x: x squared plus 2x minus 3 = 0. Options: A) x = 1, -3  B) x = -1, 3  C) x = 2, -3  D) x = -2, 1. Correct answer: A")}
          className="flex items-center gap-2 text-left p-2 rounded bg-[#fcfbfa] hover:bg-[#fff] border border-[#e2dacd] text-xs text-[#2c2825] transition-all group"
        >
          <FileText className="w-4 h-4 text-[#a86e2d] shrink-0 group-hover:scale-110 transition-transform" />
          <div className="truncate">
            <span className="font-medium block truncate">1. Quadratic Equation</span>
            <span className="text-[10px] text-[#736c62] block truncate">Messy text input</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onLoadTextSample("Evaluate the integral of x^2 dx from 0 to 1. Options: A) 1/3  B) 1/2  C) 1  D) 2/3. Correct answer is A")}
          className="flex items-center gap-2 text-left p-2 rounded bg-[#fcfbfa] hover:bg-[#fff] border border-[#e2dacd] text-xs text-[#2c2825] transition-all group"
        >
          <FileText className="w-4 h-4 text-[#a86e2d] shrink-0 group-hover:scale-110 transition-transform" />
          <div className="truncate">
            <span className="font-medium block truncate">2. Definite Integral</span>
            <span className="text-[10px] text-[#736c62] block truncate">Calculus informal text</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onLoadDocxSample}
          className="flex items-center gap-2 text-left p-2 rounded bg-[#fcfbfa] hover:bg-[#fff] border border-[#e2dacd] text-xs text-[#2c2825] transition-all group"
        >
          <FileCode className="w-4 h-4 text-[#2b6cb0] shrink-0 group-hover:scale-110 transition-transform" />
          <div className="truncate">
            <span className="font-medium block truncate">3. Word OMML Equation</span>
            <span className="text-[10px] text-[#736c62] block truncate">Native .docx XML sample</span>
          </div>
        </button>
      </div>
    </div>
  );
}
