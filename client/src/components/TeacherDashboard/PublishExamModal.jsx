import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, ExternalLink, ShieldCheck, KeyRound, Clock, PlusCircle } from 'lucide-react';
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

  useEffect(() => {
    handleStartRollingSession(durationMinutes);
  }, []);

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
    setTimeout(() => setCopied(false), 2500);
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
    } catch (_) {} finally {
      setIsGenerating(false);
    }
  }

  async function handleExtend(extraMins) {
    setIsExtending(true);
    try {
      const res = await extendExamSessionTime(examId, rollingCode, extraMins);
      if (res.success) {
        setExtendedMinutes(res.extendedMinutes);
        setExtendNotice(`Added +${extraMins} minutes to the active exam session`);
        setTimeout(() => setExtendNotice(''), 4000);
      }
    } catch (_) {} finally {
      setIsExtending(false);
    }
  }

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#161513]/60 overflow-y-auto">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl space-y-5 font-sans text-[#1f1b16] my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#dcd5c4] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3f6b4a] text-[#fdfbf7] flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-xs font-medium text-[#3f6b4a] block">
                Published snapshot ({questionsCount} {questionsCount === 1 ? 'question' : 'questions'})
              </span>
              <h3 className="font-serif font-medium text-xl text-[#1f1b16]">
                {testTitle || 'Mathematics Assessment'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#7b7266] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Live 6-Digit Rolling Code Display */}
        <div className="p-4 rounded-xl bg-[#f7f4ee] border border-[#dcd5c4] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#5e554a] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#8c4a17]" strokeWidth={1.5} />
              <span>6-digit session passcode</span>
            </span>
            <div className="font-mono font-medium text-2xl text-[#1f1b16] tracking-wider tabular-nums">
              {isGenerating ? '••••••' : (rollingCode || '849201')}
            </div>
            <span className="text-[11px] font-mono text-[#7b7266] tabular-nums block">
              Refreshes in {formatTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3.5 h-9 rounded-lg text-xs font-medium border transition-calm flex items-center gap-1.5 ${
              copiedCode
                ? 'bg-[#3f6b4a] border-[#3f6b4a] text-[#fdfbf7]'
                : 'bg-[#fdfbf7] border-[#dcd5c4] text-[#1f1b16] hover:bg-[#efe9df]'
            }`}
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
            <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
          </button>
        </div>

        {/* Duration & Extension Controls */}
        <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#dcd5c4] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-xs text-[#1f1b16]">
              <Clock className="w-4 h-4 text-[#7b7266]" strokeWidth={1.5} />
              <span>Session duration</span>
            </div>
            <span className="text-xs font-mono tabular-nums font-medium text-[#8c4a17] bg-[#efe9df] px-2.5 py-0.5 rounded-md">
              {durationMinutes + extendedMinutes} mins {extendedMinutes > 0 ? `(+${extendedMinutes}m)` : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[60, 90, 120, 180].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDurationMinutes(mins);
                  handleStartRollingSession(mins);
                }}
                className={`px-3 h-8 rounded-md text-xs font-mono tabular-nums font-medium transition-calm ${
                  durationMinutes === mins
                    ? 'bg-[#1f1b16] text-[#fdfbf7]'
                    : 'bg-[#efe9df] hover:bg-[#e5dec9] text-[#5e554a]'
                }`}
              >
                {mins}m
              </button>
            ))}
            <div className="flex items-center gap-1 bg-[#f7f4ee] border border-[#dcd5c4] px-2.5 h-8 rounded-md ml-auto">
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
                className="w-12 text-xs font-mono tabular-nums font-medium bg-transparent text-center focus:outline-none text-[#1f1b16]"
              />
              <span className="text-xs text-[#7b7266]">min</span>
            </div>
          </div>

          <div className="border-t border-[#efe9df] pt-3 space-y-2">
            <span className="text-xs font-medium text-[#5e554a] flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
              <span>Extend live session time</span>
            </span>

            {extendNotice && (
              <div className="p-2.5 rounded-lg bg-[#f4f8f5] border border-[#3f6b4a] text-[#3f6b4a] text-xs font-medium">
                {extendNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {[5, 10, 15, 30].map(m => (
                <button
                  key={m}
                  type="button"
                  disabled={isExtending}
                  onClick={() => handleExtend(m)}
                  className="px-3 h-8 rounded-md bg-[#f7f4ee] hover:bg-[#efe9df] border border-[#dcd5c4] text-[#1f1b16] text-xs font-mono tabular-nums font-medium transition-calm disabled:opacity-50"
                >
                  +{m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Shareable Link */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#5e554a] block">
            Student portal link
          </label>
          <div className="flex items-center gap-2 bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-1.5">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent px-2 text-xs font-mono text-[#1f1b16] focus:outline-none overflow-x-auto select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 h-8 rounded-md font-medium text-xs transition-calm ${
                copied
                  ? 'bg-[#3f6b4a] text-[#fdfbf7]'
                  : 'bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#dcd5c4]">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#8c4a17] hover:underline font-medium flex items-center gap-1.5"
          >
            <span>Open student link</span>
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg bg-[#efe9df] hover:bg-[#e5dec9] text-[#1f1b16] font-sans font-medium text-xs transition-calm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
