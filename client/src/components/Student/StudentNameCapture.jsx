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
    <div className="fixed inset-0 z-40 bg-[#FAF7F0] flex items-center justify-center p-4">
      <div className="bg-[#fcfbfa] border border-[#DCD5C4] rounded-3xl p-8 max-w-md w-full shadow-lg space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#232323] text-[#FAF7F0] flex items-center justify-center mx-auto shadow-md">
            <UserCheck className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-[#232323]">Candidate Identity</h2>
          <p className="text-xs text-[#5c5346] max-w-xs mx-auto">
            Please enter your name as it should appear on your examination script.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
              Student Full Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-[#DCD5C4] bg-white font-serif text-base text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#232323] shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <span>Proceed to Examination</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#8c8275] font-sans">
          This name is used to label your results paper for this session.
        </p>
      </div>
    </div>
  );
}
