import React, { useState } from 'react';
import SamplePrompts from '../Common/SamplePrompts';
import { ArrowRight } from 'lucide-react';

export default function TextInputTab({ onSubmitText, isLoading, onLoadDocxSample }) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim() || isLoading) return;
    onSubmitText(textInput);
  };

  const handleSampleClick = (sampleText) => {
    setTextInput(sampleText);
    onSubmitText(sampleText);
  };

  return (
    <div className="space-y-4">
      <SamplePrompts
        onLoadTextSample={handleSampleClick}
        onLoadDocxSample={onLoadDocxSample}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#5e554a] mb-1.5 flex flex-wrap items-center justify-between gap-1">
            <span>Informal math text</span>
            <span className="text-[11px] sm:text-xs text-[#7b7266]">Plain English converted to typeset math</span>
          </label>

          <textarea
            rows={4}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Solve for x: x squared plus 2x minus 3 = 0. Options: A) x = 1, -3  B) x = -1, 3  C) x = 2, -3  D) x = -2, 1"
            className="w-full p-3.5 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] placeholder-[#7b7266] focus:outline-none focus:border-[#8c4a17] transition-calm leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={!textInput.trim() || isLoading}
          className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs flex items-center justify-center gap-2 transition-calm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Typeset question</span>
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </form>
    </div>
  );
}
