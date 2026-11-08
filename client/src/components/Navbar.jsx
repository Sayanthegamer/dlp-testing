import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  RefreshCw,
  Printer,
  Award,
  Share2,
  UploadCloud,
  LogOut,
  Users,
  GraduationCap
} from 'lucide-react';
import { checkServerHealth } from '../services/apiService';

export default function Navbar({
  activeTab,
  onSelectTab,
  onReset,
  onOpenPrintView,
  onOpenSubmissions,
  onSwitchToStudentPortal,
  onPublishExam,
  onLogout,
  onScrollToInput
}) {
  const [serverHealth, setServerHealth] = useState({ status: 'checking' });

  useEffect(() => {
    checkServerHealth().then(res => setServerHealth(res));
  }, []);

  return (
    <>
      <header className="bg-[#fdfbf7] border-b border-[#dcd5c4] px-4 sm:px-6 h-16 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
          {/* Left: Brand & Section Switcher */}
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#1f1b16] flex items-center justify-center text-[#fdfbf7] shrink-0">
                <BookOpen className="w-4 h-4 text-[#fdfbf7]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="font-serif font-medium text-base text-[#1f1b16] tracking-tight block truncate">
                  Math Exam Studio
                </span>
              </div>
            </div>

            {/* Quiet Section Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#efe9df] p-1 rounded-lg border border-[#dcd5c4]">
              <button
                type="button"
                onClick={() => onSelectTab('catalogue')}
                className={`px-3 h-7 rounded-md text-xs font-medium transition-calm ${
                  activeTab === 'catalogue'
                    ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                    : 'text-[#5e554a] hover:text-[#1f1b16]'
                }`}
              >
                Question paper
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('roster')}
                className={`px-3 h-7 rounded-md text-xs font-medium transition-calm flex items-center gap-1.5 ${
                  activeTab === 'roster'
                    ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                    : 'text-[#5e554a] hover:text-[#1f1b16]'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
                <span>Student roster</span>
              </button>
            </nav>
          </div>

          {/* Right: Quiet Actions & One Primary CTA */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Status indicator */}
            <span
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs text-[#7b7266] font-mono"
              title={serverHealth.hasApiKey ? 'Live AI extraction active' : 'Demo parser active'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverHealth.status === 'ok' ? 'bg-[#3f6b4a]' : 'bg-[#b8622e]'
                }`}
              />
              <span>{serverHealth.hasApiKey ? 'AI live' : 'Demo mode'}</span>
            </span>

            <button
              type="button"
              onClick={onSwitchToStudentPortal}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium border border-[#dcd5c4] transition-calm"
            >
              <GraduationCap className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
              <span>Student portal</span>
            </button>

            <button
              type="button"
              onClick={onOpenSubmissions}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium border border-[#dcd5c4] transition-calm"
            >
              <Award className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
              <span>Submissions</span>
            </button>

            <button
              type="button"
              onClick={onOpenPrintView}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] text-xs font-medium border border-[#dcd5c4] transition-calm"
            >
              <Printer className="w-4 h-4 text-[#5e554a]" strokeWidth={1.5} />
              <span>Print PDF</span>
            </button>

            <button
              type="button"
              onClick={onPublishExam}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4 text-[#fdfbf7]" strokeWidth={1.5} />
              <span>Publish exam</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              className="p-2 h-9 w-9 rounded-lg text-[#5e554a] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
              title="Reset paper to sample questions"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 h-9 w-9 rounded-lg text-[#5e554a] hover:text-[#dc2626] hover:bg-[#efe9df] transition-calm flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Mobile Header Controls (< sm) */}
          <div className="sm:hidden flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectTab(activeTab === 'roster' ? 'catalogue' : 'roster')}
              className="px-2.5 h-8 rounded-lg bg-[#efe9df] border border-[#dcd5c4] text-xs font-medium text-[#1f1b16]"
            >
              {activeTab === 'roster' ? 'Paper' : 'Roster'}
            </button>
            <button
              type="button"
              onClick={onSwitchToStudentPortal}
              className="px-2.5 h-8 rounded-lg bg-[#efe9df] border border-[#dcd5c4] text-xs font-medium text-[#1f1b16]"
            >
              Student
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 h-8 w-8 rounded-lg text-[#5e554a] bg-[#efe9df] border border-[#dcd5c4] flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Action Bar (< sm) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fdfbf7] border-t border-[#dcd5c4] px-3 py-2 flex items-center justify-around font-sans print:hidden">
        <button
          type="button"
          onClick={onScrollToInput}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[#5e554a] hover:text-[#1f1b16]"
        >
          <UploadCloud className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[11px] font-medium mt-1">Import</span>
        </button>

        <button
          type="button"
          onClick={onOpenSubmissions}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[#5e554a] hover:text-[#1f1b16]"
        >
          <Award className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[11px] font-medium mt-1">Grades</span>
        </button>

        <button
          type="button"
          onClick={onOpenPrintView}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[#5e554a] hover:text-[#1f1b16]"
        >
          <Printer className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[11px] font-medium mt-1">Print</span>
        </button>

        <button
          type="button"
          onClick={onPublishExam}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#1f1b16] text-[#fdfbf7] text-xs font-medium"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Publish</span>
        </button>
      </nav>
    </>
  );
}
