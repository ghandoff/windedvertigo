'use client';

/**
 * Wave 7.2 Phase 3 — Unified /welcome post-login landing.
 *
 * Replaces the hardcoded getRedirectPath() bounce in page.js. Every
 * successful login (and every "already authed" visit to /) lands here
 * first. The page reads the user's roles and either:
 *   - Immediately deep-links to the single obvious destination (reviewer-
 *     only users with one option), or
 *   - Shows a one-screen role-aware card grid for multi-role users who
 *     need to pick which surface to enter.
 *
 * The /welcome route is auth-gated in middleware. Unauthenticated visitors
 * are bounced to / before the page renders.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';

// ── Destination cards ─────────────────────────────────────────────────────

const REVIEWER_CARD = {
  key: 'reviews',
  title: 'Reviewer Dashboard',
  desc: 'Pick up where you left off — available articles, recent reviews, and your quality metrics.',
  href: '/reviews/dashboard',
  icon: (
    <svg className="w-7 h-7 text-pacific-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  accent: 'border-pacific',
  bg: 'bg-pacific-50',
};

const PCS_CARDS = [
  {
    key: 'pcs',
    title: 'Command Center',
    desc: 'PCS dashboard — claims, evidence, documents, and the full research workflow.',
    href: '/research/pcs',
    icon: (
      <svg className="w-7 h-7 text-pacific-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    accent: 'border-pacific',
    bg: 'bg-pacific-50',
    primary: true,
  },
  {
    key: 'requests',
    title: 'Research Requests',
    desc: 'Open requests queue — review, assign, and track substantiation work items.',
    href: '/research/pcs/requests',
    icon: (
      <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    accent: 'border-amber-400',
    bg: 'bg-amber-50',
  },
  {
    key: 'data',
    title: 'Data Hub',
    desc: 'Imports, exports, label sync, and data management tools.',
    href: '/research/pcs/data',
    icon: (
      <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    accent: 'border-green-400',
    bg: 'bg-green-50',
  },
];

const ADMIN_CARD = {
  key: 'admin',
  title: 'Admin Panel',
  desc: 'Reviewer management, sync utilities, schema viewer, and platform governance.',
  href: '/admin',
  icon: (
    <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  accent: 'border-gray-300',
  bg: 'bg-gray-50',
};

// ── Destination card component ─────────────────────────────────────────────

function DestinationCard({ card, isOnly }) {
  return (
    <Link
      href={card.href}
      className={`
        group relative flex flex-col gap-4 rounded-xl border-2 ${card.accent} p-6
        ${card.bg} hover:shadow-lg transition-all duration-150
        ${isOnly ? 'max-w-md mx-auto' : ''}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
          {card.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 group-hover:text-pacific transition-colors">
            {card.title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{card.desc}</p>
        </div>
        <svg
          className="w-5 h-5 text-gray-300 group-hover:text-pacific shrink-0 mt-0.5 transition-colors"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// ── Main content ───────────────────────────────────────────────────────────

function WelcomeContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const hasPcs   = hasAnyRole(user, ROLE_SETS.PCS_ANY);
  const hasSqr   = hasAnyRole(user, ROLE_SETS.SQR_REVIEWERS);
  const isAdmin  = user?.isAdmin;
  const isReviewerOnly = hasSqr && !hasPcs && !isAdmin;
  // Nordic team member with no SQR reviewer role → skip welcome, go straight
  // to the Command Center. Mirrors the reviewer-only auto-route pattern.
  const isPcsOnly = hasPcs && !hasSqr;
  const variant  = hasPcs ? 'research' : 'reviewer';

  // Single-destination users skip the welcome card grid entirely.
  // - Reviewer-only  → /reviews/dashboard
  // - Nordic team    → /research/pcs (Command Center)
  // Users with both PCS + SQR reviewer access continue to see the card grid.
  useEffect(() => {
    if (!loading && isReviewerOnly) {
      router.replace('/reviews/dashboard');
    }
    if (!loading && isPcsOnly) {
      router.replace('/research/pcs');
    }
  }, [loading, isReviewerOnly, isPcsOnly, router]);

  if (loading || isReviewerOnly || isPcsOnly) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // Build the card list based on role
  const cards = [];
  if (hasPcs) cards.push(...PCS_CARDS);
  if (hasSqr) cards.push({ ...REVIEWER_CARD, title: 'My SQR Reviews', desc: 'View your scoring history, available articles, and reviewer analytics.' });
  if (isAdmin) cards.push(ADMIN_CARD);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <WorkspaceShell variant={variant} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-sm font-medium text-pacific-500 uppercase tracking-wide mb-1">
            Nordic Research Workspace
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.firstName || user.alias}!
          </h1>
          <p className="text-gray-500 mt-2 text-base">
            Where would you like to go?
          </p>
        </div>

        {/* Destination cards */}
        <div className={`grid gap-4 ${cards.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {cards.map(card => (
            <DestinationCard
              key={card.key}
              card={card}
              isOnly={cards.length === 1}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <AuthProvider>
      <WelcomeContent />
    </AuthProvider>
  );
}
