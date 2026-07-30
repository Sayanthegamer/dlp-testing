import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldAlert } from 'lucide-react';
import { verifyPassword } from '../../services/apiService';

export default function AccessGateModal({ onAuthenticated }) {
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await verifyPassword(passwordInput);
      localStorage.setItem('app_access_password', passwordInput);
      onAuthenticated();
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect access password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#fcfbfa] border border-[#dcd2c4] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Lock Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-[#1c1b18]">Private Access Gate</h2>
          <p className="text-xs text-[#736c62] max-w-xs mx-auto">
            This math test authoring environment is restricted. Please enter your access password to unlock.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-sans font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
              Access Passcode
            </label>
            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password..."
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#c9bea9] bg-white font-mono text-sm text-[#1c1b18] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
              />
              <KeyRound className="w-5 h-5 text-[#8c8275] absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#8c4a17] hover:bg-[#703a11] text-white font-serif font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Verifying...' : 'Unlock Application'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-[#8c8275] font-sans">
          Protected server proxy • DevTools bypass protected via backend token validation
        </p>

      </div>
    </div>
  );
}
