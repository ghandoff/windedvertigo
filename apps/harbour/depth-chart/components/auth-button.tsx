"use client";

import { useSession, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-on-dark-muted)] hidden sm:inline">
          {session.user.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/harbour/depth-chart" })}
          className="px-3 py-1.5 text-xs text-[var(--color-text-on-dark-muted)] bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/harbour/depth-chart/login"
      className="px-3 py-1.5 text-xs font-semibold text-[var(--wv-cadet)] bg-[var(--wv-champagne)] rounded-lg hover:opacity-90 transition-opacity"
    >
      sign in
    </a>
  );
}
