"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

/* ── types ──────────────────────────────────────────────────────── */

interface Notification {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}

/* ── icon ──────────────────────────────────────────────────────── */

const EVENT_ICONS: Record<string, string> = {
  gallery_approved: "🖼️",
  gallery_rejected: "🖼️",
  invite_accepted: "✉️",
  pack_granted: "📦",
  progress_milestone: "🏅",
  co_play_invite: "🤝",
  org_joined: "🏫",
  system: "📢",
};

/* ── relative time helper ──────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/* ── component ──────────────────────────────────────────────────── */

const BASE = "/harbour/creaseworks";
const POLL_INTERVAL = 60_000; // 60s

/**
 * Notification bell icon with badge + dropdown panel.
 *
 * - Polls unread count every 60s (lightweight countOnly endpoint)
 * - Dropdown shows recent notifications with mark-as-read on click
 * - "mark all as read" button at top
 * - Closes on outside click or Escape
 *
 * Session 47: P2-4 notification center.
 */
export default function NotificationBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAuthed = !!session?.user;

  /* ── poll unread count ────────────────────────────────────────── */

  const fetchCount = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const r = await fetch(`${BASE}/api/notifications/in-app?countOnly=1`);
      if (r.ok) {
        const data = await r.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silent — badge just won't update
    }
  }, [isAuthed]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCount]);

  /* ── fetch full list when dropdown opens ──────────────────────── */

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/notifications/in-app?limit=20`);
      if (r.ok) {
        const data = await r.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  /* ── close on outside click or Escape ─────────────────────────── */

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  /* ── actions ──────────────────────────────────────────────────── */

  const markRead = async (id: string) => {
    try {
      await fetch(`${BASE}/api/notifications/in-app/${id}/read`, {
        method: "POST",
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${BASE}/api/notifications/in-app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  /* ── render ───────────────────────────────────────────────────── */

  if (!isAuthed) return null;

  return (
    <div ref={ref} className="notif-bell-container">
      <button
        onClick={() => setOpen((o) => !o)}
        className="notif-bell-btn"
        aria-label={`notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          viewBox="0 0 20 20"
          width={20}
          height={20}
          aria-hidden="true"
          className="notif-bell-icon"
        >
          <path
            d="M10 2a5 5 0 0 0-5 5v3l-1.5 2a.5.5 0 0 0 .4.8h12.2a.5.5 0 0 0 .4-.8L15 10V7a5 5 0 0 0-5-5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M8 14a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notif-dropdown"
          role="dialog"
          aria-label="notifications"
        >
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="notif-mark-all-btn"
              >
                mark all read
              </button>
            )}
          </div>

          <div className="notif-dropdown-list">
            {loading && notifications.length === 0 ? (
              <div className="notif-empty">loading…</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">no notifications yet</div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                const icon = EVENT_ICONS[n.eventType] ?? "📢";

                const content = (
                  <div
                    className={`notif-item ${isUnread ? "notif-item-unread" : ""}`}
                    role="article"
                  >
                    <span className="notif-item-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <div className="notif-item-body">
                      <p className="notif-item-title">{n.title}</p>
                      {n.body && (
                        <p className="notif-item-desc">{n.body}</p>
                      )}
                      <time className="notif-item-time" dateTime={n.createdAt}>
                        {timeAgo(n.createdAt)}
                      </time>
                    </div>
                    {isUnread && (
                      <span className="notif-item-dot" aria-label="unread" />
                    )}
                  </div>
                );

                if (n.href) {
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      className="notif-item-link"
                      onClick={() => {
                        if (isUnread) markRead(n.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={n.id}
                    className="notif-item-link notif-item-btn"
                    onClick={() => {
                      if (isUnread) markRead(n.id);
                    }}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
