import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldAlert, User, Mail, ShieldCheck, CheckCircle2, ArrowLeft, GraduationCap } from 'lucide-react';
import { loginTeacher, signupTeacher } from '../../services/apiService';

export default function AccessGateModal({
  onAuthenticated,
  initialMode = 'login',
  onBackToPortalChooser,
  onSwitchToStudentPortal,
}) {
  const [authMode, setAuthMode] = useState(initialMode); // 'login' or 'signup'
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
          setErrorMsg('Email, password, and access code are required');
          setIsSubmitting(false);
          return;
        }
        const res = await signupTeacher(email, password, fullName, accessCode);
        if (res.token) {
          onAuthenticated();
        } else {
          setSuccessMsg(res.message || 'Account created. Check your email for a confirmation link before signing in.');
          setAuthMode('login');
          setPassword('');
        }
      } else {
        if (!email || !password) return;
        await loginTeacher(email, password);
        onAuthenticated();
      }
    } catch (err) {
      let msg = err.message || 'Authentication failed. Check your credentials.';
      if (typeof msg === 'object' || msg === '{}' || msg === '[object Object]') {
        msg = 'Authentication failed. Check your credentials or server configuration.';
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccess = () => {
    localStorage.setItem('teacher_auth_token', 'dev-fallback-token');
    onAuthenticated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#161513] flex flex-col items-center justify-center p-4 overflow-y-auto py-6 sm:py-8 modal-backdrop-animated">
      <div className="max-w-md w-full mb-3 flex items-center justify-between text-xs my-auto">
        {onBackToPortalChooser && (
          <button
            type="button"
            onClick={onBackToPortalChooser}
            className="inline-flex items-center gap-1.5 text-[#dcd5c4] hover:text-[#fdfbf7] font-medium transition-calm"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Portal Chooser</span>
          </button>
        )}
        {onSwitchToStudentPortal && (
          <button
            type="button"
            onClick={onSwitchToStudentPortal}
            className="inline-flex items-center gap-1.5 text-[#e5b382] hover:text-[#f3caa1] font-medium transition-calm ml-auto"
          >
            <GraduationCap className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Switch to Student Portal</span>
          </button>
        )}
      </div>

      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-5 sm:p-8 max-w-md w-full space-y-6 my-auto modal-card-animated">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-lg bg-[#1f1b16] text-[#fdfbf7] flex items-center justify-center">
            <Lock className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif font-medium text-2xl text-[#1f1b16] pt-1">
            {authMode === 'signup' ? 'Create teacher account' : 'Teacher sign in'}
          </h2>
          <p className="text-xs text-[#5e554a]">
            {authMode === 'signup'
              ? 'Register with your institutional email and teacher access code'
              : 'Sign in to author question papers, publish sessions, and grade submissions'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-[#efe9df] p-1 rounded-lg border border-[#dcd5c4] text-xs font-medium text-[#5e554a]">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`h-8 rounded-md transition-calm ${authMode === 'login' ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs' : 'hover:text-[#1f1b16]'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`h-8 rounded-md transition-calm ${authMode === 'signup' ? 'bg-[#fdfbf7] text-[#1f1b16] shadow-2xs' : 'hover:text-[#1f1b16]'}`}
          >
            Register
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-lg bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] text-xs flex items-center gap-2 font-sans font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs flex items-center gap-2 font-sans font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[#5e554a] mb-1.5">Full name</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. S. Chatterjee"
                  className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                />
                <User className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#5e554a] mb-1.5">Teacher email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@institute.edu"
                required
                autoFocus
                className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
              />
              <Mail className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5e554a] mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
              />
              <KeyRound className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
            </div>
          </div>

          {authMode === 'signup' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#5e554a]">Teacher access code</label>
                <span className="text-[10px] text-[#7b7266]">From Vercel / .env</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="TEACHER_ACCESS_CODE"
                  required
                  className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-mono text-sm text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                />
                <ShieldCheck className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] text-[#7b7266] mt-1">Enter your institution passcode (TEACHER_ACCESS_CODE or APP_PASSWORD), not your Supabase API key.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Signing in' : authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </form>

        <div className="pt-3 border-t border-[#dcd5c4] flex items-center justify-between text-xs">
          <span className="text-[#7b7266]">Local evaluation mode</span>
          <button
            type="button"
            onClick={handleDemoAccess}
            className="font-medium text-[#8c4a17] hover:underline"
          >
            Continue in demo studio
          </button>
        </div>
      </div>
    </div>
  );
}
