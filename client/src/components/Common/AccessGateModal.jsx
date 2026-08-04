import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldAlert, User, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { loginTeacher, signupTeacher } from '../../services/apiService';

export default function AccessGateModal({ onAuthenticated }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (authMode === 'signup') {
        if (!email || !password || !accessCode) {
          setErrorMsg('Email, password, and access code are required.');
          setIsSubmitting(false);
          return;
        }
        const res = await signupTeacher(email, password, fullName, accessCode);
        if (res.token) {
          onAuthenticated();
        } else {
          setSuccessMsg(res.message || 'Account created! Please check your email for a confirmation link before logging in.');
          setAuthMode('login');
          setPassword('');
        }
      } else {
        if (!email || !password) return;
        await loginTeacher(email, password);
        onAuthenticated();
      }
    } catch (err) {
      let msg = err.message || 'Authentication failed. Please check your credentials.';
      if (typeof msg === 'object' || msg === '{}' || msg === '[object Object]') {
        msg = 'Authentication failed. Please check your credentials or server configuration.';
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/85 flex items-center justify-center p-4">
      <div className="bg-[#fcfbfa] border border-[#dcd2c4] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-[#1c1b18]">
            {authMode === 'signup' ? 'Create Teacher Account' : 'Teacher Login'}
          </h2>
          <p className="text-xs text-[#736c62] max-w-xs mx-auto">
            {authMode === 'signup'
              ? 'Sign up with your teacher email and shared access code.'
              : 'Sign in to access your persistent tests, drafts, and analytics.'}
          </p>
        </div>

        {/* Toggle Mode Tabs */}
        <div className="flex items-center justify-center gap-1 bg-[#efe8dc] p-1 rounded-xl text-xs font-semibold text-[#5c5346]">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${authMode === 'login' ? 'bg-white shadow-xs text-[#1c1b18]' : 'hover:text-[#1c1b18]'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${authMode === 'signup' ? 'bg-white shadow-xs text-[#1c1b18]' : 'hover:text-[#1c1b18]'}`}
          >
            Sign Up
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-sans font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-sans font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prof. Smith"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
                />
                <User className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">Teacher Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                required
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
              />
              <Mail className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#c9bea9] bg-white text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
              />
              <KeyRound className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
            </div>
          </div>

          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">Access Code</label>
              <div className="relative">
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Shared access code..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#c9bea9] bg-white font-mono text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
                />
                <ShieldCheck className="w-4 h-4 text-[#8c8275] absolute left-3 top-3" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white font-serif font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Authenticating...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#8c8275] font-sans">
          Powered by Supabase Auth & PostgreSQL Security
        </p>

      </div>
    </div>
  );
}


