import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Printer, Award, Share2, UploadCloud, FileText } from 'lucide-react';
import { checkServerHealth } from '../services/apiService';

export default function Navbar({ onReset, onOpenPrintView, onOpenSubmissions, onPublishExam, onScrollToInput }) {
  const [serverHealth, setServerHealth] = useState({ status: 'checking' });

  useEffect(() => {
    checkServerHealth().then(res => setServerHealth(res));
  }, []);

  return (
    <>
      {/* Top Main Navbar */}
      <header className="bg-[#fbf9f5] border-b border-[#e2dacd] px-4 sm:px-6 py-3 sm:py-4 shadow-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Branding & Exam Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2c2825] flex items-center justify-center text-[#fbf9f5] shadow-xs shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#e6cca6]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif font-bold text-base sm:text-lg text-[#1c1b18] tracking-tight truncate">
                Exam Paper Math Builder
              </h1>
              <p className="text-[11px] sm:text-xs text-[#736c62] font-sans truncate">
                Google Forms Style Math Catalogue & Editor
              </p>
            </div>
          </div>

          {/* Desktop Actions Bar (Screen >= sm) */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f4eee4] border border-[#e0d6c7] text-xs text-[#5c5549]">
              {serverHealth.hasApiKey ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active API Engine: <strong>{serverHealth.providers?.gemini === 'active' ? 'Gemini Flash' : 'Claude Sonnet'}</strong></span>
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
              className="btn-shimmer flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2c2825] hover:bg-[#1c1b18] text-[#fbf9f5] text-xs font-semibold shadow-xs transition-all active:scale-95"
              title="Open Teacher Submissions Dashboard"
            >
              <Award className="w-4 h-4 text-[#e6cca6]" />
              <span>Submissions & Grading</span>
            </button>

            {/* Publish Exam & Share Link Button */}
            <button
              type="button"
              onClick={onPublishExam}
              className="btn-shimmer flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
              title="Freeze exam and generate shareable student link"
            >
              <Share2 className="w-4 h-4 text-emerald-200" />
              <span>Publish Exam</span>
            </button>

            {/* Print / Save PDF Export Button */}
            <button
              type="button"
              onClick={onOpenPrintView}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
              title="Print or Export Exam Paper PDF"
            >
              <Printer className="w-4 h-4 text-[#fbf9f5]" />
              <span>Print / Export PDF</span>
            </button>

            {/* Reset Action */}
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#5c5549] hover:bg-[#ede5d8] border border-[#e0d6c7] transition-all"
              title="Clear catalogue and start fresh"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#736c62]" />
              <span>New Test</span>
            </button>
          </div>

          {/* Quick Header Reset for Mobile (< sm) */}
          <div className="sm:hidden flex items-center gap-1.5">
            <button
              type="button"
              onClick={onReset}
              className="p-2 rounded-xl text-[#5c5549] bg-white border border-[#e0d6c7] text-xs font-medium shadow-2xs"
              title="New Test"
            >
              <RefreshCw className="w-4 h-4 text-[#736c62]" />
            </button>
          </div>

        </div>
      </header>

      {/* App-Native Mobile Bottom Action Dock (< sm) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fbf9f5] border-t border-[#e2dacd] px-2 py-2 shadow-lg flex items-center justify-around font-sans print:hidden">
        <button
          type="button"
          onClick={onScrollToInput}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[#5c5346] active:bg-[#ede5d8] transition-colors"
        >
          <UploadCloud className="w-5 h-5 text-[#8c4a17]" />
          <span className="text-[10px] font-semibold mt-0.5">Upload</span>
        </button>

        <button
          type="button"
          onClick={onOpenSubmissions}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[#5c5346] active:bg-[#ede5d8] transition-colors"
        >
          <Award className="w-5 h-5 text-[#2c2825]" />
          <span className="text-[10px] font-semibold mt-0.5">Grades</span>
        </button>

        <button
          type="button"
          onClick={onPublishExam}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-emerald-800 active:bg-emerald-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <Share2 className="w-4 h-4 text-emerald-200" />
          </div>
          <span className="text-[10px] font-bold text-emerald-900 mt-0.5">Publish</span>
        </button>

        <button
          type="button"
          onClick={onOpenPrintView}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[#5c5346] active:bg-[#ede5d8] transition-colors"
        >
          <Printer className="w-5 h-5 text-[#8c4a17]" />
          <span className="text-[10px] font-semibold mt-0.5">Print/PDF</span>
        </button>
      </nav>
    </>
  );
}
