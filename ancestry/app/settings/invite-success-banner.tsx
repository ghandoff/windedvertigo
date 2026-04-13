"use client";

import { useState, useEffect } from "react";

export function InviteSuccessBanner({ email }: { email: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 dark:border-emerald-800 dark:bg-emerald-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          invite sent to <span className="font-medium">{email}</span>
        </p>
        <button
          onClick={() => setVisible(false)}
          className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
          aria-label="dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
