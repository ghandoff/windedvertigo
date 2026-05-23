'use client';

/**
 * MobileSidebarDrawer — slide-in wrapper for RoleAwareSidebar on mobile.
 *
 * Architecture:
 *   - Desktop (md+): caller renders RoleAwareSidebar directly inside the flex
 *     container. This component returns `null` so it doesn't double-render.
 *   - Mobile (< md): a fixed overlay + slide-in panel. The hamburger in
 *     WorkspaceShell drives `open` via lifted state in the layout.
 *
 * Why a separate component instead of inlining:
 *   - Keeps RoleAwareSidebar unchanged (avoids regressions to desktop).
 *   - Scrolls the body lock + Escape key handling live alongside the drawer
 *     instead of bleeding into the layout file.
 *   - Each route closes the drawer automatically via the `pathname` effect.
 *
 * Touch-targets: the close button is 44×44, the backdrop covers the full
 * viewport, and route changes auto-close the panel — Apple HIG compliance
 * for a thumb-friendly nav.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import RoleAwareSidebar from './RoleAwareSidebar';

export default function MobileSidebarDrawer({
  open,
  onClose,
  role,
  user,
  onRoleChange,
}) {
  const pathname = usePathname();

  // Auto-close on route change so navigation feels natural.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape key closes drawer + body-scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={`md:hidden fixed inset-0 z-40 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Slide-in panel — w-72 (288px) gives a touch more room than the
          desktop w-56 since mobile users see one nav surface at a time. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — 44×44 hit area in the top-right corner */}
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Reuse the exact same sidebar — visual parity with desktop. */}
        <RoleAwareSidebar role={role} user={user} onRoleChange={onRoleChange} />
      </aside>
    </div>
  );
}
