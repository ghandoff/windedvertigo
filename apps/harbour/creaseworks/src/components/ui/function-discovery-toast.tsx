"use client";

/**
 * FunctionDiscoveryToast — celebratory notification when a user
 * uses a material in a new function for the first time.
 *
 * "you just discovered that cardboard tubes can be mark makers!"
 *
 * CSS-only confetti animation, reduced-motion safe.
 */

import { useState, useEffect, useCallback } from "react";

interface FunctionDiscoveryToastProps {
  materialTitle: string;
  functionUsed: string;
  onDismiss?: () => void;
}

export default function FunctionDiscoveryToast({
  materialTitle,
  functionUsed,
  onDismiss,
}: FunctionDiscoveryToastProps) {
  const [visible, setVisible] = useState(true);

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  // auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-20 left-1/2 z-[100] -translate-x-1/2 max-w-sm w-[calc(100%-2rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-2xl px-5 py-4 shadow-lg border"
        style={{
          backgroundColor: "rgba(67, 177, 135, 0.95)",
          borderColor: "rgba(67, 177, 135, 0.3)",
          backdropFilter: "blur(8px)",
          animation: "toastSlideIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none flex-shrink-0" aria-hidden>
            🎉
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-0.5">
              new function discovered!
            </p>
            <p className="text-xs text-white/80">
              you just discovered that <strong>{materialTitle}</strong> can
              be <strong>{functionUsed}</strong>!
            </p>
            <p className="text-2xs text-white/50 mt-1">
              +1 bonus credit earned
            </p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors"
            aria-label="dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 5L11 11M11 5L5 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translate(-50%, -20px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes toastSlideIn { from, to { opacity: 1; transform: translate(-50%, 0); } }
        }
      `}</style>
    </div>
  );
}
