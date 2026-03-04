"use client";

import { useSession } from "@/lib/use-session";
import { useAccess } from "@/lib/use-access";

/**
 * Site header — uses the shared wv-header class system from @windedvertigo/tokens.
 * Dark cadet bar matching vertigo-vault and creaseworks.
 */
export function NavBar() {
  const { session, loading, isAuthenticated } = useSession();
  const { hasFullDeck } = useAccess();

  return (
    <nav className="wv-header sticky top-0 z-50" aria-label="main navigation">
      <a href="https://windedvertigo.com" className="wv-header-brand">
        winded.vertigo
      </a>

      <div className="wv-header-nav hidden sm:flex">
        <a href="/" className="wv-header-nav-link" data-accent>
          deep.deck
        </a>

        {hasFullDeck && (
          <span className="wv-header-email">Full Deck</span>
        )}

        {loading ? null : isAuthenticated ? (
          <>
            <span className="wv-header-email">
              {session?.user?.name || session?.user?.email}
            </span>
            <a href="/api/auth/signout" className="wv-header-signout">
              sign out
            </a>
          </>
        ) : (
          <a href="/login" className="wv-header-nav-link" data-accent>
            sign in
          </a>
        )}
      </div>
    </nav>
  );
}
