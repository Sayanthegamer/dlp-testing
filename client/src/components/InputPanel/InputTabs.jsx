import React, { useState } from 'react';
import TextInputTab from './TextInputTab';
import PhotoInputTab from './PhotoInputTab';
import DocxInputTab from './DocxInputTab';
import { FileText, Image as ImageIcon, FileCode } from 'lucide-react';

export default function InputTabs({
  onSubmitText,
  onSubmitImage,
  onSubmitDocx,
  isLoading,
  onLoadDocxSample
}) {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'photo' | 'docx'

  const tabs = [
    { id: 'text', label: '1. Messy Text', icon: FileText, desc: 'Type/paste informal math' },
    { id: 'photo', label: '2. Photos & PDFs', icon: ImageIcon, desc: 'Multi-image / PDF pages' },
    { id: 'docx', label: '3. Word .docx', icon: FileCode, desc: 'Native OMML equations' }
  ];

  return (
    <div className="bg-[#fbf9f5] border border-[#e2dacd] rounded-xl p-5 shadow-sm space-y-4">
      
      {/* Header title */}
      <div>
        <h2 className="font-serif font-bold text-base text-[#1c1b18]">Select Question Source</h2>
        <p className="text-xs text-[#736c62]">Choose whichever input method you have on hand</p>
      </div>

      {/* Tab Selectors */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#ede5d8] rounded-lg">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-md text-[11px] sm:text-xs transition-all ${
                isActive
                  ? 'bg-white text-[#1c1b18] font-semibold shadow-xs'
                  : 'text-[#6e6456] hover:text-[#1c1b18] hover:bg-[#e4dbcc]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5 sm:mb-1 ${isActive ? 'text-[#a86e2d]' : 'text-[#7e7465]'}`} />
              <span className="truncate w-full text-center">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'text' && (
          <TextInputTab
            onSubmitText={onSubmitText}
            isLoading={isLoading}
            onLoadDocxSample={onLoadDocxSample}
          />
        )}

        {activeTab === 'photo' && (
          <PhotoInputTab
            onSubmitImage={onSubmitImage}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'docx' && (
          <DocxInputTab
            onSubmitDocx={onSubmitDocx}
            isLoading={isLoading}
          />
        )}
      </div>

    </div>
  );
}
