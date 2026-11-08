import React, { useState } from 'react';
import { UserCheck, ArrowRight } from 'lucide-react';

export default function StudentNameCapture({ defaultName = '', onNameSubmit }) {
  const [nameInput, setNameInput] = useState(defaultName);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onNameSubmit(nameInput.trim());
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#f7f4ee] flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-7 max-w-md w-full shadow-sm space-y-6">
        <div className="text-center space-y-2.5 exam-rule-double pb-4">
          <div className="w-11 h-11 rounded-lg bg-[#1f1b16] text-[#fdfbf7] flex items-center justify-center mx-auto">
            <UserCheck className="w-5 h-5" />
          </div>
          <h2 className="font-serif font-semibold text-xl text-[#1f1b16]">Candidate identity</h2>
          <p className="text-xs text-[#5e554a] max-w-xs mx-auto leading-relaxed">
            Enter your full name as it should appear on your examination script.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
              Candidate full name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#dcd5c4] bg-white font-serif text-base text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-[#8c4a17] hover:bg-[#733c12] text-white font-sans font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Proceed to examination</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#7b7266] font-sans">
          This name is printed on your graded submission record for this session.
        </p>
      </div>
    </div>
  );
}
