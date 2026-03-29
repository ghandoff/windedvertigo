'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH_MAP = { sm: 320, md: 400, lg: 480 } as const;

/* ────────────────────────────────────────────────────────────────
   DetailDrawer
   ──────────────────────────────────────────────────────────────── */

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  width = 'md',
}: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Capture the element that had focus before the drawer opened
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      // Focus the close button on next frame so the panel is rendered
      requestAnimationFrame(() => {
        firstFocusableRef.current?.focus();
      });
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    []
  );

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const px = WIDTH_MAP[width];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
        className={`fixed top-0 right-0 z-40 h-full flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: px }}
      >
        <div className="flex flex-col h-full bg-[#111920] border-l border-[#1e2a38]">

          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-[#1e2a38] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-[#ffebd2] truncate">{title}</h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-[13px] text-[#71717a] mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <button
              ref={firstFocusableRef}
              onClick={onClose}
              aria-label="Close drawer"
              className="flex-shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center rounded hover:bg-white/[0.06] transition-colors cursor-pointer text-[#71717a] hover:text-[#d4d4d8]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   DrawerSection
   ──────────────────────────────────────────────────────────────── */

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a] mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   DrawerField
   ──────────────────────────────────────────────────────────────── */

export function DrawerField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#71717a] mb-0.5">{label}</p>
      <div className="text-[13px] text-[#d4d4d8]">{value}</div>
    </div>
  );
}
