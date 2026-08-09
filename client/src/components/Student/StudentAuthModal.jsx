import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Contact, LogIn, UserPlus, ShieldAlert, Sparkles, Terminal, RefreshCw } from 'lucide-react';
import { loginStudent, signupStudent, generateAdmissionNumber } from '../../services/apiService';

export default function StudentAuthModal({ onStudentAuthenticated, onLaunchDevDemo }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [fullName, setFullName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'signup' && !admissionNumber) {
      setAdmissionNumber(generateAdmissionNumber());
    }
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !dob) {
      setError('Please enter your Admission Number and Date of Birth.');
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
      setError(err.message || 'Login failed. Please check your Admission Number & DOB.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !fullName.trim() || !dob) {
      setError('Please fill in all required fields.');
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
      setError(err.message || 'Registration failed. Admission number may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-800/10 border border-amber-800/20 text-[#8c4a17] flex items-center justify-center shadow-xs">
            <Contact className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#2c2825]">
            Student Examination Portal
          </h2>
          <p className="text-xs sm:text-sm text-[#736c62] font-sans">
            Log in with your Admission Number & Date of Birth to access tests & history
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#f0e6d8] p-1 rounded-2xl mb-6 border border-[#dcd0be]">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-[#8c4a17] shadow-xs'
                : 'text-[#6b6255] hover:text-[#2c2825]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Student Login</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setError(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-sans font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'signup'
                ? 'bg-white text-[#8c4a17] shadow-xs'
                : 'text-[#6b6255] hover:text-[#2c2825]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Student Register</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-sans flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 font-sans text-xs">
            <div>
              <label className="block text-xs font-bold text-[#4a4237] mb-1">
                Admission / Roll Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ADM-2026-001"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] font-mono focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                  required
                />
                <Contact className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a4237] mb-1">
                Date of Birth (DOB) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] font-sans focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                  required
                />
                <Calendar className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#8c4a17] hover:bg-[#733b11] text-white font-sans font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Enter Student Portal'}
            </button>
          </form>
        ) : (
          /* Signup Form */
          <form onSubmit={handleSignup} className="space-y-4 font-sans text-xs">
            <div>
              <label className="block text-xs font-bold text-[#4a4237] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#4a4237]">
                  Admission / Roll Number <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAdmissionNumber(generateAdmissionNumber())}
                  className="text-[11px] font-bold text-[#8c4a17] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto-Generate</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                  placeholder="Auto-generated e.g. ADM8K9P2"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                  required
                />
                <Contact className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a4237] mb-1">
                Date of Birth (DOB) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] font-sans focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                  required
                />
                <Calendar className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a4237] mb-1">
                Teacher Code / Batch ID (Optional)
              </label>
              <input
                type="text"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Optional teacher code"
                className="w-full px-3 py-2 rounded-xl border border-[#c9bea9] bg-white text-xs text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#8c4a17] hover:bg-[#733b11] text-white font-sans font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Registering...' : 'Complete Registration'}
            </button>
          </form>
        )}

        {/* Dev / Demo Mode Shortcut Divider */}
        <div className="mt-6 pt-4 border-t border-[#e2d8ca] text-center space-y-2">
          <span className="text-[11px] text-[#8c8275] font-sans block uppercase tracking-wider font-semibold">
            Developer & Test Runner Shortcut
          </span>
          <button
            type="button"
            onClick={onLaunchDevDemo}
            className="w-full py-2 px-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-sans font-bold text-xs hover:bg-purple-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-purple-700" />
            <span>Launch Dev Demo Exam Mode (No Account Required)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
