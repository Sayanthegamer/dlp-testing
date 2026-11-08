import React, { useState, useEffect } from 'react';
import { Calendar, Contact, LogIn, UserPlus, ShieldAlert, Terminal, RefreshCw, ArrowLeft } from 'lucide-react';
import { loginStudent, signupStudent, generateAdmissionNumber } from '../../services/apiService';

export default function StudentAuthModal({ onStudentAuthenticated, onLaunchDevDemo, onBackToTeacher }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [fullName, setFullName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAdm = params.get('adm') || params.get('admissionNumber');
      const urlDob = params.get('dob');
      if (urlAdm) setAdmissionNumber(urlAdm.trim().toUpperCase());
      if (urlDob) setDob(urlDob.trim());
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'signup' && !admissionNumber) {
      setAdmissionNumber(generateAdmissionNumber());
    }
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !dob) {
      setError('Enter your admission number and date of birth');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await loginStudent(admissionNumber.trim(), dob);
      if (res && res.student) {
        onStudentAuthenticated(res.student);
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your admission number and date of birth.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !fullName.trim() || !dob || !teacherCode.trim()) {
      setError('Fill in all fields including your teacher access code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await signupStudent(admissionNumber.trim(), fullName.trim(), dob, teacherCode.trim());
      if (res && res.student) {
        onStudentAuthenticated(res.student);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Verify your teacher code and details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col justify-center items-center p-4 font-sans">
      <div className="max-w-md w-full space-y-4">
        {onBackToTeacher && (
          <button
            type="button"
            onClick={onBackToTeacher}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5e554a] hover:text-[#1f1b16]"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to teacher studio</span>
          </button>
        )}

        <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] flex items-center justify-center">
              <Contact className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-serif font-medium text-[#1f1b16] pt-1">
              Student examination portal
            </h2>
            <p className="text-xs text-[#5e554a]">
              Sign in with your roll number and date of birth to enter an exam session or view scorecards
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-[#efe9df] p-1 rounded-lg border border-[#dcd5c4]">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(''); }}
              className={`h-8 rounded-md text-xs font-medium transition-calm flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Sign in</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setError(''); }}
              className={`h-8 rounded-md text-xs font-medium transition-calm flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs'
                  : 'text-[#5e554a] hover:text-[#1f1b16]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Register</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#5e554a] mb-1.5">
                  Admission / roll number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                    placeholder="DLP-26-8K39X"
                    className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums focus:outline-none focus:border-[#8c4a17]"
                    required
                  />
                  <Contact className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5e554a] mb-1.5">
                  Date of birth
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums focus:outline-none focus:border-[#8c4a17]"
                    required
                  />
                  <Calendar className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? 'Signing in' : 'Enter student portal'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#5e554a] mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full px-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-medium text-[#5e554a]">
                    Admission / roll number
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdmissionNumber(generateAdmissionNumber())}
                    className="text-[11px] font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value.replace(/[^A-Za-z0-9_\-]/g, '').toUpperCase())}
                    placeholder="DLP-26-8K39X"
                    className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums font-medium focus:outline-none focus:border-[#8c4a17]"
                    required
                  />
                  <Contact className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5e554a] mb-1.5">
                  Date of birth
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums focus:outline-none focus:border-[#8c4a17]"
                    required
                  />
                  <Calendar className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5e554a] mb-1.5">
                  Teacher access code
                </label>
                <input
                  type="text"
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  placeholder="Enter teacher passcode"
                  className="w-full px-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-xs font-mono text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? 'Registering' : 'Complete registration'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-[#dcd5c4] flex items-center justify-between text-xs">
            <span className="text-[#7b7266]">Quick evaluation</span>
            <button
              type="button"
              onClick={onLaunchDevDemo}
              className="inline-flex items-center gap-1.5 font-medium text-[#8c4a17] hover:underline"
            >
              <Terminal className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Enter demo candidate mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
