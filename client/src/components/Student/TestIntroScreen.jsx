import React from 'react';
import { BookOpen, CheckCircle2, Play, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function TestIntroScreen({ testTitle, questionCount, studentName, onStartTest, onCancel }) {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1f1b16] py-8 sm:py-12 px-4 sm:px-6 flex items-center justify-center font-sans">
      <div className="max-w-xl w-full bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5e554a] hover:text-[#1f1b16]"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to student portal</span>
          </button>
        )}

        <div className="exam-rule-double pb-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#8c4a17]">
            <BookOpen className="w-4 h-4" strokeWidth={1.5} />
            <span>Examination cover sheet</span>
          </div>
          <h1 className="font-serif font-medium text-2xl sm:text-3xl text-[#1f1b16] leading-tight">
            {testTitle || 'Mathematics Assessment Paper'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#5e554a] font-mono tabular-nums pt-1">
            <span>{questionCount} {questionCount === 1 ? 'question' : 'questions'}</span>
            <span>•</span>
            <span>{questionCount * 4} marks</span>
            <span>•</span>
            <span>Candidate: <strong className="text-[#1f1b16] font-sans font-medium">{studentName}</strong></span>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-[#5e554a]">
          <h3 className="font-medium text-xs text-[#1f1b16]">
            Session instructions
          </h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#3f6b4a] shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>Navigate between questions using the palette on the right or the control bar below each item.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#3f6b4a] shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>Responses are saved in your session automatically, and you can review all items before final submission.</span>
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-[#f7f4ee] border border-[#b8622e] space-y-2 text-xs text-[#1f1b16]">
          <div className="font-medium flex items-center gap-2 text-[#b8622e]">
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>Proctoring and focus rules</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[#5e554a] leading-relaxed">
            <li>Switching tabs, minimizing the browser, or leaving the window is recorded.</li>
            <li>Three focus violations or 60 seconds of background inactivity will end the session with 0 marks.</li>
          </ul>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onStartTest}
            className="w-full h-11 px-6 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-sm transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Start examination</span>
            <Play className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
