/**
 * Harbour account placeholder.
 *
 * Phase 3a deliverable. Shows the signed-in user's email + a sign-out
 * button. No profile fields, no settings yet — those land in unified-
 * auth Phase 2 alongside Stripe subscriptions and per-user roles.
 *
 * Server component: reads session via the shared `auth()` helper from
 * `lib/auth.ts`. If unauthenticated the middleware (`middleware.ts`,
 * matcher includes `/account/:path*`) redirects to `/login` first.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AccountPage() {
  const session = await auth();

  // Defensive — middleware should have caught this, but a direct nav
  // with a stale session can land here without one.
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/account");
  }

  async function signOutAction() {
    "use server";
    const { signOut } = await import("@/lib/auth");
    await signOut({ redirectTo: "/" });
  }

  return (
    <main id="main" className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-on-dark)]">
            your harbour account
          </h1>
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            signed in as {session.user.email}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-3 text-sm text-[var(--color-text-on-dark)]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[var(--color-text-on-dark-muted)]">name</span>
            <span>{session.user.name ?? "—"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[var(--color-text-on-dark-muted)]">email</span>
            <span>{session.user.email}</span>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            sign out
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
          >
            ← back to harbour
          </Link>
        </div>
      </div>
    </main>
  );
}
