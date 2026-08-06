import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Lock, EyeOff, Terminal } from 'lucide-react';

/**
 * Proctoring Security Guard & Tab-Out Monitor Component
 * Detects tab switches, window minimization, and background inactivity.
 * Issues warnings on 1st & 2nd offense, and auto-disqualifies on 3rd violation or > 60s inactivity.
 * Includes Dev Hotkey (Ctrl + Alt + D) to toggle proctoring ON/OFF for development testing.
 */
export default function ProctoringSecurityGuard({
  isActive = true,
  onDisqualifyCheating,
  studentName = 'Candidate'
}) {
  const [violationCount, setViolationCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null); // { count: number, message: string }
  const [isDevDisabled, setIsDevDisabled] = useState(false);
  const [showDevToast, setShowDevToast] = useState(false);

  const hiddenTimeRef = useRef(null);
  const lastViolationTimeRef = useRef(0);

  const MAX_PERMITTED_VIOLATIONS = 2; // 3rd offense triggers instant disqualification
  const MAX_CONTINUOUS_HIDDEN_MS = 60 * 1000; // 60 seconds continuous background inactivity limit

  // Dev Hotkey: Ctrl + Alt + D (or Ctrl + Shift + D) to toggle proctoring
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) ||
          (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        setIsDevDisabled(prev => {
          const nextState = !prev;
          setShowDevToast(true);
          setTimeout(() => setShowDevToast(false), 3000);
          console.log(`[DEV MODE] Proctoring Security Guard toggled: ${nextState ? 'DISABLED (Bypassed)' : 'ENABLED (Active)'}`);
          return nextState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Proctoring Listener
  useEffect(() => {
    if (!isActive) return;

    const handleViolation = (reason) => {
      // Dev mode bypass check
      if (isDevDisabled) {
        console.log(`[DEV MODE] Suppressed proctoring violation: ${reason}`);
        return;
      }

      // Cooldown debounce (1500ms) to prevent double counting window.blur + visibilitychange on 1st tab switch
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1500) {
        return;
      }
      lastViolationTimeRef.current = now;

      setViolationCount(prev => {
        const nextCount = prev + 1;
        if (nextCount > MAX_PERMITTED_VIOLATIONS) {
          // 3rd violation reached — trigger immediate cheating disqualification
          onDisqualifyCheating({
            cheatingFlagged: true,
            violationCount: nextCount,
            reason: reason || `Exceeded maximum permitted window/tab switches (${nextCount} violations)`
          });
        } else {
          setActiveWarning({
            count: nextCount,
            message: `Security Alert: Navigating away from the active exam paper is strictly prohibited. Additional violations will result in session disqualification.`
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
            // Over 60 seconds continuous inactivity — instant disqualification
            onDisqualifyCheating({
              cheatingFlagged: true,
              violationCount: 99,
              reason: `Continuous tab-out / window inactivity exceeded maximum allowed limit (${Math.round(elapsedMs / 1000)} seconds)`
            });
            return;
          }
        }
        handleViolation('Tab switch / window blur detected');
      }
    };

    const handleWindowBlur = () => {
      // Only count window blur if document is not already hidden (prevents duplicate triggers)
      if (!document.hidden) {
        handleViolation('Focus lost from exam browser window');
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
      {/* Dev Mode Floating Toast Notification */}
      <AnimatePresence>
        {(showDevToast || isDevDisabled) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-900/90 text-amber-200 text-xs font-mono shadow-lg border border-amber-700/50 backdrop-blur-md select-none"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span>
              {isDevDisabled ? '[DEV MODE] Tab-Out Monitoring DISABLED' : '[DEV MODE] Tab-Out Monitoring ENABLED'}
            </span>
            <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700/30">
              Ctrl+Alt+D
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proctoring Warning Modal */}
      <AnimatePresence>
        {activeWarning && !isDevDisabled && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white border-2 border-red-500 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-300 text-red-600 flex items-center justify-center mx-auto animate-bounce">
                <ShieldAlert className="w-9 h-9 shrink-0" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full inline-block">
                  PROCTORING VIOLATION {activeWarning.count} OF 3
                </span>
                <h3 className="font-serif font-bold text-2xl text-[#1c1b18]">
                  Security Warning Issued
                </h3>
                <p className="text-sm text-gray-700 font-sans leading-relaxed">
                  Hello <strong className="text-[#1c1b18]">{studentName}</strong>, you navigated away from the exam tab or lost window focus.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-xs text-red-900 space-y-2 font-sans">
                <div className="font-bold flex items-center gap-1.5 text-red-950">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Anti-Cheating Policy Rules:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-red-800">
                  <li>Do NOT switch tabs or open other applications.</li>
                  <li>Do NOT minimize the browser window.</li>
                  <li>3rd violation or &gt;60s inactivity will <strong>disqualify your test session</strong> and record 0 marks.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setActiveWarning(null)}
                className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-serif font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>I Understand — Return to Exam</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
