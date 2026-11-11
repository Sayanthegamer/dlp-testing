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
    checkServerHealth().then((res) => setServerHealth(res));
  }, []);

  return (
    <>
      <header className="bg-exam-card border-b border-exam-border px-4 sm:px-6 h-16 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
          {/* Left: Brand & Section Switcher */}
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md bg-exam-ink flex items-center justify-center text-exam-card shrink-0">
                <BookOpen className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <span className="font-serif font-medium text-base text-exam-ink tracking-tight block truncate">
                Teacher Studio
              </span>
            </div>

            {/* Quiet Section Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-paper-300 p-1 rounded-md border border-exam-border">
              <button
                type="button"
                onClick={() => onSelectTab('catalogue')}
                className={`px-3 h-8 rounded-sm text-sm font-medium transition-calm ${
                  activeTab === 'catalogue'
                    ? 'bg-exam-card text-exam-ink shadow-2xs'
                    : 'text-exam-secondary hover:text-exam-ink'
                }`}
              >
                Question paper
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('roster')}
                className={`px-3 h-8 rounded-sm text-sm font-medium transition-calm flex items-center gap-1.5 ${
                  activeTab === 'roster'
                    ? 'bg-exam-card text-exam-ink shadow-2xs'
                    : 'text-exam-secondary hover:text-exam-ink'
                }`}
              >
                <Users className="w-4 h-4 text-exam-muted" strokeWidth={1.5} />
                <span>Roster</span>
              </button>
            </nav>
          </div>

          {/* Right: Quiet Actions & Single Primary Action */}
          <div className="hidden sm:flex items-center gap-2">
            <span
              className="hidden lg:inline-flex items-center gap-2 px-2.5 h-8 rounded-md text-xs text-exam-muted font-mono"
              title={serverHealth.hasApiKey ? 'AI extraction online' : 'Offline sample parser'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serverHealth.status === 'ok' ? 'bg-exam-positive' : 'bg-exam-warn'
                }`}
              />
              <span>{serverHealth.hasApiKey ? 'Parser online' : 'Sample mode'}</span>
            </span>

            <button
              type="button"
              onClick={onSwitchToStudentPortal}
              className="flex items-center gap-2 px-3 h-9 rounded-md bg-paper-300 hover:bg-paper-400/50 text-exam-ink text-sm font-medium border border-exam-border transition-calm"
            >
              <GraduationCap className="w-4 h-4 text-exam-secondary" strokeWidth={1.5} />
              <span>Student view</span>
            </button>

            <button
              type="button"
              onClick={onOpenSubmissions}
              className="flex items-center gap-2 px-3 h-9 rounded-md bg-paper-300 hover:bg-paper-400/50 text-exam-ink text-sm font-medium border border-exam-border transition-calm"
            >
              <Award className="w-4 h-4 text-exam-secondary" strokeWidth={1.5} />
              <span>Submissions</span>
            </button>

            <button
              type="button"
              onClick={onOpenPrintView}
              className="flex items-center gap-2 px-3 h-9 rounded-md bg-paper-300 hover:bg-paper-400/50 text-exam-ink text-sm font-medium border border-exam-border transition-calm"
            >
              <Printer className="w-4 h-4 text-exam-secondary" strokeWidth={1.5} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onPublishExam}
              className="flex items-center gap-2 px-4 h-9 rounded-md bg-exam-ink hover:opacity-90 text-exam-card text-sm font-medium transition-calm"
            >
              <Share2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Publish paper</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              className="p-2 h-9 w-9 rounded-md text-exam-secondary hover:text-exam-ink hover:bg-paper-300 transition-calm flex items-center justify-center"
              title="Reset paper to default sample"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 h-9 w-9 rounded-md text-exam-secondary hover:text-exam-negative hover:bg-paper-300 transition-calm flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Mobile Header Controls */}
          <div className="sm:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTab(activeTab === 'roster' ? 'catalogue' : 'roster')}
              className="px-3 h-8 rounded-md bg-paper-300 border border-exam-border text-sm font-medium text-exam-ink"
            >
              {activeTab === 'roster' ? 'Paper' : 'Roster'}
            </button>
            <button
              type="button"
              onClick={onSwitchToStudentPortal}
              className="px-3 h-8 rounded-md bg-paper-300 border border-exam-border text-sm font-medium text-exam-ink"
            >
              Student
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 h-8 w-8 rounded-md text-exam-secondary bg-paper-300 border border-exam-border flex items-center justify-center"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Action Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-exam-card border-t border-exam-border px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around font-sans print:hidden">
        <button
          type="button"
          onClick={onScrollToInput}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-md text-exam-secondary hover:text-exam-ink"
        >
          <UploadCloud className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-xs font-medium mt-1">Import</span>
        </button>

        <button
          type="button"
          onClick={onOpenSubmissions}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-md text-exam-secondary hover:text-exam-ink"
        >
          <Award className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-xs font-medium mt-1">Grades</span>
        </button>

        <button
          type="button"
          onClick={onOpenPrintView}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-md text-exam-secondary hover:text-exam-ink"
        >
          <Printer className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-xs font-medium mt-1">Print</span>
        </button>

        <button
          type="button"
          onClick={onPublishExam}
          className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-exam-ink text-exam-card text-sm font-medium"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.5} />
          <span>Publish</span>
        </button>
      </nav>
    </>
  );
}
