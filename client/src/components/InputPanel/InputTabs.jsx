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
    { id: 'text', label: 'Informal text', shortLabel: 'Text', icon: FileText },
    { id: 'photo', label: 'Photos and PDFs', shortLabel: 'Photos/PDF', icon: ImageIcon },
    { id: 'docx', label: 'Word .docx', shortLabel: 'Word', icon: FileCode }
  ];

  return (
    <div className="space-y-4">
      {/* Tab Selectors */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#efe9df] rounded-lg border border-[#dcd5c4]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 h-9 px-1.5 sm:px-3 rounded-md text-xs font-medium transition-calm ${
                isActive
                  ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7b7266] shrink-0" strokeWidth={1.5} />
              <span className="hidden sm:inline truncate">{t.label}</span>
              <span className="sm:hidden truncate">{t.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
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
