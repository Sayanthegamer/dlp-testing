import React, { useState } from 'react';
import { GraduationCap, KeyRound, ArrowRight, ShieldAlert, User } from 'lucide-react';

export default function StudentAccessGateModal({ examId, onAuthenticated }) {
  const [studentName, setStudentName] = useState('');
  const [rollingCode, setRollingCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !rollingCode.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/exams/student-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          rollingCode: rollingCode.trim(),
          examId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired Rolling Passcode.');
      }

      localStorage.setItem('student_name', data.studentName);
      localStorage.setItem('student_rolling_code', data.rollingCodeUsed);

      if (typeof onAuthenticated === 'function') {
        onAuthenticated(data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Access denied. Please check your Rolling Code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/85 flex items-center justify-center p-4">
      <div className="bg-[#FAF7F0] border border-[#DCD5C4] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#232323] text-[#FAF7F0] flex items-center justify-center mx-auto shadow-md">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-[#232323]">Student Exam Entrance</h2>
          <p className="text-xs text-[#5c5346] max-w-xs mx-auto">
            Please enter your full name and the current live 6-digit Rolling Code provided by your teacher.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-sans font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Access Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
              Student Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                required
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DCD5C4] bg-white font-sans text-sm text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#232323] shadow-inner"
              />
              <User className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
              6-Digit Rolling Code
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={rollingCode}
                onChange={(e) => setRollingCode(e.target.value)}
                placeholder="e.g. 849201"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#DCD5C4] bg-white font-mono font-bold text-base tracking-widest text-[#8c4a17] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
              />
              <KeyRound className="w-5 h-5 text-[#8c8275] absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Verifying Session...' : 'Enter Exam Session'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#8c8275] font-sans">
          Protected Session Gate • Rolling codes refresh per teacher session
        </p>

      </div>
    </div>
  );
}

