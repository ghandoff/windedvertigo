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

  const publicLinks = (
    <>
      <NavLink href="/sampler" onClick={close}>sampler</NavLink>
      <NavLink href="/matcher" onClick={close}>matcher</NavLink>
      <NavLink href="/packs" onClick={close}>packs</NavLink>
    </>
  );

  const authedLinks = session?.user ? (
    <>
      <NavLink href="/runs" onClick={close}>runs</NavLink>
      <NavLink href="/team" onClick={close}>team</NavLink>
      <NavLink href="/analytics" onClick={close}>analytics</NavLink>
      {session?.isAdmin && (
        <NavLink href="/admin" onClick={close} accent>admin</NavLink>
      )}
    </>
  ) : null;

  const authAction =
    status === "loading" ? null : session?.user ? (
      <>
        <span
          className="hidden sm:inline text-xs"
          style={{ color: "rgba(255,235,210,0.5)" }}
        >
          {session.user.email}
        </span>
        <button
          onClick={() => { close(); signOut({ callbackUrl: "/" }); }}
          className="text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: "#cb7858" }}
        >
          sign out
        </button>
      </>
    ) : (
      <NavLink href="/login" onClick={close} accent>sign in</NavLink>
    );

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ backgroundColor: "#273248" }}
    >
      {/* top bar */}
      <div
        className="flex items-center justify-between"
        style={{ maxWidth: "100%", padding: "12px 30px" }}
      >
        {/* brand */}
        <Link
          href="/"
          className="text-sm font-bold tracking-tight transition-colors hover:opacity-80"
          style={{ color: "#ffebd2" }}
          onClick={close}
        >
          creaseworks
        </Link>

        {/* desktop links */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
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
              backgroundColor: "#ffebd2",
              transform: mobileOpen ? "rotate(45deg) translate(2px, 2px)" : "none",
            }}
          />
          <span
            className="block w-5 h-0.5 rounded-full transition-opacity duration-200"
            style={{ backgroundColor: "#ffebd2", opacity: mobileOpen ? 0 : 1 }}
          />
          <span
            className="block w-5 h-0.5 rounded-full transition-transform duration-200"
            style={{
              backgroundColor: "#ffebd2",
              transform: mobileOpen ? "rotate(-45deg) translate(2px, -2px)" : "none",
            }}
          />
        </button>
      </div>

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
      className="text-sm font-medium transition-colors hover:opacity-80"
      style={{ color: accent ? "#cb7858" : "#ffebd2" }}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
