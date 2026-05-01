/**
 * /co-play — co-play hub.
 *
 * Entry point from the mobile FAB. Shows:
 * 1. A join-by-code form for people who received an invite.
 * 2. Recent co-play activity for the current user.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getRecentCoPlayRuns } from "@/lib/queries/co-play-hub";

export const metadata: Metadata = {
  title: "co-play",
  description: "play together — join a session or see your co-play history.",
};

export const dynamic = "force-dynamic";

export default async function CoPlayHub() {
  const session = await requireAuth();
  const recentRuns = await getRecentCoPlayRuns(session.userId);

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-16 sm:pb-16 max-w-lg mx-auto">
      {/* header */}
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-serif mb-2">
        co-play
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        play together — join someone&apos;s session or invite a friend to yours.
      </p>

      {/* join by code */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold tracking-tight mb-3">
          join a session
        </h2>
        <JoinByCodeForm />
      </section>

      {/* create a new co-play session */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold tracking-tight mb-3">
          start a session
        </h2>
        <p className="text-xs text-cadet/50 mb-3">
          log a reflection first, then invite someone to co-play from the
          success screen.
        </p>
        <Link
          href="/log/new"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:shadow-md"
          style={{
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
        >
          <span>log a reflection</span>
          <span aria-hidden>&rarr;</span>
        </Link>
      </section>

      {/* recent co-play activity */}
      {recentRuns.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold tracking-tight mb-3">
            recent co-play
          </h2>
          <ul className="space-y-3">
            {recentRuns.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/co-play/${run.inviteCode}`}
                  className="block rounded-xl border p-4 transition-colors hover:border-sienna/30"
                  style={{
                    borderColor: "var(--cw-border)",
                    backgroundColor: "var(--cw-card-bg)",
                  }}
                >
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--cw-text)" }}
                  >
                    {run.title}
                  </p>
                  <p className="text-xs text-cadet/40 mt-0.5">
                    {run.partnerName
                      ? `with ${run.partnerName}`
                      : "waiting for co-player"}
                    {" \u00b7 "}
                    code: {run.inviteCode}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/* ── client form for join-by-code ─────────────────────────────────── */

function JoinByCodeForm() {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const { redirect } = await import("next/navigation");
        const code = String(formData.get("code") ?? "").trim().toUpperCase();
        if (code) redirect(`/co-play/${code}`);
      }}
      className="flex gap-2"
    >
      <input
        name="code"
        type="text"
        placeholder="enter invite code"
        maxLength={8}
        className="flex-1 rounded-lg border border-cadet/15 px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:ring-2"
        style={{ letterSpacing: "0.2em" }}
        required
      />
      <button
        type="submit"
        className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-md"
        style={{ backgroundColor: "var(--wv-sienna)" }}
      >
        join
      </button>
    </form>
  );
}
