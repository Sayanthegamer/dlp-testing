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
        className="flex items-center justify-between px-6 py-4 cursor-pointer bg-[#f5efe4] hover:bg-[#ede5d8] transition-colors border-b border-[#e2d8ca]"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2c2825] text-white flex items-center justify-center">
            <UploadCloud className="w-4 h-4 text-[#e6cca6]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1c1b18]">
              Upload or Add Questions
            </h3>
            <p className="text-xs text-[#736c62]">
              Import from Messy Text, Phone Photo/Whiteboard, or Word .docx
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold text-[#8c4a17] hover:underline"
        >
          <span>{isOpen ? 'Hide Upload Panel' : 'Open Upload Panel'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="p-6">
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
