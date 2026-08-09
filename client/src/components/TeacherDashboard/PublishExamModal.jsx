import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, ExternalLink, ShieldCheck, KeyRound, RefreshCw, Clock, PlusCircle } from 'lucide-react';
import { startRollingSession, extendExamSessionTime } from '../../services/apiService';

export default function PublishExamModal({ examId, testTitle, questionsCount, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rollingCode, setRollingCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [isGenerating, setIsGenerating] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [extendedMinutes, setExtendedMinutes] = useState(0);
  const [extendNotice, setExtendNotice] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?mode=student&testId=${examId}`;

  // Automatically start/fetch live rolling passcode session on modal mount
  useEffect(() => {
    handleStartRollingSession(durationMinutes);
  }, []);

  // 1-Second Countdown Timer
  useEffect(() => {
    if (secondsRemaining <= 0) {
      handleStartRollingSession(durationMinutes);
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

  async function handleStartRollingSession(mins = durationMinutes) {
    setIsGenerating(true);
    try {
      const data = await startRollingSession(examId, mins);
      if (data.success && data.rollingCode) {
        setRollingCode(data.rollingCode);
        if (typeof data.secondsRemaining === 'number') {
          setSecondsRemaining(data.secondsRemaining);
        }
        if (typeof data.durationMinutes === 'number') {
          setDurationMinutes(data.durationMinutes);
        }
      }
    } catch (err) {
      console.error('[Start Rolling Session Error]:', err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExtend(extraMins) {
    setIsExtending(true);
    try {
      const res = await extendExamSessionTime(examId, rollingCode, extraMins);
      if (res.success) {
        setExtendedMinutes(res.extendedMinutes);
        setExtendNotice(`⏱️ Added +${extraMins} mins live! Active students notified.`);
        setTimeout(() => setExtendNotice(''), 4000);
      }
    } catch (err) {
      console.error('[Extend Time Error]:', err);
    } finally {
      setIsExtending(false);
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

        {/* Exam Duration & Mid-Exam Time Extension Controls */}
        <div className="p-4.5 rounded-2xl bg-white border border-[#e2d8ca] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-[#1c1b18]">
              <Clock className="w-4 h-4 text-[#8c4a17]" />
              <span>Configurable Test Duration</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#8c4a17] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              Total: {durationMinutes + extendedMinutes} Mins {extendedMinutes > 0 ? `(+${extendedMinutes}m extra)` : ''}
            </span>
          </div>

          {/* Preset Duration Selector */}
          <div className="space-y-1.5 font-sans">
            <label className="text-[11px] font-semibold text-[#736c62] block">Set Initial Test Time Limit:</label>
            <div className="flex flex-wrap items-center gap-2">
              {[60, 90, 120, 180, 240].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(mins);
                    handleStartRollingSession(mins);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    durationMinutes === mins
                      ? 'bg-[#8c4a17] text-white shadow-2xs'
                      : 'bg-[#f4ece1] hover:bg-[#e8decb] text-[#5c5346]'
                  }`}
                >
                  {mins >= 60 ? `${mins / 60} Std Hr${mins >= 120 ? 's' : ''}` : `${mins} Mins`}
                </button>
              ))}
              <div className="flex items-center gap-1 bg-[#f4ece1] border border-[#dfd4c4] px-2 py-1 rounded-xl">
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={durationMinutes}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value, 10) || 180);
                    setDurationMinutes(v);
                    handleStartRollingSession(v);
                  }}
                  className="w-12 text-xs font-mono font-bold bg-transparent text-center focus:outline-none"
                />
                <span className="text-[11px] font-semibold text-[#736c62]">mins</span>
              </div>
            </div>
          </div>

          {/* Live Mid-Exam Extension Toolbar */}
          <div className="border-t border-[#f0e6d8] pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1c1b18] flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span>Live Mid-Exam Extension (Instant Student Alert)</span>
              </span>
            </div>

            {extendNotice && (
              <div className="p-2 rounded-xl bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 animate-pulse">
                <span>{extendNotice}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 30].map(m => (
                <button
                  key={m}
                  type="button"
                  disabled={isExtending}
                  onClick={() => handleExtend(m)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>+{m} Mins</span>
                </button>
              ))}
            </div>
          </div>
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
