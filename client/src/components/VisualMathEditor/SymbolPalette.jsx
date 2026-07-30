import React from 'react';

const COMMON_SYMBOLS = [
  { label: 'Fraction', insert: '(a / b)', icon: 'a/b' },
  { label: 'Exponent', insert: 'x^n', icon: 'xⁿ' },
  { label: 'Subscript', insert: 'x_n', icon: 'xₙ' },
  { label: 'Square Root', insert: '√(x)', icon: '√x' },
  { label: 'Integral', insert: '∫[0→1] x dx', icon: '∫' },
  { label: 'Plus-Minus', insert: '±', icon: '±' },
  { label: 'Multiply', insert: '×', icon: '×' },
  { label: 'Divide', insert: '÷', icon: '÷' },
  { label: 'Not Equal', insert: '≠', icon: '≠' },
  { label: 'Less/Equal', insert: '≤', icon: '≤' },
  { label: 'Greater/Equal', insert: '≥', icon: '≥' },
  { label: 'Pi', insert: 'π', icon: 'π' },
  { label: 'Theta', insert: 'θ', icon: 'θ' },
  { label: 'Alpha', insert: 'α', icon: 'α' },
  { label: 'Beta', insert: 'β', icon: 'β' },
  { label: 'Infinity', insert: '∞', icon: '∞' },
  { label: 'Delta', insert: 'Δ', icon: 'Δ' },
];

export default function SymbolPalette({ onInsert }) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6354] block">
        Visual Math Builder Tools
      </span>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_SYMBOLS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onInsert(item.insert)}
            className="px-2.5 py-1.5 bg-[#ffffff] hover:bg-[#f7f2e9] border border-[#dcd2c4] hover:border-[#bfae99] rounded text-xs font-serif font-semibold text-[#2c2825] shadow-2xs transition-all active:scale-95 flex items-center gap-1"
            title={`Insert ${item.label}`}
          >
            <span>{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
