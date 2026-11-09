import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Contact,
  LogIn,
  UserPlus,
  ShieldAlert,
  Terminal,
  RefreshCw,
  ArrowLeft,
  BookOpen,
  Copy,
  Check,
  CheckCircle2,
  KeyRound,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { loginStudent, signupStudent, generateAdmissionNumber } from '../../services/apiService';

export default function StudentAuthModal({
  onStudentAuthenticated,
  onLaunchDevDemo,
  onBackToTeacher,
  onBackToPortalChooser,
  initialTab = 'login',
  initialClassCode = ''
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'login' | 'signup'
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [fullName, setFullName] = useState('');
  const [classCode, setClassCode] = useState(initialClassCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredStudent, setRegisteredStudent] = useState(null);
  const [copiedRoll, setCopiedRoll] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAdm = params.get('adm') || params.get('admissionNumber');
      const urlDob = params.get('dob');
      const urlCode = params.get('classCode') || params.get('code');
      if (urlAdm) setAdmissionNumber(urlAdm.trim().toUpperCase());
      if (urlDob) setDob(urlDob.trim());
      if (urlCode && !classCode) setClassCode(urlCode.trim().toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (initialClassCode) {
      setClassCode(initialClassCode);
    }
  }, [initialClassCode]);

  useEffect(() => {
    if (activeTab === 'signup' && !admissionNumber) {
      setAdmissionNumber(generateAdmissionNumber());
    }
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !dob) {
      setError('Enter your admission / roll number and date of birth');
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
      setError(err.message || 'Sign in failed. Check your roll number and date of birth.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!admissionNumber.trim() || !fullName.trim() || !dob) {
      setError('Full Name and Date of Birth are required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await signupStudent(
        admissionNumber.trim(),
        fullName.trim(),
        dob,
        classCode ? classCode.trim() : '',
        { hp_confirm: honeypot, renderedAt }
      );
      if (res && res.student) {
        setRegisteredStudent(res.student);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRoll = () => {
    const roll = registeredStudent?.admission_number || admissionNumber;
    if (roll && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(roll);
      setCopiedRoll(true);
      setTimeout(() => setCopiedRoll(false), 2000);
    }
  };

  const qrPayload = registeredStudent
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?mode=student&adm=${encodeURIComponent(registeredStudent.admission_number)}&dob=${encodeURIComponent(registeredStudent.dob)}`
    : '';

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col justify-center items-center p-4 font-sans selection:bg-[#ecdcc9]">
      <div className="max-w-md w-full space-y-4">
        {/* Top Portal Switcher Bar */}
        <div className="flex items-center justify-between text-xs px-1">
          {onBackToPortalChooser && (
            <button
              type="button"
              onClick={onBackToPortalChooser}
              className="inline-flex items-center gap-1.5 font-medium text-[#5e554a] hover:text-[#1f1b16] transition-calm"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Portal Chooser</span>
            </button>
          )}

          {onBackToTeacher && (
            <button
              type="button"
              onClick={onBackToTeacher}
              className="inline-flex items-center gap-1.5 font-medium text-[#8c4a17] hover:underline transition-calm ml-auto"
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Switch to Teacher Studio</span>
            </button>
          )}
        </div>

        {/* If registration just completed: display Hall Ticket & permanent Roll Number */}
        {registeredStudent ? (
          <div className="bg-[#fdfbf7] border border-[#3f6b4a] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-[#f4f8f5] border border-[#cbe0d3] text-[#2b5a38] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1f1b16] pt-1">
                Registration Successful!
              </h2>
              <p className="text-xs text-[#5e554a]">
                Welcome, <span className="font-semibold text-[#1f1b16]">{registeredStudent.full_name}</span>. Here is your permanent roll number and QR hall ticket.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5e554a]">Permanent Roll Number</span>
                <button
                  type="button"
                  onClick={handleCopyRoll}
                  className="text-xs text-[#8c4a17] hover:underline flex items-center gap-1 font-medium"
                >
                  {copiedRoll ? <Check className="w-3.5 h-3.5 text-[#2b5a38]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRoll ? 'Copied!' : 'Copy Roll No.'}</span>
                </button>
              </div>
              <div className="text-2xl font-mono font-bold tracking-wider text-[#1f1b16] bg-[#fdfbf7] p-2.5 rounded-lg border border-[#dcd5c4] text-center">
                {registeredStudent.admission_number}
              </div>
              <div className="flex items-center justify-between text-xs text-[#5e554a] pt-1">
                <span>DOB: <span className="font-mono font-medium text-[#1f1b16]">{registeredStudent.dob}</span></span>
                {classCode && <span>Class: <span className="font-mono font-medium text-[#1f1b16]">{classCode}</span></span>}
              </div>
            </div>

            {/* QR Hall Ticket */}
            <div className="flex flex-col items-center justify-center p-4 bg-[#fdfbf7] rounded-xl border border-[#dcd5c4] space-y-2">
              <div className="bg-white p-2.5 rounded-lg border border-[#dcd5c4] shadow-2xs">
                <QRCodeSVG value={qrPayload} size={130} level="M" />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#7b7266]">
                <QrCode className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Scan for 1-click mobile sign in</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStudentAuthenticated(registeredStudent)}
              className="w-full h-11 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Enter Student Examination Portal</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] flex items-center justify-center">
                <Contact className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1f1b16] pt-1">
                Student Examination Portal
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
                    Admission / Roll Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                      placeholder="DLP-26-XXXXX"
                      className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums focus:outline-none focus:border-[#8c4a17]"
                      required
                    />
                    <Contact className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#5e554a] mb-1.5">
                    Date of Birth
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
                  {loading ? 'Signing in...' : 'Enter Student Portal'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4 text-xs">
                {/* Anti-Bot Invisible Honeypot Trap */}
                <div style={{ position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }} aria-hidden="true">
                  <input
                    type="text"
                    name="hp_confirm"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#5e554a] mb-1.5">
                    Full Name <span className="text-[#8c4a17]">*</span>
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
                      Admission / Roll Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setAdmissionNumber(generateAdmissionNumber())}
                      className="text-[11px] font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value.replace(/[^A-Za-z0-9_\-]/g, '').toUpperCase())}
                      placeholder="DLP-26-XXXXX"
                      className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-sm text-[#1f1b16] font-mono tabular-nums font-medium focus:outline-none focus:border-[#8c4a17]"
                      required
                    />
                    <Contact className="w-4 h-4 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#5e554a] mb-1.5">
                    Date of Birth <span className="text-[#8c4a17]">*</span>
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

                {/* Optional Classroom Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-medium text-[#5e554a]">
                      Classroom Code <span className="text-[10px] text-[#7b7266] font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-[#7b7266]">From your teacher</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      placeholder="CLASS-XXXXXX (Optional)"
                      className="w-full pl-9 pr-3.5 h-10 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] text-xs font-mono text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-[#7b7266] absolute left-3 top-3" strokeWidth={1.5} />
                  </div>
                  <p className="text-[10px] text-[#7b7266] mt-1">
                    You can join a class now or connect anytime inside your student portal.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs transition-calm active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? 'Registering...' : 'Register as Candidate'}
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
        )}
      </div>
    </div>
  );
}
