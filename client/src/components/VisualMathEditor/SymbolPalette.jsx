import React, { useState } from 'react';

const CATEGORIZED_SYMBOLS = {
  Algebra: [
    { label: 'Fraction', insert: '(a / b)', icon: 'a/b' },
    { label: 'Exponent', insert: 'x^n', icon: 'xⁿ' },
    { label: 'Subscript', insert: 'x_n', icon: 'xₙ' },
    { label: 'Square Root', insert: '√(x)', icon: '√x' },
    { label: 'nth Root', insert: 'ⁿ√(x)', icon: 'ⁿ√x' },
    { label: 'Absolute Value', insert: '|x|', icon: '|x|' },
    { label: 'Plus-Minus', insert: '±', icon: '±' },
    { label: 'Multiply', insert: '×', icon: '×' },
    { label: 'Divide', insert: '÷', icon: '÷' },
    { label: 'Not Equal', insert: '≠', icon: '≠' },
    { label: 'Less/Equal', insert: '≤', icon: '≤' },
    { label: 'Greater/Equal', insert: '≥', icon: '≥' },
  ],
  'Perm & Comb': [
    { label: 'Combination (nCr)', insert: 'nCr(n, r)', icon: 'ⁿCᵣ' },
    { label: 'Permutation (nPr)', insert: 'nPr(n, r)', icon: 'ⁿPᵣ' },
    { label: 'Binomial Coefficient', insert: 'binom(n, r)', icon: '(ⁿᵣ)' },
    { label: 'Factorial', insert: 'n!', icon: 'n!' },
  ],
  Complex: [
    { label: 'Modulus', insert: '|z|', icon: '|z|' },
    { label: 'Conjugate', insert: 'bar(z)', icon: 'z̄' },
    { label: 'Real Part', insert: 'Re(z)', icon: 'Re(z)' },
    { label: 'Imaginary Part', insert: 'Im(z)', icon: 'Im(z)' },
    { label: 'Argument', insert: 'arg(z)', icon: 'arg(z)' },
    { label: 'Polar Form', insert: 'r * e^(i * θ)', icon: 'reⁱᵗ' },
    { label: 'Complex Set', insert: 'ℂ', icon: 'ℂ' },
  ],
  Calculus: [
    { label: 'Derivative', insert: '(d / dx)(x)', icon: 'd/dx' },
    { label: 'Partial Derivative', insert: '(∂ / ∂x)(x)', icon: '∂/∂x' },
    { label: 'Integral', insert: '∫ x dx', icon: '∫' },
    { label: 'Definite Integral', insert: 'int[0→1] x dx', icon: '∫₀¹' },
    { label: 'Contour Integral', insert: '∮ x dx', icon: '∮' },
    { label: 'Summation', insert: 'sum[i=1→n] x_i', icon: '∑' },
    { label: 'Product', insert: 'prod[i=1→n] x_i', icon: '∏' },
    { label: 'Limit', insert: 'lim[x→0] f(x)', icon: 'lim' },
  ],
  'Vectors & Matrices': [
    { label: 'Vector Arrow', insert: 'vec(A)', icon: 'A⃗' },
    { label: 'Unit Vector Hat', insert: 'hat(i)', icon: 'î' },
    { label: 'Dot Product', insert: '⋅', icon: '⋅' },
    { label: 'Cross Product', insert: '×', icon: '×' },
    { label: 'Del / Nabla', insert: '∇', icon: '∇' },
    { label: '2x2 Matrix', insert: 'matrix(a, b; c, d)', icon: '[Matrix]' },
    { label: '2x2 Determinant', insert: 'det(a, b; c, d)', icon: '|Det|' },
    { label: 'Piecewise Cases', insert: 'cases(x if x≤1, 5 if x>1)', icon: '{Cases}' },
  ],
  'Sets & Logic': [
    { label: 'Element of', insert: '∈', icon: '∈' },
    { label: 'Not element of', insert: '∉', icon: '∉' },
    { label: 'Subset', insert: '⊂', icon: '⊂' },
    { label: 'Subset or equal', insert: '⊆', icon: '⊆' },
    { label: 'Union', insert: '∪', icon: '∪' },
    { label: 'Intersection', insert: '∩', icon: '∩' },
    { label: 'Therefore', insert: '∴', icon: '∴' },
    { label: 'Angle', insert: '∠', icon: '∠' },
    { label: 'Real Numbers', insert: 'ℝ', icon: 'ℝ' },
    { label: 'Complex Numbers', insert: 'ℂ', icon: 'ℂ' },
    { label: 'Integers', insert: 'ℤ', icon: 'ℤ' },
    { label: 'Natural Numbers', insert: 'ℕ', icon: 'ℕ' },
  ],
  Greek: [
    { label: 'Pi', insert: 'π', icon: 'π' },
    { label: 'Theta', insert: 'θ', icon: 'θ' },
    { label: 'Alpha', insert: 'α', icon: 'α' },
    { label: 'Beta', insert: 'β', icon: 'β' },
    { label: 'Gamma', insert: 'γ', icon: 'γ' },
    { label: 'Delta', insert: 'Δ', icon: 'Δ' },
    { label: 'Lambda', insert: 'λ', icon: 'λ' },
    { label: 'Sigma', insert: 'σ', icon: 'σ' },
    { label: 'Omega', insert: 'ω', icon: 'ω' },
    { label: 'Phi', insert: 'ϕ', icon: 'ϕ' },
    { label: 'Mu', insert: 'μ', icon: 'μ' },
    { label: 'Epsilon', insert: 'ε', icon: 'ε' },
    { label: 'Infinity', insert: '∞', icon: '∞' },
  ],
  Science: [
    { label: 'Chemical Formula', insert: 'chem(H2O)', icon: 'chem()' },
    { label: 'Physical Unit', insert: 'unit(9.8 m/s^2)', icon: 'unit()' },
    { label: 'Combination', insert: 'nCr(n, r)', icon: 'nCr' },
    { label: 'Permutation', insert: 'nPr(n, r)', icon: 'nPr' },
  ],
};

export default function SymbolPalette({ onInsert }) {
  const [activeCategory, setActiveCategory] = useState('Algebra');

  const categories = Object.keys(CATEGORIZED_SYMBOLS);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6354]">
          Visual Builder Tools
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#e6dccf]">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#a86e2d] text-white shadow-2xs font-semibold'
                : 'text-[#6e6354] hover:bg-[#ede5d8] hover:text-[#2c2825]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Symbol Buttons Grid */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {CATEGORIZED_SYMBOLS[activeCategory].map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onInsert(item.insert)}
            className="px-2.5 py-1.5 bg-white hover:bg-[#f7f2e9] border border-[#dcd2c4] hover:border-[#a86e2d] rounded-lg text-xs font-serif font-semibold text-[#2c2825] shadow-2xs transition-all active:scale-95 flex items-center gap-1 text-nowrap"
            title={`Insert ${item.label}`}
          >
            <span>{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

