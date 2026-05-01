/**
 * Harbour dashboard — the central hub for all winded.vertigo harbour apps.
 *
 * Shows all 5 apps with descriptions, access badges, and upgrade CTAs.
 * Lives in creaseworks since it already has entitlement/stripe infrastructure.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserEntitlements, hasAppAccess } from "@windedvertigo/stripe";

export const metadata: Metadata = {
  title: "harbour — your learning ecosystem",
  description:
    "five playful learning tools, one sign-on. explore the harbour.",
};

const HARBOUR_APPS = [
  {
    key: "creaseworks",
    label: "creaseworks",
    href: "/harbour/creaseworks",
    description:
      "simple, tested playdates for parents, teachers, and kids. notice the world, see possibility, and make things with whatever's on hand.",
    freeLabel: "free playdates available",
    upgradeLabel: "unlock all playdates",
  },
  {
    key: "vertigo-vault",
    label: "vertigo.vault",
    href: "/harbour/vertigo-vault",
    description:
      "a curated collection of group activities, energizers, and reflective exercises designed to spark curiosity, collaboration, and creative thinking.",
    freeLabel: "22 free PRME activities",
    upgradeLabel: "unlock full vault",
  },
  {
    key: "depth-chart",
    label: "depth.chart",
    href: "/harbour/depth-chart",
    description:
      "generate methodologically sound formative assessment tasks from lesson plans and syllabi, grounded in constructive alignment.",
    freeLabel: "PRME skills view (always free)",
    upgradeLabel: "unlock assessment generator",
  },
  {
    key: "deep-deck",
    label: "deep.deck",
    href: "/harbour/deep-deck",
    description:
      "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
    freeLabel: "sample deck available",
    upgradeLabel: "unlock all decks",
  },
  {
    key: "raft-house",
    label: "raft.house",
    href: "/harbour/raft-house",
    description:
      "a facilitated, real-time learning platform that helps groups cross threshold concepts through play.",
    freeLabel: "join rooms for free",
    upgradeLabel: "unlock hosting + history",
  },
] as const;

export default async function HarbourHomePage() {
  const session = await auth();
  const userId = session?.userId;
  const orgId = session?.orgId ?? null;

  // Check app access for logged-in users
  let appAccess: Record<string, boolean> = {};
  if (userId) {
    const results = await Promise.all(
      HARBOUR_APPS.map(async (app) => ({
        key: app.key,
        hasAccess: await hasAppAccess(userId, orgId, app.key),
      })),
    );
    appAccess = Object.fromEntries(results.map((r) => [r.key, r.hasAccess]));
  }

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <header className="text-center mb-16">
        <h1
          className="text-3xl font-bold tracking-tight font-serif mb-3"
          style={{ color: "var(--wv-cadet)" }}
        >
          the harbour
        </h1>
        <p
          className="text-base max-w-lg mx-auto"
          style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
        >
          five playful learning tools, one sign-on. explore free samples across
          every app, then upgrade the ones you love.
        </p>
        {!session && (
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--wv-redwood)" }}
          >
            sign in to get started
          </Link>
        )}
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {HARBOUR_APPS.map((app) => {
          const hasPremium = appAccess[app.key];

          return (
            <a
              key={app.key}
              href={app.href}
              className="block rounded-xl border p-6 transition-all hover:shadow-md"
              style={{
                borderColor: hasPremium
                  ? "var(--wv-redwood)"
                  : "rgba(39, 50, 72, 0.1)",
                backgroundColor: hasPremium
                  ? "rgba(177, 80, 67, 0.03)"
                  : "white",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--wv-cadet)" }}
                >
                  {app.label}
                </h2>
                {hasPremium ? (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(177, 80, 67, 0.1)",
                      color: "var(--wv-redwood)",
                    }}
                  >
                    premium
                  </span>
                ) : (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(39, 50, 72, 0.06)",
                      color: "var(--wv-cadet)",
                      opacity: 0.5,
                    }}
                  >
                    free
                  </span>
                )}
              </div>

              <p
                className="text-sm mb-4 leading-relaxed"
                style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
              >
                {app.description}
              </p>

              <p className="text-xs" style={{ color: "var(--wv-sienna)" }}>
                {hasPremium ? "full access" : app.freeLabel}
              </p>
            </a>
          );
        })}
      </div>

      {session && !Object.values(appAccess).every(Boolean) && (
        <div className="mt-12 text-center">
          <p
            className="text-sm mb-3"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            want it all?
          </p>
          <span
            className="inline-block px-6 py-2.5 text-sm font-medium rounded-lg"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.06)",
              color: "var(--wv-cadet)",
            }}
          >
            harbour bundle — coming soon
          </span>
        </div>
      )}
    </main>
  );
}
