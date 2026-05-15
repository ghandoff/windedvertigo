'use client';

/**
 * Wave 8 Phase B (Budget B teaser) — Premium feature preview placeholder.
 *
 * Linked from the "Advanced (Premium)" section of the role-aware sidebar
 * (see `src/components/sidebar/sidebar-items.js`). Only super-users reach
 * this page via the unlocked card; non-super-users see locked cards in the
 * sidebar and never get here.
 *
 * The page is intentionally a credible teaser surface — no underlying
 * functionality is wired up. Each premium item shows a description, the
 * Winded Vertigo R&D context, and a contact CTA.
 */

import { use } from 'react';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';
import Footer from '@/components/Footer';
import AdminRoute from '@/components/AdminRoute';
import { AuthProvider } from '@/lib/useAuth';
import { PREMIUM_GROUP } from '@/components/sidebar/sidebar-items';

function PreviewBody({ slug }) {
  const item = PREMIUM_GROUP.items.find((i) => i.key === slug);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <WorkspaceShell variant="reviewer" />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 sm:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/admin" className="hover:text-pacific transition">Admin</Link>
            <span>/</span>
            <span className="text-gray-700">Premium Preview</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-900">
            Premium retainer tier
          </div>
          <h1 className="mt-3 text-3xl font-bold text-pacific">
            {item?.label || 'Premium feature preview'}
          </h1>
          {item?.description ? (
            <p className="mt-2 max-w-2xl text-gray-600">{item.description}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-gold-200 bg-gold-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            This feature is in active R&amp;D
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            Preview available in next retainer cycle. Super-users see this
            placeholder so they can socialize the roadmap internally; the
            underlying capability is delivered as part of Winded Vertigo&apos;s
            Priority retainer tier (Budget B in the platform contract).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="mailto:garrett@windedvertigo.com?subject=Nordic%20Premium%20Preview%20Inquiry"
              className="inline-flex items-center rounded-md border border-pacific-600 bg-pacific-600 px-4 py-2 text-sm font-medium text-white hover:bg-pacific-700 transition-colors"
            >
              Contact Winded Vertigo
            </a>
            <Link
              href="/admin/sidebar-preview"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to sidebar preview
            </Link>
          </div>
        </div>

        {!item ? (
          <div className="mt-6 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <p>
              No premium item matches <code className="font-mono">{slug}</code>.
              Try one of the items in the Advanced (Premium) sidebar section.
            </p>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

export default function PremiumPreviewPage({ params }) {
  const { slug } = use(params);
  return (
    <AuthProvider>
      <AdminRoute>
        <PreviewBody slug={slug} />
      </AdminRoute>
    </AuthProvider>
  );
}
