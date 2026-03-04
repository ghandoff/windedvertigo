"use client";

import { useSession } from "@/lib/use-session";
import { useAccess } from "@/lib/use-access";

export function NavBar() {
  const { session, loading, isAuthenticated } = useSession();
  const { hasFullDeck } = useAccess();

  return (
    <nav className="sticky top-0 z-50 bg-[var(--dd-champagne-light)]/80 backdrop-blur-sm border-b border-[var(--dd-cadet)]/5">
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo / Home */}
        <a
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--dd-cadet)] hover:text-[var(--dd-redwood)] transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center">
            <span className="text-xs font-bold text-white">DD</span>
          </span>
          deep.deck
        </a>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {hasFullDeck && (
            <span className="text-xs font-medium text-[var(--dd-redwood)]/70 hidden sm:inline">
              Full Deck
            </span>
          )}

          {loading ? (
            <div className="w-7 h-7 rounded-full bg-[var(--dd-cadet)]/5 animate-pulse" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--dd-cadet)]/60 hidden sm:inline max-w-[140px] truncate">
                {session?.user?.name || session?.user?.email}
              </span>
              <a
                href="/api/auth/signout"
                className="text-xs text-[var(--dd-cadet)]/40 hover:text-[var(--dd-cadet)] transition-colors"
              >
                Sign out
              </a>
            </div>
          ) : (
            <a
              href="/login"
              className="text-xs font-medium text-[var(--dd-cadet)]/60 hover:text-[var(--dd-cadet)] transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
