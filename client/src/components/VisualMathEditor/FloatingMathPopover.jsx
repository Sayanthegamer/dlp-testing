import React, { useState, useEffect } from 'react';
import SymbolPalette from './SymbolPalette';
import { latexToVisualText, visualTextToLatex } from '../../services/latexToVisualBlocks';
import MathRenderer from '../PreviewPanel/MathRenderer';
import { Check, X, Edit3 } from 'lucide-react';

export default function FloatingMathPopover({ activeMath, onSave, onClose }) {
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
    setPreviewLatex(visualTextToLatex(val));
  };

  const handleInsertSymbol = (symbolText) => {
    const updated = (visualText ? visualText + ' ' : '') + symbolText;
    setVisualText(updated);
    setPreviewLatex(visualTextToLatex(updated));
  };

  const handleSaveClick = () => {
    const finalLatex = visualTextToLatex(visualText);
    onSave(activeMath, finalLatex);
  };

  const cleanPreview = (previewLatex || '').replace(/<\/?math>/gi, '').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#161513]/60 overflow-y-auto modal-backdrop-animated">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 relative shadow-lg my-auto max-h-[92vh] overflow-y-auto popover-animated">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dcd5c4] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#efe9df] text-[#1f1b16] flex items-center justify-center">
              <Edit3 className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-serif font-medium text-base text-[#1f1b16]">Visual equation builder</h3>
              <p className="text-xs text-[#5e554a]">Click symbols or type visual expressions</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7b7266] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <SymbolPalette onInsert={handleInsertSymbol} />

        <div>
          <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
            Visual expression
          </label>
          <input
            type="text"
            value={visualText}
            onChange={handleVisualChange}
            placeholder="(a / b) + x^2 = 10"
            className="w-full px-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-serif text-base text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
            autoFocus
          />
          <p className="text-xs text-[#7b7266] mt-1.5">
            Examples: <code className="bg-[#efe9df] px-1.5 py-0.5 rounded text-[#1f1b16] font-mono text-[11px]">(a / b)</code> fraction, <code className="bg-[#efe9df] px-1.5 py-0.5 rounded text-[#1f1b16] font-mono text-[11px]">x^2</code> power, <code className="bg-[#efe9df] px-1.5 py-0.5 rounded text-[#1f1b16] font-mono text-[11px]">√(x)</code> root
          </p>
        </div>

        {/* Live Typeset Preview */}
        <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3.5">
          <span className="text-xs font-medium text-[#5e554a] block mb-1.5">
            Typeset preview
          </span>
          <div className="text-xl font-serif text-[#1f1b16] min-h-[48px] flex items-center justify-center bg-[#fdfbf7] rounded-md border border-[#dcd5c4] p-3 overflow-x-auto">
            <MathRenderer text={`<math>${cleanPreview}</math>`} readOnly={true} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg border border-[#dcd5c4] text-xs font-medium text-[#5e554a] hover:bg-[#efe9df] transition-calm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm active:scale-[0.98]"
          >
            <Check className="w-4 h-4" strokeWidth={1.5} />
            <span>Save formula</span>
          </button>
        </div>
      </div>
    </div>
  );
}
