import React from 'react';
import { AlertCircle, Edit3 } from 'lucide-react';

export default function ReviewBanner({ confidenceScore, onOpenEditor }) {
  return (
    <div className="bg-[#fef8ef] border border-[#f3d9b1] rounded-lg p-3 mb-4 flex items-center justify-between text-xs text-[#8c5214]">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-[#c97a2b] shrink-0" />
        <div>
          <span className="font-semibold block text-[#6e3e0c]">
            Needs Teacher Review ({Math.round((confidenceScore || 0.75) * 100)}% Confidence)
          </span>
          <span className="text-[#8c5214]">
            Some math notation was ambiguous in the source input. Click any highlighted formula or use the Visual Editor to adjust.
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenEditor}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#fff] border border-[#e5b87c] text-[#8c5214] font-medium hover:bg-[#fcf3e6] transition-colors shrink-0"
      >
        <Edit3 className="w-3.5 h-3.5" />
        Visual Editor
      </button>
    </div>
  );
}
