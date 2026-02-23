"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Top navigation bar — matches windedvertigo.com header style.
 *
 * - Dark cadet (#273248) background
 * - Brand left, nav links right
 * - Champagne text, sienna for accent links (sign in, admin)
 * - Mobile: hamburger toggles slide-down menu
 *
 * Session 12: redesigned to match w.v site header pattern.
 */
export default function NavBar() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const close = () => setMobileOpen(false);

  const isAuthed = !!session?.user;

  const publicLinks = (
    <>
      <NavLink href="/sampler" onClick={close}>playdates</NavLink>
      <NavLink href="/matcher" onClick={close}>matcher</NavLink>
      {!isAuthed && (
        <NavLink href="/packs" onClick={close}>packs</NavLink>
      )}
    </>
  );

  /* build initials from name or email */
  const initials = isAuthed
    ? (session.user.name
        ? session.user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
        : session.user.email?.charAt(0) ?? "?"
      ).toUpperCase()
    : "";

  const authedLinks = isAuthed ? (
    <>
      <NavLink href="/playbook" onClick={close}>playbook</NavLink>
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
        <NavLink href="/admin" onClick={close} accent>admin</NavLink>
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

  return (
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
  );
}

/* -- nav link component -------------------------------------------- */

function NavLink({
  href,
  onClick,
  accent,
  children,
}: {
  href: string;
  onClick?: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="wv-header-nav-link"
      data-accent={accent || undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
