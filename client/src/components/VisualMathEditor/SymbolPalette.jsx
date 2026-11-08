import React, { useState } from 'react';

const CATEGORIZED_SYMBOLS = {
  Algebra: [
    { label: 'Fraction', insert: '(a / b)', icon: 'a/b' },
    { label: 'Exponent', insert: 'x^n', icon: 'xⁿ' },
    { label: 'Subscript', insert: 'x_n', icon: 'xₙ' },
    { label: 'Square root', insert: '√(x)', icon: '√x' },
    { label: 'nth root', insert: 'ⁿ√(x)', icon: 'ⁿ√x' },
    { label: 'Absolute value', insert: '|x|', icon: '|x|' },
    { label: 'Plus-minus', insert: '±', icon: '±' },
    { label: 'Multiply', insert: '×', icon: '×' },
    { label: 'Divide', insert: '÷', icon: '÷' },
    { label: 'Not equal', insert: '≠', icon: '≠' },
    { label: 'Less or equal', insert: '≤', icon: '≤' },
    { label: 'Greater or equal', insert: '≥', icon: '≥' },
  ],
  Combinatorics: [
    { label: 'Combination (nCr)', insert: 'nCr(n, r)', icon: 'ⁿCᵣ' },
    { label: 'Permutation (nPr)', insert: 'nPr(n, r)', icon: 'ⁿPᵣ' },
    { label: 'Binomial', insert: 'binom(n, r)', icon: '(ⁿᵣ)' },
    { label: 'Factorial', insert: 'n!', icon: 'n!' },
  ],
  Complex: [
    { label: 'Modulus', insert: '|z|', icon: '|z|' },
    { label: 'Conjugate', insert: 'bar(z)', icon: 'z̄' },
    { label: 'Real part', insert: 'Re(z)', icon: 'Re(z)' },
    { label: 'Imaginary part', insert: 'Im(z)', icon: 'Im(z)' },
    { label: 'Argument', insert: 'arg(z)', icon: 'arg(z)' },
    { label: 'Polar form', insert: 'r * e^(i * θ)', icon: 'reⁱᵗ' },
    { label: 'Complex set', insert: 'ℂ', icon: 'ℂ' },
  ],
  Calculus: [
    { label: 'Derivative', insert: '(d / dx)(x)', icon: 'd/dx' },
    { label: 'Partial derivative', insert: '(∂ / ∂x)(x)', icon: '∂/∂x' },
    { label: 'Integral', insert: '∫ x dx', icon: '∫' },
    { label: 'Definite integral', insert: 'int[0→1] x dx', icon: '∫₀¹' },
    { label: 'Contour integral', insert: '∮ x dx', icon: '∮' },
    { label: 'Summation', insert: 'sum[i=1→n] x_i', icon: '∑' },
    { label: 'Product', insert: 'prod[i=1→n] x_i', icon: '∏' },
    { label: 'Limit', insert: 'lim[x→0] f(x)', icon: 'lim' },
  ],
  Vectors: [
    { label: 'Vector arrow', insert: 'vec(A)', icon: 'A⃗' },
    { label: 'Unit vector hat', insert: 'hat(i)', icon: 'î' },
    { label: 'Dot product', insert: '⋅', icon: '⋅' },
    { label: 'Cross product', insert: '×', icon: '×' },
    { label: 'Nabla', insert: '∇', icon: '∇' },
    { label: '2×2 Matrix', insert: 'matrix(a, b; c, d)', icon: '[a b]' },
    { label: 'Determinant', insert: 'det(a, b; c, d)', icon: '|a b|' },
    { label: 'Piecewise cases', insert: 'cases(x if x≤1, 5 if x>1)', icon: '{f(x)' },
  ],
  Sets: [
    { label: 'Element of', insert: '∈', icon: '∈' },
    { label: 'Not element of', insert: '∉', icon: '∉' },
    { label: 'Subset', insert: '⊂', icon: '⊂' },
    { label: 'Subset or equal', insert: '⊆', icon: '⊆' },
    { label: 'Union', insert: '∪', icon: '∪' },
    { label: 'Intersection', insert: '∩', icon: '∩' },
    { label: 'Therefore', insert: '∴', icon: '∴' },
    { label: 'Angle', insert: '∠', icon: '∠' },
    { label: 'Real numbers', insert: 'ℝ', icon: 'ℝ' },
    { label: 'Integers', insert: 'ℤ', icon: 'ℤ' },
    { label: 'Natural numbers', insert: 'ℕ', icon: 'ℕ' },
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
    { label: 'Chemical formula', insert: 'chem(H2O)', icon: 'H₂O' },
    { label: 'Physical unit', insert: 'unit(9.8 m/s^2)', icon: 'm/s²' },
  ],
};

export default function SymbolPalette({ onInsert }) {
  const [activeCategory, setActiveCategory] = useState('Algebra');
  const categories = Object.keys(CATEGORIZED_SYMBOLS);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#dcd5c4]">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 h-7 rounded-md text-xs font-medium transition-calm whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#1f1b16] text-[#fdfbf7]'
                : 'text-[#5e554a] hover:bg-[#efe9df] hover:text-[#1f1b16]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
        {CATEGORIZED_SYMBOLS[activeCategory].map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onInsert(item.insert)}
            className="px-2.5 h-8 bg-[#fdfbf7] hover:bg-[#efe9df] border border-[#dcd5c4] hover:border-[#8c4a17] rounded-md text-xs font-serif font-medium text-[#1f1b16] transition-calm active:scale-[0.98] flex items-center justify-center"
            title={`Insert ${item.label}`}
          >
            <span>{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
