'use client';

/**
 * Wave 7.4 preview — collapsible group primitive.
 *
 * Open/closed state persists to `localStorage` under
 * `sidebarGroup:${groupKey}`. The key is intentionally NOT scoped by
 * role — collapse preferences are per-viewer, not per-role (and the preview
 * role switcher shouldn't reset Garrett's Authoring default).
 *
 * Server-render safe: the first paint uses `defaultOpen`; `useEffect`
 * reads localStorage after mount and updates. No hydration mismatch
 * because we don't inline the localStorage value into the initial markup.
 */

import { useEffect, useState } from 'react';
import SidebarItem from './SidebarItem';
import styles from './sidebar-preview.module.css';

const STORAGE_PREFIX = 'sidebarGroup:';

export default function SidebarGroup({ group, counts = null, countsLoading = false }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + group.key);
      if (stored === 'open') setOpen(true);
      else if (stored === 'closed') setOpen(false);
    } catch {
      // localStorage may throw in private mode; ignore.
    }
  }, [group.key]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + group.key, next ? 'open' : 'closed');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
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
        <div className="mt-0.5 space-y-0.5">
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
