import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, ExternalLink, ShieldCheck, KeyRound, RefreshCw } from 'lucide-react';
import { startRollingSession } from '../../services/apiService';

export default function PublishExamModal({ examId, testTitle, questionsCount, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rollingCode, setRollingCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [isGenerating, setIsGenerating] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?mode=student&testId=${examId}`;

  // Automatically start/fetch live rolling passcode session on modal mount
  useEffect(() => {
    handleStartRollingSession();
  }, []);

  // 1-Second Countdown Timer
  useEffect(() => {
    if (secondsRemaining <= 0) {
      handleStartRollingSession();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  function handleCopyCode() {
    if (!rollingCode) return;
    navigator.clipboard.writeText(rollingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  async function handleStartRollingSession() {
    setIsGenerating(true);
    try {
      const data = await startRollingSession(examId);
      if (data.success && data.rollingCode) {
        setRollingCode(data.rollingCode);
        if (typeof data.secondsRemaining === 'number') {
          setSecondsRemaining(data.secondsRemaining);
        }
      }
    } catch (err) {
      console.error('[Start Rolling Session Error]:', err);
    } finally {
      setIsGenerating(false);
    }
  }

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 overflow-y-auto">
      <div className="bg-[#FAF7F0] border border-[#dcd2c4] rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 font-sans text-[#1c1b18] my-auto">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e2d8ca] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-emerald-800 block">
                Exam Published Successfully
              </span>
              <h3 className="font-serif font-bold text-xl text-[#1c1b18]">
                Shareable Student Link Created
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#786f63] hover:bg-[#e8decb] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rolling Code Session Generator */}
        <div className="p-4.5 rounded-2xl bg-[#f4ece1] border border-[#dfd4c4] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-[#1c1b18]">
              <KeyRound className="w-4 h-4 text-[#8c4a17]" />
              <span>Dynamic Rolling Security Passcode</span>
            </div>
            <button
              type="button"
              onClick={handleStartRollingSession}
              disabled={isGenerating}
              className="flex items-center gap-1 text-xs font-semibold text-[#8c4a17] hover:underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{rollingCode ? 'Roll New Code' : 'Generate Code'}</span>
            </button>
          </div>

          {rollingCode ? (
            <div className="p-4 bg-white border border-[#dcd2c4] rounded-2xl text-center space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#736c62] uppercase tracking-wider flex items-center gap-1">
                  <span>Active 5-Min Passcode</span>
                  <span className="text-[10px] text-[#8c4a17] bg-[#f8f3eb] border border-[#e8decb] px-2 py-0.5 rounded-full font-mono font-semibold">
                    ⏱️ Auto-rolls in {formatTimer(secondsRemaining)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    copiedCode ? 'bg-emerald-600 text-white' : 'bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#8c4a17]'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Code Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono font-extrabold text-4xl tracking-widest text-[#8c4a17] py-1">
                {rollingCode}
              </div>
              <p className="text-[11px] text-[#736c62]">
                Code automatically refreshes every 5 minutes (with 5-min grace period for students).
              </p>
            </div>
          ) : (

            <div className="py-4 text-center">
              <p className="text-xs text-[#736c62]">
                {isGenerating ? 'Generating active rolling passcode...' : 'Click Generate Code to create a live 6-digit passcode for your students.'}
              </p>
            </div>
          )}

        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-2xl bg-[#f5efe4] border border-[#e2d8ca] space-y-2 text-xs text-[#5c5346]">
          <div className="flex items-center gap-2 font-bold text-[#1c1b18]">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Frozen Snapshot Protected</span>
          </div>
          <p>
            This test paper has been frozen into an immutable snapshot (<strong>{questionsCount} questions</strong>).
          </p>
        </div>

        {/* Link Output & Copy Button */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#1c1b18] block">
            Student Examination Link:
          </label>
          <div className="flex items-center gap-2 bg-white border border-[#dcd2c4] rounded-2xl p-2 shadow-xs">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent px-2 text-xs font-mono text-gray-800 focus:outline-none overflow-x-auto select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all ${
                copied
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#2c2825] hover:bg-[#1c1b18] text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e2d8ca]">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#8c4a17] hover:underline font-semibold flex items-center gap-1"
          >
            <span>Test Student Link in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#e5dcd0] hover:bg-[#d8ccbc] text-[#2c2825] font-serif font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
