import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Printer, Award } from 'lucide-react';
import { checkServerHealth } from '../services/apiService';

export default function Navbar({ onReset, onOpenPrintView, onOpenSubmissions }) {
  const [serverHealth, setServerHealth] = useState({ status: 'checking' });

  useEffect(() => {
    checkServerHealth().then(res => setServerHealth(res));
  }, []);

  return (
    <header className="bg-[#fbf9f5] border-b border-[#e2dacd] px-6 py-4 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Branding & Exam Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2c2825] flex items-center justify-center text-[#fbf9f5] shadow-sm">
            <BookOpen className="w-5 h-5 text-[#e6cca6]" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-[#1c1b18] tracking-tight">
              Exam Paper Math Builder
            </h1>
            <p className="text-xs text-[#736c62] font-sans">
              Google Forms Style Math Catalogue & Floating Editor
            </p>
          </div>
        </div>

        {/* Server & Print Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f4eee4] border border-[#e0d6c7] text-xs text-[#5c5549]">
            {serverHealth.hasApiKey ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active API Engine: <strong>{serverHealth.providers?.gemini === 'active' ? 'Gemini 3.5 Flash Lite' : 'Claude Sonnet'}</strong></span>
              </>
            ) : serverHealth.status === 'ok' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Mode: <strong>Smart Demo Fallback</strong></span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                <span>Checking Server...</span>
              </>
            )}
          </div>

          {/* Submissions Dashboard Button */}
          <button
            type="button"
            onClick={onOpenSubmissions}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2c2825] hover:bg-[#1c1b18] text-[#fbf9f5] text-xs font-semibold shadow-xs transition-all active:scale-95"
            title="Open Teacher Submissions Dashboard"
          >
            <Award className="w-4 h-4 text-[#e6cca6]" />
            <span className="hidden sm:inline">Submissions & Grading</span>
          </button>

          {/* Print / Save PDF Export Button */}
          <button
            type="button"
            onClick={onOpenPrintView}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            title="Print or Export Exam Paper PDF"
          >
            <Printer className="w-4 h-4 text-[#fbf9f5]" />
            <span className="hidden sm:inline">Print / Export PDF</span>
          </button>

          {/* Reset Action */}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#5c5549] hover:bg-[#ede5d8] border border-[#e0d6c7] transition-all"
            title="Clear catalogue and start fresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#736c62]" />
            <span className="hidden sm:inline">New Test</span>
          </button>
        </div>

      </div>
    </header>
  );
}
