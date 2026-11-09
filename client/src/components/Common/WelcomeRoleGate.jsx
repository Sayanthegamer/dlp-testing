import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  LogIn,
  UserPlus,
  Terminal,
  CheckCircle2,
  Sparkles,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

export default function WelcomeRoleGate({
  onSelectStudent,
  onSelectTeacher,
  onLaunchStudentDemo,
  onLaunchTeacherDemo,
}) {
  const [quickClassCode, setQuickClassCode] = useState('');

  const handleQuickJoinSubmit = (e) => {
    e.preventDefault();
    const clean = quickClassCode.trim().toUpperCase();
    onSelectStudent({
      tab: 'signup',
      classCode: clean.startsWith('CLASS-') ? clean : clean ? `CLASS-${clean}` : '',
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col justify-between font-sans text-[#1f1b16] selection:bg-[#ecdcc9]">
      {/* Top Header */}
      <header className="border-b border-[#dcd5c4] bg-[#fdfbf7]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1f1b16] text-[#fdfbf7] flex items-center justify-center font-serif text-lg font-bold shadow-2xs">
              ∑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-medium text-base text-[#1f1b16] tracking-tight">
                  Tuition Assessment System
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#efe9df] text-[#5e554a] border border-[#dcd5c4]">
                  v2.6
                </span>
              </div>
              <p className="text-[11px] text-[#7b7266] hidden sm:block">
                Autonomous Math & Science Examination Infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLaunchTeacherDemo}
              className="text-xs font-medium text-[#5e554a] hover:text-[#1f1b16] px-3 py-1.5 rounded-lg hover:bg-[#efe9df] transition-calm flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
              <span className="hidden md:inline">Open</span> Demo Studio
            </button>
          </div>
        </div>
      </header>

      {/* Main Role Chooser Cards */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#efe9df] border border-[#dcd5c4] text-[#8c4a17] text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Welcome to the Examination Platform</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-medium text-[#1f1b16] tracking-tight">
            Select your portal to begin
          </h1>
          <p className="text-sm text-[#5e554a]">
            Unified assessment ecosystem designed for precision math typesetting, verified LaTeX formulas, and frictionless student evaluations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto w-full">
          {/* Card 1: Student / Candidate */}
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between transition-calm hover:shadow-md hover:border-[#bdae97]">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#eef3f0] border border-[#cbe0d3] text-[#2b5a38] flex items-center justify-center shadow-2xs">
                  <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#efe9df] text-[#5e554a] border border-[#dcd5c4]">
                  Candidate
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-medium text-[#1f1b16]">
                  I am a Student / Candidate
                </h2>
                <p className="text-xs text-[#5e554a] mt-1.5 leading-relaxed">
                  Register with your Name & DOB, connect with your teacher's classroom code, and take proctored examinations.
                </p>
              </div>

              {/* Quick join by class code */}
              <form onSubmit={handleQuickJoinSubmit} className="pt-2">
                <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
                  Have a Classroom Code?
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={quickClassCode}
                      onChange={(e) => setQuickClassCode(e.target.value.toUpperCase())}
                      placeholder="CLASS-XXXXXX"
                      className="w-full pl-8 pr-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#f7f4ee] font-mono text-xs uppercase tracking-wider text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-[#7b7266] absolute left-2.5 top-2.5" strokeWidth={1.5} />
                  </div>
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-lg bg-[#2b5a38] hover:bg-[#23472d] text-[#fdfbf7] text-xs font-medium transition-calm shrink-0 flex items-center gap-1"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              </form>

              {/* 3-Step Checklist */}
              <div className="pt-3 border-t border-[#dcd5c4] space-y-2.5">
                <p className="text-[11px] font-medium text-[#5e554a] uppercase tracking-wider">
                  How candidate onboarding works:
                </p>
                <div className="space-y-2 text-xs text-[#5e554a]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2b5a38] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Enter Name & DOB to receive permanent Roll No. (<span className="font-mono">DLP-26-XXXXX</span>) & QR ticket</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2b5a38] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Join classroom via <span className="font-mono font-medium text-[#1f1b16]">CLASS-XXXXXX</span> code or invite link</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2b5a38] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Take live exams with 6-digit passcodes and instant scorecards</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-6 mt-6 border-t border-[#dcd5c4] space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectStudent({ tab: 'login' })}
                  className="h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Student Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectStudent({ tab: 'signup' })}
                  className="h-10 px-4 rounded-lg border border-[#dcd5c4] bg-[#f7f4ee] hover:bg-[#efe9df] text-[#1f1b16] text-xs font-medium transition-calm flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                  <span>New Registration</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onLaunchStudentDemo}
                  className="text-xs font-medium text-[#8c4a17] hover:underline flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Try Demo Candidate (1-click)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Teacher / Instructor */}
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between transition-calm hover:shadow-md hover:border-[#bdae97]">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#f8efe6] border border-[#e8d2be] text-[#8c4a17] flex items-center justify-center shadow-2xs">
                  <BookOpen className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#efe9df] text-[#5e554a] border border-[#dcd5c4]">
                  Instructor
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-medium text-[#1f1b16]">
                  I am a Teacher / Instructor
                </h2>
                <p className="text-xs text-[#5e554a] mt-1.5 leading-relaxed">
                  Typeset test papers, generate live rolling exam passcodes, manage class rosters, and review auto-graded submissions.
                </p>
              </div>

              {/* Feature highlight badge */}
              <div className="p-3 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4] space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#1f1b16]">
                  <ShieldCheck className="w-4 h-4 text-[#8c4a17]" strokeWidth={1.5} />
                  <span>Multi-Tenant Classrooms & Rolling Passcodes</span>
                </div>
                <p className="text-[11px] text-[#5e554a] leading-relaxed">
                  Every teacher gets a permanent <span className="font-mono text-[#1f1b16] font-medium">CLASS-XXXXXX</span> code. Share once via WhatsApp or email.
                </p>
              </div>

              {/* 3-Step Checklist */}
              <div className="pt-3 border-t border-[#dcd5c4] space-y-2.5">
                <p className="text-[11px] font-medium text-[#5e554a] uppercase tracking-wider">
                  How instructor workflow works:
                </p>
                <div className="space-y-2 text-xs text-[#5e554a]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Typeset questions with Gemini AI OCR, LaTeX math, & Word OMML parser</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Share your permanent Classroom Code or 1-click invite link with students</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Launch exams with 5-minute rolling codes and review real-time scorecards</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-6 mt-6 border-t border-[#dcd5c4] space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTeacher({ mode: 'login' })}
                  className="h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Teacher Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTeacher({ mode: 'signup' })}
                  className="h-10 px-4 rounded-lg border border-[#dcd5c4] bg-[#f7f4ee] hover:bg-[#efe9df] text-[#1f1b16] text-xs font-medium transition-calm flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
                  <span>Register as Teacher</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onLaunchTeacherDemo}
                  className="text-xs font-medium text-[#8c4a17] hover:underline flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Open Demo Studio (Instant evaluation)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dcd5c4] bg-[#fdfbf7]/60 py-4 text-center text-xs text-[#7b7266]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Tuition Assessment Platform © 2026. All rights reserved.</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Fast KaTeX Rendering</span>
            <span>•</span>
            <span>Multi-Tenant Roster</span>
            <span>•</span>
            <span>AI Diagram Matcher</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
