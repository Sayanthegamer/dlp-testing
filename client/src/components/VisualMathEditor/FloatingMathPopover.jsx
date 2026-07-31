import React, { useState, useEffect } from 'react';
import SymbolPalette from './SymbolPalette';
import { latexToVisualText, visualTextToLatex } from '../../services/latexToVisualBlocks';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { Check, X, Edit3 } from 'lucide-react';

export default function FloatingMathPopover({ activeMath, targetElement, onSave, onClose }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcfbfa] border border-[#dcd2c4] rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full space-y-4 relative animate-in zoom-in-95 duration-200">
        
        {/* Popover Header */}
        <div className="flex items-center justify-between border-b border-[#ece4d8] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a86e2d] text-white flex items-center justify-center shadow-xs">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1c1b18]">Visual Math Equation Toolbar</h3>
              <p className="text-xs text-[#736c62]">Edit equation visually in place (Zero code required)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8c8275] hover:bg-[#efe8dc] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Symbol Palette */}
        <SymbolPalette onInsert={handleInsertSymbol} />

        {/* Visual Input Field */}
        <div>
          <label className="block text-xs font-semibold text-[#5c5346] mb-1.5">
            Visual Formula Typing:
          </label>
          <input
            type="text"
            value={visualText}
            onChange={handleVisualChange}
            placeholder="e.g. (a / b) + x^2 = 10"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#c9bea9] bg-white font-serif text-base text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#a86e2d] focus:border-transparent shadow-inner"
            autoFocus
          />
          <p className="text-[11px] text-[#8c8275] mt-1.5">
            Simple visual syntax: <code className="bg-[#f0e6d8] px-1.5 py-0.5 rounded text-[#5c5346]">(a / b)</code> fraction, <code className="bg-[#f0e6d8] px-1.5 py-0.5 rounded text-[#5c5346]">x^2</code> power, <code className="bg-[#f0e6d8] px-1.5 py-0.5 rounded text-[#5c5346]">√(x)</code> root.
          </p>
        </div>

        {/* Real-time Typeset KaTeX Preview */}
        <div className="bg-[#f7f2ea] border border-[#e2d8ca] rounded-xl p-3 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#736c62] block mb-1.5">
            Live Exam Typeset Preview
          </span>
          <div className="text-lg sm:text-xl font-serif text-[#1c1b18] min-h-[44px] flex items-center justify-center bg-white rounded-lg border border-[#eae0d2] p-3 shadow-xs overflow-x-auto max-w-full">
            <MathRenderer text={`<math>${cleanPreview}</math>`} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#dcd2c4] text-xs font-medium text-[#5c5346] hover:bg-[#ede5d8] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#a86e2d] hover:bg-[#8c5a24] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Check className="w-4 h-4" /> Save Formula
          </button>
        </div>

      </div>
    </div>
  );
}
