import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  ArrowRight,
  ShieldAlert,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';
import { loginTeacher, signupTeacher } from '../../services/apiService';

export default function AccessGateModal({
  onAuthenticated,
  initialMode = 'login',
  onBackToPortalChooser,
  onSwitchToStudentPortal,
}) {
  const [authMode, setAuthMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDevEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

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
          setSuccessMsg(
            res.message || 'Account created. Check your email for a confirmation link before signing in.'
          );
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
    <div className="min-h-screen bg-paper-200 flex flex-col items-center justify-center p-4 overflow-y-auto py-8 font-sans text-exam-ink">
      <div className="max-w-md w-full mb-4 flex items-center justify-between text-sm">
        {onBackToPortalChooser && (
          <button
            type="button"
            onClick={onBackToPortalChooser}
            className="inline-flex items-center gap-1.5 text-exam-secondary hover:text-exam-ink font-medium transition-calm"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back</span>
          </button>
        )}
        {onSwitchToStudentPortal && (
          <button
            type="button"
            onClick={onSwitchToStudentPortal}
            className="inline-flex items-center gap-1.5 text-exam-accent hover:underline font-medium transition-calm ml-auto"
          >
            <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
            <span>Student sign in</span>
          </button>
        )}
      </div>

      <div className="exam-paper rounded-lg p-6 sm:p-8 max-w-md w-full space-y-6 modal-card-animated">
        <div className="space-y-2">
          <div className="w-9 h-9 rounded-md bg-exam-ink text-exam-card flex items-center justify-center">
            <Lock className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif font-normal text-2xl text-exam-ink pt-1">
            {authMode === 'signup' ? 'Create teacher account' : 'Teacher sign in'}
          </h2>
          <p className="text-sm text-exam-secondary">
            {authMode === 'signup'
              ? 'Register with your email and teacher access code'
              : 'Sign in to prepare papers, start sessions, and grade submissions'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-paper-300 p-1 rounded-md border border-exam-border text-sm font-medium text-exam-secondary">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`h-8 rounded-sm transition-calm ${
              authMode === 'login' ? 'bg-exam-card text-exam-ink shadow-2xs' : 'hover:text-exam-ink'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`h-8 rounded-sm transition-calm ${
              authMode === 'signup' ? 'bg-exam-card text-exam-ink shadow-2xs' : 'hover:text-exam-ink'
            }`}
          >
            Register
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-md bg-[#f4f8f5] border border-exam-positive text-exam-positive text-sm flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-md bg-[#fdf2f2] border border-exam-negative text-exam-negative text-sm flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-exam-secondary mb-1.5">Full name</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. S. Chatterjee"
                  className="w-full pl-9 pr-3.5 h-10 rounded-md border border-exam-border bg-exam-card text-sm text-exam-ink focus:outline-none focus:border-exam-accent"
                />
                <User className="w-4 h-4 text-exam-muted absolute left-3 top-3" strokeWidth={1.5} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-exam-secondary mb-1.5">Teacher email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@institute.edu"
                required
                autoFocus
                className="w-full pl-9 pr-3.5 h-10 rounded-md border border-exam-border bg-exam-card text-sm text-exam-ink focus:outline-none focus:border-exam-accent"
              />
              <Mail className="w-4 h-4 text-exam-muted absolute left-3 top-3" strokeWidth={1.5} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-exam-secondary mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-9 pr-3.5 h-10 rounded-md border border-exam-border bg-exam-card text-sm text-exam-ink focus:outline-none focus:border-exam-accent"
              />
              <KeyRound className="w-4 h-4 text-exam-muted absolute left-3 top-3" strokeWidth={1.5} />
            </div>
          </div>

          {authMode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-exam-secondary mb-1.5">
                Teacher access code
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Institution access code"
                  required
                  className="w-full pl-9 pr-3.5 h-10 rounded-md border border-exam-border bg-exam-card font-mono text-sm text-exam-ink focus:outline-none focus:border-exam-accent"
                />
                <ShieldCheck className="w-4 h-4 text-exam-muted absolute left-3 top-3" strokeWidth={1.5} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 px-4 rounded-md bg-exam-ink hover:opacity-90 text-exam-card font-sans font-medium text-sm transition-calm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>
              {isSubmitting ? 'Signing in' : authMode === 'signup' ? 'Create account' : 'Sign in'}
            </span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </form>

        {isDevEnv && (
          <div className="pt-4 border-t border-exam-border flex items-center justify-between text-xs">
            <span className="text-exam-muted">Local development only</span>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="font-medium text-exam-accent hover:underline"
            >
              Open local sandbox
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
