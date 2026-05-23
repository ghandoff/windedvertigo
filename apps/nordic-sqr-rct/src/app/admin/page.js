'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';

/**
 * /admin — Unified Platform Administration Hub
 *
 * PCS tools are shown first (primary workflow). SQR-RCT reviewer stats
 * follow for admins who also manage the external reviewer program.
 */
function AdminDashboardContent() {
  const [sqrStats, setSqrStats] = useState({ totalReviewers: 0, totalReviews: 0, avgScore: 0 });
  const [pendingDeleteCount, setPendingDeleteCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/reviewers').then(r => r.ok ? r.json() : null),
      fetch('/api/pcs/requests?filter=all').then(r => r.ok ? r.json() : []),
    ]).then(([reviewersData, requestsData]) => {
      if (reviewersData?.reviewers) {
        const reviewers = reviewersData.reviewers;
        const totalReviews = reviewers.reduce((s, r) => s + (r.reviewCount || 0), 0);
        // Weighted average: weight each reviewer's avg score by their review count so
        // reviewers with more reviews contribute proportionally. Only include reviewers
        // who have actually submitted at least one scored review.
        const scoredReviewers = reviewers.filter(r => r.reviewCount > 0 && r.avgScore != null);
        const weightedSum = scoredReviewers.reduce((s, r) => s + r.avgScore * r.reviewCount, 0);
        const scoredTotal = scoredReviewers.reduce((s, r) => s + r.reviewCount, 0);
        const avgScore = scoredTotal > 0 ? (weightedSum / scoredTotal).toFixed(1) : '—';
        setSqrStats({ totalReviewers: reviewers.length, totalReviews, avgScore });
      }
      if (Array.isArray(requestsData)) {
        const pending = requestsData.filter(r => r.requestType === 'Delete' && r.status !== 'Done').length;
        setPendingDeleteCount(pending);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WorkspaceShell variant="research" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Administration</h1>
          <p className="mt-1 text-sm text-gray-500">
            PCS research platform tools and SQR-RCT reviewer management in one place.
          </p>
        </div>

        {/* ── PCS Platform ─────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">PCS Research Platform</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            <AdminCard
              href="/research/pcs"
              icon={<GridIcon />}
              title="Command Center"
              description="Live KPIs, charts, and research status dashboard."
              primary
            />
            <AdminCard
              href="/admin/users"
              icon={<UsersIcon />}
              title="User Directory"
              description="Manage roles for Nordic team, RA staff, and SQR reviewers."
            />
            <AdminCard
              href="/research/pcs/admin/imports"
              icon={<ImportIcon />}
              title="PCS Imports"
              description="Upload PDF, extract, review, and commit PCS documents."
              badge="active"
            />
            <AdminCard
              href="/research/pcs/admin/backfill"
              icon={<WrenchIcon />}
              title="Backfill Tools"
              description="Populate canonical ingredients, claim prefixes, and relation links from existing data."
            />
            <AdminCard
              href="/research/pcs/admin/labels/imports"
              icon={<LabelIcon />}
              title="Label Imports"
              description="Import and review product label data."
            />
            <AdminCard
              href="/admin/audit"
              icon={<AuditIcon />}
              title="Audit Log"
              description="Full revision history across all PCS records."
            />
          </div>
        </section>

        {/* ── Pending delete requests ────────────────────────── */}
        {pendingDeleteCount !== null && (
          <section>
            <Link
              href="/research/pcs/requests?requestType=Delete"
              className={`flex items-center justify-between rounded-xl border px-5 py-4 shadow-sm transition-colors ${
                pendingDeleteCount > 0
                  ? 'bg-red-50 border-red-200 hover:bg-red-100'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending deletion requests</div>
                <div className={`mt-1 text-3xl font-bold ${pendingDeleteCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {pendingDeleteCount}
                </div>
                {pendingDeleteCount > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">Review and action in the requests queue →</p>
                )}
              </div>
              {pendingDeleteCount > 0 && (
                <span className="text-2xl">🗑️</span>
              )}
            </Link>
          </section>
        )}

        {/* ── SQR-RCT ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">SQR-RCT External Review Program</h2>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Reviewers', value: loading ? '…' : sqrStats.totalReviewers },
              { label: 'Total reviews', value: loading ? '…' : sqrStats.totalReviews },
              { label: 'Avg SQR score', value: loading ? '…' : sqrStats.avgScore },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="mt-1 text-3xl font-bold text-gray-900">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AdminCard
              href="/admin/users"
              icon={<UsersIcon />}
              title="Reviewer Accounts"
              description="View reviewer profiles, invite new reviewers, manage roles."
            />
            <AdminCard
              href="/reviews/dashboard"
              icon={<ReviewIcon />}
              title="Review Dashboard"
              description="Browse scoring history and reviewer analytics."
            />
            <AdminCard
              href="/analytics"
              icon={<ChartIcon />}
              title="Analytics"
              description="Platform-wide study and scoring analytics."
            />
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

/* ── Small card component ─────────────────────────────────────────── */
function AdminCard({ href, icon, title, description, primary = false }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
        primary
          ? 'border-pacific-200 bg-pacific-50 hover:bg-pacific-100'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${primary ? 'bg-pacific-100 text-pacific-700' : 'bg-gray-100 text-gray-600'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-sm font-semibold ${primary ? 'text-pacific-800' : 'text-gray-900'}`}>{title}</div>
        <div className="mt-0.5 text-xs text-gray-500 leading-snug">{description}</div>
      </div>
    </Link>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
const GridIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ImportIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const WrenchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const LabelIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const AuditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const ReviewIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminRoute>
        <AdminDashboardContent />
      </AdminRoute>
    </AuthProvider>
  );
}
