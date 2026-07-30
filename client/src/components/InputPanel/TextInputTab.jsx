import React, { useState } from 'react';
import SamplePrompts from '../Common/SamplePrompts';
import { Send, Sparkles } from 'lucide-react';

export default function TextInputTab({ onSubmitText, isLoading, onLoadSampleText, onLoadDocxSample }) {
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
      {/* Sample Loader Buttons */}
      <SamplePrompts
        onLoadTextSample={handleSampleClick}
        onLoadPhotoSample={() => {}}
        onLoadDocxSample={onLoadDocxSample}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 flex items-center justify-between">
            <span>Type or Paste Informal Math Question</span>
            <span className="text-[11px] text-[#8c8275] font-normal">Informal English allowed — No LaTeX code required!</span>
          </label>
          
          <textarea
            rows={5}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your question informally here... e.g. Solve for x: x squared plus 2x minus 3 = 0. Options: A) x = 1, -3 B) x = -1, 3 C) x = 2, -3 D) x = -2, 1"
            className="w-full p-3.5 rounded-xl border border-[#dcd2c4] bg-[#ffffff] text-sm text-[#1c1b18] placeholder-[#9c9386] focus:outline-none focus:ring-2 focus:ring-[#a86e2d] focus:border-transparent transition-all shadow-inner leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={!textInput.trim() || isLoading}
          className="w-full py-3 px-4 rounded-xl bg-[#2c2825] hover:bg-[#1a1816] text-[#fbf9f5] font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 text-[#e6cca6]" />
          <span>Typeset Exam Question</span>
        </button>
      </form>
    </div>
  );
}
