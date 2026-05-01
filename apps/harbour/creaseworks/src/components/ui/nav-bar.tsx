"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/ui/notification-bell";
import { haptic } from "@/lib/haptics";

/* ── origami-cycle SVG icons ──────────────────────────────────
 * 20×20 icons following the winded.vertigo creative cycle:
 *   find → fold → unfold → find again
 *
 * Visual progression mirrors the brand one-pager illustrations:
 *   flat paper → paper airplane → butterfly wings → crane in flight
 *
 * Each icon is a stage in the origami metaphor, designed to be
 * legible at small sizes and colour-coded per cycle phase.
 */

/* ── mask-image nav icons ───────────────────────────────────────
 * Uses CSS mask-image with the brand SVG files so they inherit
 * `currentColor` for dynamic phase-colour theming. The SVGs live
 * in public/icons/nav/ and are optimised with SVGO.
 */
function NavIcon({ src, label }: { src: string; label: string }) {
  return (
    <span
      className="cw-nav-icon inline-block"
      role="img"
      aria-label={label}
      style={{
        width: 24,
        height: 24,
        backgroundColor: "currentColor",
        maskImage: `url(${src})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function IconFind() {
  return <NavIcon src="/harbour/creaseworks/icons/nav/find.svg" label="find" />;
}

function IconFold() {
  return <NavIcon src="/harbour/creaseworks/icons/nav/fold.svg" label="fold" />;
}

function IconUnfold() {
  return <NavIcon src="/harbour/creaseworks/icons/nav/unfold.svg" label="unfold" />;
}

function IconFindAgain() {
  return <NavIcon src="/harbour/creaseworks/icons/nav/fold-again.svg" label="find again" />;
}

/** Person silhouette — profile / me */
function IconMe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
      />
    </svg>
  );
}

/** Admin star/gear */
function IconAdmin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} className={className} aria-hidden="true">
      <path
        d="M10 2l1.5 3 3.5.5-2.5 2.5.5 3.5L10 10l-3 1.5.5-3.5L5 5.5 8.5 5z"
        fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      />
      <circle cx="10" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/* ── cycle-phase colour map ────────────────────────────────────
 * Each phase gets a distinct accent so non-readers can navigate
 * by colour association. Colours progress warm → deep → light → cool.
 */
const SECTION_COLORS: Record<string, string> = {
  "/find":            "var(--cw-phase-find)",       /* find — discovery blue   */
  "/matcher":         "var(--cw-phase-find)",       /* find (legacy redirect)  */
  "/play":            "var(--cw-phase-fold)",       /* fold — warm making      */
  "/sampler":         "var(--cw-phase-fold)",       /* fold (legacy alias)     */
  "/playbook":        "var(--cw-phase-fold)",       /* fold (legacy alias)     */
  "/log":             "var(--cw-phase-unfold)",     /* unfold — reflection     */
  "/reflections":     "var(--cw-phase-unfold)",     /* unfold (legacy alias)   */
  "/gallery":         "var(--cw-phase-unfold)",     /* unfold (legacy alias)   */
  "/community":       "var(--cw-phase-find-again)", /* find again — teal       */
  "/profile":         "var(--wv-sienna)",           /* me                      */
  "/admin":           "var(--wv-sienna)",
};

/**
 * Navigation bar — find · fold · unfold · find again · me
 *
 * Embodies the winded.vertigo creative cycle as interactive navigation.
 * The four phases (find, fold, unfold, find again) map to the Reggio-
 * inspired observation cycle and the origami progression metaphor
 * from the brand one-pager.
 *
 * All four cycle phases always visible — each page handles its own
 * auth gating internally (gallery is public, reflections require auth).
 *
 * Routes (merged pages):
 *   find       → /find        (material matcher + fit scoring)
 *   fold       → /play        (playbook collections top, playdates bottom)
 *   unfold     → /log         (reflection form + gallery for inspiration)
 *   find again → /community   (leaderboard + community activity)
 *   me         → /profile
 */
/* ── playful labels ───────────────────────────────────────────────
 * Action verbs that children (and everyone) understand without
 * needing the origami metaphor.
 */
const LABELS: Record<string, string> = {
  find: "look!",
  fold: "make!",
  unfold: "show!",
  "find again": "wow!",
  me: "me",
  "sign in": "join!",
};

export default function NavBar() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setMobileOpen(false);

  /** Map label to playful version */
  const label = (text: string) => LABELS[text] ?? text;

  const isAuthed = !!session?.user;

  /* ── kid/adult mode toggle ────────────────────────────────────── */
  // Lazy initializer reads DOM on client mount — no effect needed, no double-render.
  const [isGrownup, setIsGrownup] = useState<boolean>(
    () => typeof window !== "undefined" && document.documentElement.classList.contains("grownup-mode")
  );

  const toggleMode = useCallback(() => {
    const next = !isGrownup;
    // Flip class immediately for instant feedback
    document.documentElement.classList.toggle("grownup-mode", next);
    setIsGrownup(next);
    // Persist preference
    fetch("/harbour/creaseworks/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiMode: next ? "grownup" : "kid" }),
    });
  }, [isGrownup]);

  /* ── desktop nav links ──
   * All four cycle phases always visible. Each page is publicly
   * accessible (added to proxy public patterns) and handles auth
   * internally — e.g. /log shows the gallery for everyone and
   * gates the reflection form behind session.
   */
  const navLinks = (
    <>
      <NavLink href="/find" pathname={pathname} icon={<IconFind />} onClick={close}>
        {label("find")}
      </NavLink>
      <NavLink href="/play" pathname={pathname} icon={<IconFold />} onClick={close}>
        {label("fold")}
      </NavLink>
      <NavLink href="/log" pathname={pathname} icon={<IconUnfold />} onClick={close}>
        {label("unfold")}
      </NavLink>
      <NavLink href="/community" pathname={pathname} icon={<IconFindAgain />} onClick={close}>
        {label("find again")}
      </NavLink>
    </>
  );

  /* build initials from name or email */
  const initials = isAuthed
    ? (session?.user?.name
        ? session.user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
        : session?.user?.email?.charAt(0) ?? "?"
      ).toUpperCase()
    : "";

  const profileLink = isAuthed ? (
    <>
      <Link
        href="/profile"
        onClick={close}
        className="wv-header-nav-link flex items-center gap-1.5"
      >
        <span
          className="inline-flex items-center justify-center rounded-full text-2xs font-bold leading-none"
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
        <span>me</span>
      </Link>
      {session?.isAdmin && (
        <NavLink href="/admin" pathname={pathname} icon={<IconAdmin />} accent onClick={close}>
          admin
        </NavLink>
      )}
    </>
  ) : null;

  const authAction =
    status === "loading" ? null : session?.user ? (
      <button
        onClick={() => { close(); signOut({ callbackUrl: "/harbour" }); }}
        className="wv-header-signout"
      >
        sign out
      </button>
    ) : (
      <NavLink href="/login" pathname={pathname} accent onClick={close}>
        sign in
      </NavLink>
    );

  /* ── mobile bottom tab bar items ──
   *   unauthed: find · fold · unfold · find again · sign in  (5)
   *   authed:   find · fold · unfold · find again · me       (5)
   */
  type Tab = { href: string; label: string; icon: React.ReactNode; key: string; matchPrefix?: string };

  const bottomTabs: Tab[] = isAuthed
    ? [
        { href: "/matcher", label: label("find"), icon: <IconFind />, key: "find" },
        { href: "/play", label: label("fold"), icon: <IconFold />, key: "fold" },
        { href: "/log", label: label("unfold"), icon: <IconUnfold />, key: "unfold" },
        { href: "/community", label: label("find again"), icon: <IconFindAgain />, key: "find-again" },
        { href: "/profile", label: label("me"), icon: <IconMe />, key: "me" },
      ]
    : [
        { href: "/matcher", label: label("find"), icon: <IconFind />, key: "find" },
        { href: "/play", label: label("fold"), icon: <IconFold />, key: "fold" },
        { href: "/log", label: label("unfold"), icon: <IconUnfold />, key: "unfold" },
        { href: "/community", label: label("find again"), icon: <IconFindAgain />, key: "find-again" },
        { href: "/login", label: label("sign in"), icon: <IconMe />, key: "sign-in" },
      ];

  return (
    <>
      <nav
        className="wv-header fixed top-0 left-0 right-0 z-50"
        aria-label="main navigation"
      >
          <Link href="/" className="wv-header-brand" onClick={close}>
            creaseworks
          </Link>

          {/* desktop links */}
          <div className="wv-header-nav hidden sm:flex">
            {navLinks}
            {isAuthed && (
              <button
                type="button"
                onClick={toggleMode}
                aria-label={isGrownup ? "switch to kid mode" : "switch to grownup mode"}
                title={isGrownup ? "switch to kid mode" : "switch to grownup mode"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 24,
                  minHeight: 24,
                  padding: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  color: "currentColor",
                }}
              >
                {isGrownup ? "🪴" : "🎨"}
              </button>
            )}
            {profileLink}
            {isAuthed && <NotificationBell />}
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
            {navLinks}
            {isAuthed && (
              <button
                type="button"
                onClick={() => { toggleMode(); close(); }}
                aria-label={isGrownup ? "switch to kid mode" : "switch to grownup mode"}
                title={isGrownup ? "switch to kid mode" : "switch to grownup mode"}
                className="wv-header-nav-link flex items-center gap-1.5"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "currentColor", textAlign: "left" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 24,
                    minHeight: 24,
                    fontSize: "1rem",
                    lineHeight: 1,
                  }}
                >
                  {isGrownup ? "🪴" : "🎨"}
                </span>
                <span>{isGrownup ? "kid mode" : "grownup mode"}</span>
              </button>
            )}
            {profileLink}
            {isAuthed && <NotificationBell />}
            {authAction}
          </div>
        )}
      </nav>

      {/* ── co-play FAB (mobile, authenticated only) ── */}
      {isAuthed && (
        <Link
          href="/co-play"
          className="sm:hidden fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-90"
          style={{
            width: 48,
            height: 48,
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
            right: 16,
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
          aria-label="play together"
          title="co-play"
        >
          <svg viewBox="0 0 20 20" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="8" r="3" />
            <circle cx="13" cy="8" r="3" />
            <path d="M2 16c0-2.5 2-4 5-4s5 1.5 5 4" />
            <path d="M13 12c2.5 0 5 1.5 5 4" />
          </svg>
        </Link>
      )}

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
          const matchPath = tab.matchPrefix ?? tab.href;
          const isActive = pathname?.startsWith(matchPath) ?? false;
          const accentColor = SECTION_COLORS[matchPath] ?? "var(--wv-cadet)";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={() => haptic("light")}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors"
              style={{
                color: isActive ? accentColor : "rgba(39,50,72,0.4)",
                backgroundColor: isActive ? "rgba(39,50,72,0.04)" : "transparent",
              }}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* ── nav link component ─────────────────────────────────────── */

function NavLink({
  href,
  pathname,
  matchPrefix,
  onClick,
  accent,
  icon,
  children,
}: {
  href: string;
  pathname: string | null;
  matchPrefix?: string;
  onClick?: () => void;
  accent?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const matchPath = matchPrefix ?? href;
  const isActive = pathname?.startsWith(matchPath) ?? false;

  return (
    <Link
      href={href}
      className="wv-header-nav-link flex items-center gap-1.5"
      data-accent={accent || undefined}
      data-active={isActive || undefined}
      onClick={onClick}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      {children}
    </Link>
  );
}
