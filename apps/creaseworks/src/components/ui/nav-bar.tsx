"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { usePathname } from "next/navigation";

/* ── inline SVG nav icons ──────────────────────────────────────
 * Small 20×20 icons for each nav destination. Designed to be
 * legible for non-readers (Feature Y) and colour-coded per section.
 * Using inline SVGs avoids icon-library dependencies.
 */

function IconPlaydates({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <circle cx="10" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M5 15h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconMatcher({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <circle cx="7" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 7.5v5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function IconPacks({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <rect x="3" y="5" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 5V3.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 3.5V5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M3 9h14" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

function IconReflections({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <path d="M4 4h12v12H4z" fill="none" stroke="currentColor" strokeWidth="1.2" rx="1" />
      <path d="M7 8h6M7 10.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <circle cx="14" cy="14" r="3.5" fill="currentColor" opacity="0.15" />
      <path d="M13 14l1 1 2-2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconPlaybook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <path d="M3 3h5.5a1.5 1.5 0 0 1 1.5 1.5V17l-1-1H3V3z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M17 3h-5.5A1.5 1.5 0 0 0 10 4.5V17l1-1H17V3z" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconGallery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M2 14l4-3 3 2 4-4 5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconCommunity({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <circle cx="10" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="15" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M6 16c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconAdmin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <path d="M10 2l1.5 3 3.5.5-2.5 2.5.5 3.5L10 10l-3 1.5.5-3.5L5 5.5 8.5 5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="10" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/* ── section colour map ──────────────────────────────────────
 * Each nav section gets a distinct accent colour so non-readers
 * can navigate by colour association.
 */
const SECTION_COLORS: Record<string, string> = {
  "/sampler":         "var(--wv-sienna)",
  "/matcher":         "var(--wv-redwood)",
  "/packs":           "var(--wv-cadet)",
  "/reflections":     "var(--wv-sienna)",
  "/playbook":        "var(--wv-redwood)",
  "/profile":         "var(--wv-cadet)",
  "/gallery":         "var(--wv-champagne)",
  "/community":       "var(--wv-redwood)",
  "/admin":           "var(--wv-sienna)",
};

/**
 * Top navigation bar — matches windedvertigo.com header style.
 *
 * - Dark cadet (#273248) background
 * - Brand left, nav links right
 * - Champagne text, sienna for accent links (sign in, admin)
 * - Mobile: hamburger toggles slide-down menu
 * - Feature Y: icons alongside text + colour-coded bottom tab bar
 *
 * Session 12: redesigned to match w.v site header pattern.
 * Session 30: added nav icons + mobile bottom tab bar for non-readers.
 */
export default function NavBar() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setMobileOpen(false);

  const isAuthed = !!session?.user;

  const publicLinks = (
    <>
      <NavLink href="/sampler" onClick={close} icon={<IconPlaydates />}>playdates</NavLink>
      <NavLink href="/matcher" onClick={close} icon={<IconMatcher />}>matcher</NavLink>
      <NavLink href="/packs" onClick={close} icon={<IconPacks />}>packs</NavLink>
      <NavLink href="/gallery" onClick={close} icon={<IconGallery />}>gallery</NavLink>
    </>
  );

  /* build initials from name or email */
  const initials = isAuthed
    ? (session?.user?.name
        ? session.user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
        : session?.user?.email?.charAt(0) ?? "?"
      ).toUpperCase()
    : "";

  const authedLinks = isAuthed ? (
    <>
      <NavLink href="/reflections/new" onClick={close} icon={<IconReflections />}>reflections</NavLink>
      <NavLink href="/playbook" onClick={close} icon={<IconPlaybook />}>playbook</NavLink>
      <NavLink href="/community" onClick={close} icon={<IconCommunity />}>community</NavLink>
      <Link
        href="/profile"
        onClick={close}
        className="wv-header-nav-link flex items-center gap-1.5"
      >
        <span
          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
          style={{
            width: 22,
            height: 22,
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span>profile</span>
      </Link>
      {session?.isAdmin && (
        <NavLink href="/admin" onClick={close} accent icon={<IconAdmin />}>admin</NavLink>
      )}
    </>
  ) : null;

  const authAction =
    status === "loading" ? null : session?.user ? (
      <button
        onClick={() => { close(); signOut({ callbackUrl: "/" }); }}
        className="wv-header-signout"
      >
        sign out
      </button>
    ) : (
      <NavLink href="/login" onClick={close} accent>sign in</NavLink>
    );

  /* ── bottom tab bar items for mobile (authed users only) ── */
  const bottomTabs = isAuthed
    ? [
        { href: "/sampler", label: "play", icon: <IconPlaydates />, key: "sampler" },
        { href: "/gallery", label: "gallery", icon: <IconGallery />, key: "gallery" },
        { href: "/reflections/new", label: "log", icon: <IconReflections />, key: "reflections" },
        { href: "/community", label: "crew", icon: <IconCommunity />, key: "community" },
        { href: "/playbook", label: "book", icon: <IconPlaybook />, key: "playbook" },
      ]
    : [
        { href: "/sampler", label: "play", icon: <IconPlaydates />, key: "sampler" },
        { href: "/matcher", label: "match", icon: <IconMatcher />, key: "matcher" },
        { href: "/packs", label: "packs", icon: <IconPacks />, key: "packs" },
        { href: "/gallery", label: "gallery", icon: <IconGallery />, key: "gallery" },
      ];

  return (
    <>
      <nav
        className="wv-header fixed top-0 left-0 right-0 z-50"
        aria-label="main navigation"
      >
          {/* brand */}
          <Link href="/" className="wv-header-brand" onClick={close}>
            creaseworks
          </Link>

          {/* desktop links */}
          <div className="wv-header-nav hidden sm:flex">
            {publicLinks}
            {authedLinks}
            {authAction}
          </div>

          {/* mobile hamburger */}
          <button
            className="sm:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "close menu" : "open menu"}
            aria-expanded={mobileOpen}
          >
            <span
              className="block w-5 h-0.5 rounded-full transition-transform duration-200"
              style={{
                backgroundColor: "var(--wv-white)",
                transform: mobileOpen ? "rotate(45deg) translate(2px, 2px)" : "none",
              }}
            />
            <span
              className="block w-5 h-0.5 rounded-full transition-opacity duration-200"
              style={{ backgroundColor: "var(--wv-white)", opacity: mobileOpen ? 0 : 1 }}
            />
            <span
              className="block w-5 h-0.5 rounded-full transition-transform duration-200"
              style={{
                backgroundColor: "var(--wv-white)",
                transform: mobileOpen ? "rotate(-45deg) translate(2px, -2px)" : "none",
              }}
            />
          </button>

        {/* mobile dropdown */}
        {mobileOpen && (
          <div
            className="sm:hidden flex flex-col gap-4 px-8 pb-5 text-sm"
            style={{ borderTop: "1px solid rgba(255,235,210,0.1)" }}
          >
            {publicLinks}
            {authedLinks}
            {authAction}
          </div>
        )}
      </nav>

      {/* ── mobile bottom tab bar ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center py-1.5 border-t"
        style={{
          backgroundColor: "var(--wv-white)",
          borderColor: "rgba(39,50,72,0.08)",
          paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        }}
        aria-label="quick navigation"
      >
        {bottomTabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) ?? false;
          const accentColor = SECTION_COLORS[tab.href] ?? "var(--wv-cadet)";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors"
              style={{
                color: isActive ? accentColor : "rgba(39,50,72,0.4)",
                backgroundColor: isActive ? "rgba(39,50,72,0.04)" : "transparent",
              }}
            >
              {tab.icon}
              <span className="text-[9px] font-semibold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* -- nav link component -------------------------------------------- */

function NavLink({
  href,
  onClick,
  accent,
  icon,
  children,
}: {
  href: string;
  onClick?: () => void;
  accent?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="wv-header-nav-link flex items-center gap-1.5"
      data-accent={accent || undefined}
      onClick={onClick}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      {children}
    </Link>
  );
}
