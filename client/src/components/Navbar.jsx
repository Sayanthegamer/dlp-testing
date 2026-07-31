import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Printer, Award, Share2, Menu, X } from 'lucide-react';
import { checkServerHealth } from '../services/apiService';

export default function Navbar({ onReset, onOpenPrintView, onOpenSubmissions, onPublishExam }) {
  const [serverHealth, setServerHealth] = useState({ status: 'checking' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkServerHealth().then(res => setServerHealth(res));
  }, []);

  return (
    <header className="bg-[#fbf9f5] border-b border-[#e2dacd] px-4 sm:px-6 py-3.5 sm:py-4 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Branding & Exam Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2c2825] flex items-center justify-center text-[#fbf9f5] shadow-sm shrink-0">
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

        {/* Mobile Hamburger Toggle Button (Screen < sm) */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="sm:hidden p-2 rounded-xl text-[#2c2825] hover:bg-[#ede5d8] border border-[#e0d6c7] transition-colors shrink-0 ml-2"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Desktop Actions Bar (Screen >= sm) */}
        <div className="hidden sm:flex items-center gap-2.5">
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

      </div>

      {/* Mobile Collapsible Dropdown Panel */}
      {isMobileMenuOpen && (
        <div className="sm:hidden mt-3 pt-3 border-t border-[#e2dacd] space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f4eee4] border border-[#e0d6c7] text-xs text-[#5c5549]">
            {serverHealth.hasApiKey ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active API: <strong>{serverHealth.providers?.gemini === 'active' ? 'Gemini Flash' : 'Claude Sonnet'}</strong></span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Mode: <strong>Smart Demo Fallback</strong></span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); onOpenSubmissions(); }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#2c2825] text-[#fbf9f5] text-xs font-semibold shadow-xs active:scale-95"
            >
              <Award className="w-4 h-4 text-[#e6cca6]" />
              <span>Submissions</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); onPublishExam(); }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-800 text-white text-xs font-semibold shadow-xs active:scale-95"
            >
              <Share2 className="w-4 h-4 text-emerald-200" />
              <span>Publish Exam</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); onOpenPrintView(); }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#8c4a17] text-white text-xs font-semibold shadow-xs active:scale-95"
            >
              <Printer className="w-4 h-4 text-[#fbf9f5]" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); onReset(); }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-[#e0d6c7] text-[#5c5549] text-xs font-semibold shadow-xs active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#736c62]" />
              <span>New Test</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
