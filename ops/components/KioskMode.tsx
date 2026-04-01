'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ────────────────────────────────────────────────────────────────
   KioskMode — passive TV display that auto-rotates dashboard pages
   Inspired by Geckoboard TV mode. Notion cannot do this.
   ──────────────────────────────────────────────────────────────── */

export interface KioskModeProps {
  enabled: boolean;
  onExit: () => void;
  children: React.ReactNode[];
  interval?: number;
  pageNames?: string[];
}

/* ── Kiosk overlay ────────────────────────────────────────────── */

export function KioskMode({
  enabled,
  onExit,
  children,
  interval = 30,
  pageNames,
}: KioskModeProps) {
  const [activePage, setActivePage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState('');
  const [animationKey, setAnimationKey] = useState(0);
  const pageCount = children.length;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  /* ── Clock ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      );
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [enabled]);

  /* ── Fullscreen API ─────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return;

    const enter = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen may be blocked by browser policy — continue anyway
      }
    };
    enter();

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onExitRef.current();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [enabled]);

  /* ── Page rotation timer ────────────────────────────────────── */

  useEffect(() => {
    if (!enabled || paused || pageCount <= 1) return;
    const id = setInterval(() => {
      setActivePage((p) => (p + 1) % pageCount);
      setAnimationKey((k) => k + 1);
    }, interval * 1000);
    return () => clearInterval(id);
  }, [enabled, paused, interval, pageCount]);

  /* ── Reset animation key when paused state changes ──────────── */

  useEffect(() => {
    if (!paused) setAnimationKey((k) => k + 1);
  }, [paused]);

  /* ── Keyboard controls ──────────────────────────────────────── */

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      switch (e.key) {
        case 'Escape':
          onExitRef.current();
          break;
        case 'ArrowRight':
          setActivePage((p) => (p + 1) % pageCount);
          setAnimationKey((k) => k + 1);
          break;
        case 'ArrowLeft':
          setActivePage((p) => (p - 1 + pageCount) % pageCount);
          setAnimationKey((k) => k + 1);
          break;
        case ' ':
          e.preventDefault();
          setPaused((v) => !v);
          break;
      }
    },
    [enabled, pageCount],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, handleKey]);

  /* ── Reset state on enable ──────────────────────────────────── */

  useEffect(() => {
    if (enabled) {
      setActivePage(0);
      setPaused(false);
      setAnimationKey(0);
    }
  }, [enabled]);

  /* ── Render ─────────────────────────────────────────────────── */

  if (!enabled) return null;

  const pageName = pageNames?.[activePage] ?? `Page ${activePage + 1}`;

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col overflow-hidden"
      style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        fontSize: '150%',
        lineHeight: 1.4,
      }}
    >
      {/* ── Clock (top-right) ──────────────────────────────────── */}
      <div
        className="absolute top-6 right-8"
        style={{
          fontSize: '14px',
          fontVariantNumeric: 'tabular-nums',
          color: 'rgba(255,255,255,0.6)',
          zIndex: 10,
        }}
      >
        {clock}
      </div>

      {/* ── Paused indicator ───────────────────────────────────── */}
      {paused && (
        <div
          className="absolute top-6 left-8"
          style={{
            fontSize: '11px',
            padding: '2px 10px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.05em',
            zIndex: 10,
          }}
        >
          paused
        </div>
      )}

      {/* ── Page content with crossfade ────────────────────────── */}
      <div className="flex-1 overflow-hidden" style={{ padding: '48px 56px 24px' }}>
        {children.map((child, i) => (
          <div
            key={i}
            className="absolute inset-0 overflow-hidden"
            style={{
              padding: '48px 56px 80px',
              opacity: i === activePage ? 1 : 0,
              transition: 'opacity 300ms ease-in-out',
              pointerEvents: i === activePage ? 'none' : 'none',
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* ── Bottom bar: page name + progress + dots ────────────── */}
      <div className="absolute bottom-0 left-0 right-0" style={{ padding: '0 56px 20px' }}>
        {/* Page name */}
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.04em',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          {pageName}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '2px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: '1px',
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          <div
            key={animationKey}
            style={{
              height: '100%',
              backgroundColor: '#34d399', // emerald-400
              borderRadius: '1px',
              width: paused ? undefined : '100%',
              animation: paused ? 'none' : `kiosk-progress ${interval}s linear`,
            }}
          />
        </div>

        {/* Page dots */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            {children.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor:
                    i === activePage ? '#ffffff' : 'rgba(255,255,255,0.3)',
                  transition: 'background-color 300ms ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Keyframe animation ─────────────────────────────────── */}
      <style>{`
        @keyframes kiosk-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   KioskToggle — small TV icon button for dashboard header
   ──────────────────────────────────────────────────────────────── */

export function KioskToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="TV mode"
      className="
        relative group
        inline-flex items-center justify-center
        w-8 h-8 rounded-md
        text-ops-text-muted hover:text-ops-text
        transition-colors duration-150
        cursor-pointer
      "
    >
      {/* Monitor with play icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Monitor frame */}
        <rect x="1" y="2" width="16" height="11" rx="1.5" />
        {/* Stand */}
        <line x1="6" y1="16" x2="12" y2="16" />
        <line x1="9" y1="13" x2="9" y2="16" />
        {/* Play triangle */}
        <polygon points="7.5,5.5 7.5,10 11.5,7.75" fill="currentColor" stroke="none" />
      </svg>

      {/* Tooltip */}
      <span
        className="
          pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2
          px-2 py-0.5 rounded text-[10px] whitespace-nowrap
          bg-white/10 text-ops-text
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        "
      >
        TV mode
      </span>
    </button>
  );
}
