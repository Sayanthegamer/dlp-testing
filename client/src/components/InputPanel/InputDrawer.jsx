import React, { useState } from 'react';
import InputTabs from './InputTabs';
import { UploadCloud, ChevronUp, ChevronDown } from 'lucide-react';

export default function InputDrawer({
  onSubmitText,
  onSubmitImage,
  onSubmitDocx,
  isLoading,
  onLoadDocxSample
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl overflow-hidden transition-calm">
      {/* Drawer Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer bg-[#efe9df] hover:bg-[#e5dec9] transition-calm border-b border-[#dcd5c4] gap-2"
      >
        <div className="flex items-center gap-3 min-w-0">
          <UploadCloud className="w-4 h-4 text-[#5e554a] shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <h3 className="font-serif font-medium text-base text-[#1f1b16] truncate">
              Import questions from source
            </h3>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-[#5e554a] hover:text-[#1f1b16] shrink-0"
        >
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </div>

      {isOpen && (
        <div className="p-5">
          <InputTabs
            onSubmitText={onSubmitText}
            onSubmitImage={onSubmitImage}
            onSubmitDocx={onSubmitDocx}
            isLoading={isLoading}
            onLoadDocxSample={onLoadDocxSample}
          />
        </div>
      )}
    </div>
  );
}
