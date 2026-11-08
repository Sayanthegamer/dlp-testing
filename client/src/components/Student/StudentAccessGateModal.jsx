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
        throw new Error(data.error || 'Invalid or expired rolling passcode.');
      }

      localStorage.setItem('student_name', data.studentName);
      localStorage.setItem('student_rolling_code', data.rollingCodeUsed);

      if (typeof onAuthenticated === 'function') {
        onAuthenticated(data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Access denied. Please check your 6-digit rolling passcode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1f1b16]/75 flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-xl p-7 max-w-md w-full shadow-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2.5 exam-rule-double pb-4">
          <div className="w-11 h-11 rounded-lg bg-[#1f1b16] text-[#fdfbf7] flex items-center justify-center mx-auto">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h2 className="font-serif font-semibold text-xl text-[#1f1b16]">Candidate exam entrance</h2>
          <p className="text-xs text-[#5e554a] max-w-xs mx-auto leading-relaxed">
            Enter your full name and the 6-digit rolling passcode displayed on the classroom screen.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-[#a63a2b]/10 border border-[#a63a2b]/30 text-[#a63a2b] text-xs flex items-center gap-2 font-sans">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Access Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
              Candidate full name
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                required
                autoFocus
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-[#dcd5c4] bg-white font-sans text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
              />
              <User className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
              6-digit rolling passcode <span className="text-[#8c4a17]">(Required)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={rollingCode}
                onChange={(e) => setRollingCode(e.target.value)}
                placeholder="e.g. 849201"
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-[#dcd5c4] bg-white font-mono font-semibold text-base tracking-[0.2em] text-[#8c4a17] focus:outline-none focus:border-[#8c4a17] tabular-nums"
              />
              <KeyRound className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-[#8c4a17] hover:bg-[#733c12] text-white font-sans font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{isSubmitting ? 'Verifying session...' : 'Enter exam session'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#7b7266] font-sans">
          Protected session gate • Rolling codes refresh every 5 minutes
        </p>
      </div>
    </div>
  );
}
