import React, { useState } from 'react';
import InputTabs from './InputTabs';
import { UploadCloud, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

export default function InputDrawer({
  onSubmitText,
  onSubmitImage,
  onSubmitDocx,
  isLoading,
  onLoadDocxSample
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-[#fbf9f5] border border-[#e2dacd] rounded-2xl shadow-sm overflow-hidden transition-all">
      
      {/* Drawer Header Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 cursor-pointer bg-[#f5efe4] hover:bg-[#ede5d8] transition-colors border-b border-[#e2d8ca] gap-2"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#2c2825] text-white flex items-center justify-center shrink-0">
            <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e6cca6]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-bold text-sm sm:text-base text-[#1c1b18] truncate">
              Upload or Add Questions
            </h3>
            <p className="text-[11px] sm:text-xs text-[#736c62] hidden sm:block truncate">
              Import from Messy Text, Phone Photo/Whiteboard, or Word .docx
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold text-[#8c4a17] hover:underline shrink-0"
        >
          <span className="hidden sm:inline">{isOpen ? 'Hide Upload Panel' : 'Open Upload Panel'}</span>
          <span className="sm:hidden">{isOpen ? 'Hide' : 'Open'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="p-4 sm:p-6">
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
