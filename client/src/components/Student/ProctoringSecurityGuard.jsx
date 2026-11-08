import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertTriangle, Terminal } from 'lucide-react';

/**
 * Proctoring Security Guard & Tab-Out Monitor Component
 */
export default function ProctoringSecurityGuard({
  isActive = true,
  onDisqualifyCheating,
  studentName = 'Candidate'
}) {
  const [violationCount, setViolationCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [isDevDisabled, setIsDevDisabled] = useState(false);
  const [showDevToast, setShowDevToast] = useState(false);

  const hiddenTimeRef = useRef(null);
  const lastViolationTimeRef = useRef(0);

  const MAX_PERMITTED_VIOLATIONS = 2;
  const MAX_CONTINUOUS_HIDDEN_MS = 60 * 1000;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) ||
          (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        setIsDevDisabled(prev => {
          const nextState = !prev;
          setShowDevToast(true);
          setTimeout(() => setShowDevToast(false), 3000);
          return nextState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleViolation = (reason) => {
      if (isDevDisabled) return;

      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1500) {
        return;
      }
      lastViolationTimeRef.current = now;

      setViolationCount(prev => {
        const nextCount = prev + 1;
        if (nextCount > MAX_PERMITTED_VIOLATIONS) {
          onDisqualifyCheating({
            cheatingFlagged: true,
            violationCount: nextCount,
            reason: reason || `Exceeded maximum permitted window/tab switches (${nextCount} violations)`
          });
        } else {
          setActiveWarning({
            count: nextCount,
            message: 'Navigating away from the active examination window is not permitted.'
          });
        }
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTimeRef.current = Date.now();
      } else {
        if (hiddenTimeRef.current) {
          const elapsedMs = Date.now() - hiddenTimeRef.current;
          hiddenTimeRef.current = null;

          if (elapsedMs > MAX_CONTINUOUS_HIDDEN_MS && !isDevDisabled) {
            onDisqualifyCheating({
              cheatingFlagged: true,
              violationCount: 99,
              reason: `Continuous window inactivity exceeded limit (${Math.round(elapsedMs / 1000)} seconds)`
            });
            return;
          }
        }
        handleViolation('Tab switch or window blur detected');
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden) {
        handleViolation('Focus lost from examination browser window');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isActive, isDevDisabled, onDisqualifyCheating]);

  return (
    <>
      {(showDevToast || isDevDisabled) && (
        <div className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1f1b16] text-[#fdfbf7] text-xs font-mono border border-[#dcd5c4] select-none">
          <Terminal className="w-3.5 h-3.5 text-[#8a847a] shrink-0" strokeWidth={1.5} />
          <span>
            {isDevDisabled ? 'Proctoring paused' : 'Proctoring active'}
          </span>
          <span className="text-[10px] text-[#8a847a] bg-[#262421] px-1.5 py-0.5 rounded border border-[#332d25]">
            Ctrl+Alt+D
          </span>
        </div>
      )}

      {activeWarning && !isDevDisabled && (
        <div className="fixed inset-0 bg-[#161513]/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] border border-[#dc2626] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-5 text-center font-sans">
            <div className="w-12 h-12 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 shrink-0" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-mono tabular-nums font-medium text-[#dc2626] bg-[#fdf2f2] border border-[#dc2626] px-2.5 py-0.5 rounded-md inline-block">
                Focus violation {activeWarning.count} of 3
              </span>
              <h3 className="font-serif font-medium text-2xl text-[#1f1b16]">
                Window focus warning
              </h3>
              <p className="text-xs text-[#5e554a] leading-relaxed">
                {studentName}, you navigated away from the active examination tab.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#f7f4ee] border border-[#dcd5c4] text-left text-xs text-[#5e554a] space-y-1.5">
              <div className="font-medium flex items-center gap-1.5 text-[#1f1b16]">
                <AlertTriangle className="w-4 h-4 text-[#b8622e] shrink-0" strokeWidth={1.5} />
                <span>Session proctoring rules</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Keep this examination tab in focus until submission.</li>
                <li>A third focus violation will end your test session with 0 marks.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveWarning(null)}
              className="w-full h-10 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm active:scale-[0.98]"
            >
              Return to examination
            </button>
          </div>
        </div>
      )}
    </>
  );
}
