import React from 'react';
import { BookOpen, FileText, CheckCircle2, Play } from 'lucide-react';

export default function TestIntroScreen({ testTitle, questionCount, studentName, onStartTest }) {
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#232323] py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-xl w-full bg-[#fcfbfa] border border-[#DCD5C4] rounded-3xl p-8 sm:p-10 shadow-lg space-y-8 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="border-b border-[#DCD5C4] pb-6 space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold uppercase tracking-widest text-[#8c4a17]">
            <BookOpen className="w-4 h-4" />
            <span>Online Tuition Assessment</span>
          </div>
          <h1 className="font-serif font-bold text-3xl text-[#232323] leading-tight">
            {testTitle || 'Mathematics Test Paper'}
          </h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#5c5346] font-sans pt-1">
            <span className="flex items-center gap-1.5 bg-[#f0e6d8] px-3 py-1 rounded-full font-medium">
              <FileText className="w-3.5 h-3.5" />
              {questionCount} {questionCount === 1 ? 'Question' : 'Questions'}
            </span>
            <span className="bg-[#f0e6d8] px-3 py-1 rounded-full font-medium">
              Candidate: <strong className="text-[#232323]">{studentName}</strong>
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-4 text-sm font-serif leading-relaxed text-[#3a352e]">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#5c5346]">
            Examination Guidelines
          </h3>
          <ul className="space-y-2.5 text-xs sm:text-sm font-sans text-[#4a4237]">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" />
              <span>Answer each question sequentially using the <strong>Next</strong> and <strong>Previous</strong> controls.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" />
              <span>For Multiple Choice questions, click directly on an option to select your answer.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#8c4a17] shrink-0 mt-0.5" />
              <span>Your progress is stored automatically during the session. You may review all answers before final submission.</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onStartTest}
            className="w-full py-4 px-6 rounded-2xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-base shadow-md transition-all active:scale-98 flex items-center justify-center gap-3"
          >
            <span>Begin Examination</span>
            <Play className="w-5 h-5 fill-current" />
          </button>
        </div>

      </div>
    </div>
  );
}
