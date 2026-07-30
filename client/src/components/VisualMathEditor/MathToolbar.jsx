import React, { useState, useEffect } from 'react';
import SymbolPalette from './SymbolPalette';
import { latexToVisualText, visualTextToLatex } from '../../services/latexToVisualBlocks';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { Check, X, Edit3, HelpCircle } from 'lucide-react';

export default function MathToolbar({ activeMath, onSave, onClose }) {
  const [visualText, setVisualText] = useState('');
  const [previewLatex, setPreviewLatex] = useState('');

  useEffect(() => {
    if (activeMath) {
      const cleanMath = activeMath.replace(/<\/?math>/gi, '').trim();
      const visual = latexToVisualText(cleanMath);
      setVisualText(visual);
      setPreviewLatex(cleanMath);
    } else {
      setVisualText('x^2 + 2x - 3 = 0');
      setPreviewLatex('x^2 + 2x - 3 = 0');
    }
  }, [activeMath]);

  const handleVisualChange = (e) => {
    const val = e.target.value;
    setVisualText(val);
    const generatedLatex = visualTextToLatex(val);
    setPreviewLatex(generatedLatex);
  };

  const handleInsertSymbol = (symbolText) => {
    const updated = visualText + ' ' + symbolText;
    setVisualText(updated);
    const generatedLatex = visualTextToLatex(updated);
    setPreviewLatex(generatedLatex);
  };

  const handleSaveClick = () => {
    const finalLatex = visualTextToLatex(visualText);
    onSave(activeMath, finalLatex);
  };

  const cleanPreview = (previewLatex || '').replace(/<\/?math>/gi, '').trim();

  return (
    <div className="bg-[#fcfbfa] border border-[#dcd2c4] rounded-xl p-5 shadow-lg space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ece4d8] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#a86e2d] text-white flex items-center justify-center">
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-[#1c1b18]">Visual Math Equation Editor</h3>
            <p className="text-[11px] text-[#736c62]">Word-style visual editor (No code required)</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-[#8c8275] hover:bg-[#efe8dc] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Visual Symbol Palette */}
      <SymbolPalette onInsert={handleInsertSymbol} />

      {/* Visual Input Field */}
      <div>
        <label className="block text-xs font-semibold text-[#5c5346] mb-1">
          Visual Formula Input:
        </label>
        <div className="relative">
          <input
            type="text"
            value={visualText}
            onChange={handleVisualChange}
            placeholder="e.g. (a / b) + x^2 = 10"
            className="w-full px-3 py-2.5 rounded-lg border border-[#c9bea9] bg-white font-serif text-base text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d] focus:border-transparent shadow-inner"
          />
        </div>
        <p className="text-[11px] text-[#8c8275] mt-1">
          Use simple visual typing: <code className="bg-[#f0e6d8] px-1 rounded text-[#5c5346]">(a / b)</code> for fractions, <code className="bg-[#f0e6d8] px-1 rounded text-[#5c5346]">x^2</code> for powers, <code className="bg-[#f0e6d8] px-1 rounded text-[#5c5346]">√(x)</code> for roots.
        </p>
      </div>

      {/* Live Typeset KaTeX Preview */}
      <div className="bg-[#f7f2ea] border border-[#e2d8ca] rounded-lg p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#736c62] block mb-2">
          Live Typeset Exam Preview
        </span>
        <div className="text-xl font-serif text-[#1c1b18] min-h-[36px] flex items-center justify-center bg-white rounded border border-[#eae0d2] p-3 shadow-xs">
          <MathRenderer text={`<math>${cleanPreview}</math>`} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-lg border border-[#dcd2c4] text-xs font-medium text-[#5c5346] hover:bg-[#ede5d8] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveClick}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a86e2d] hover:bg-[#8c5a24] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          <Check className="w-4 h-4" /> Save Formula to Question
        </button>
      </div>

    </div>
  );
}
