'use client';

/**
 * Wave 7.4 preview — collapsible group primitive.
 *
 * Open/closed state persists to `localStorage` under
 * `sidebarGroup:${role}:${groupKey}`. The key is scoped by role so that
 * collapsing a group while previewing as "researcher" doesn't affect the
 * super-user's own layout when switching back.
 *
 * Server-render safe: the first paint uses `defaultOpen`; `useEffect`
 * reads localStorage after mount and updates. No hydration mismatch
 * because we don't inline the localStorage value into the initial markup.
 */

import { useEffect, useState } from 'react';
import SidebarItem from './SidebarItem';
import styles from './sidebar-preview.module.css';

const STORAGE_PREFIX = 'sidebarGroup:';

export default function SidebarGroup({ group, role = 'researcher', counts = null, countsLoading = false }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${role}:${group.key}`);
      if (stored === 'open') setOpen(true);
      else if (stored === 'closed') setOpen(false);
    } catch {
      // localStorage may throw in private mode; ignore.
    }
  }, [group.key, role]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${role}:${group.key}`, next ? 'open' : 'closed');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="py-1.5">
      {/* 2026-05-03 UX pass — group header gets stronger contrast (bold,
          dark text when open) so the parent/child hierarchy reads at a
          glance. Items below are indented + sit under a subtle left border
          to make the tree branch obvious. */}
      <button
        type="button"
        onClick={toggle}
        className={[
          'flex w-full items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
          open ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800',
        ].join(' ')}
        aria-expanded={open}
      >
        <svg
          className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span>{group.label}</span>
        {group.readOnlyHint ? (
          <span className="ml-1 text-[9px] font-medium normal-case tracking-normal text-gray-400">
            (read-only)
          </span>
        ) : null}
      </button>
      <div
        className={[
          styles.groupBody,
          open ? styles.groupBodyOpen : styles.groupBodyClosed,
        ].join(' ')}
      >
        <div className="ml-3 mt-1 border-l border-gray-100 pl-1.5 space-y-0.5">
          {group.items.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              counts={counts}
              countsLoading={countsLoading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
