'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import LivingPcsView from '@/components/pcs/living-view/LivingPcsView';

/**
 * Living PCS View — sibling of /pcs/documents/[id] (the admin metadata page).
 *
 * Wave 4.3.0 (Phase 0): skeleton route + Cover + Table B. Data is fetched
 * from /api/pcs/documents/[id]/view which returns `viewPayload`.
 */
export default function LivingPcsViewPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const versionId = searchParams?.get('versionId') || '';
  const [viewPayload, setViewPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by the Wave 4.3.5 inline edit flow so the page refetches after a
  // new version is saved.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const qs = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    fetch(`/api/pcs/documents/${id}/view${qs}`)
      .then(async r => {
        if (!r.ok) throw new Error(`Failed to load view (${r.status})`);
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        setViewPayload(data);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, versionId]);

  if (loading) {
    // Inline skeleton mirrors loading.js so client-side refetches look the same.
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded w-2/3" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-48 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error || !viewPayload || viewPayload.error) {
    return (
      <p className="text-red-600">
        {error || viewPayload?.error || 'Document not found'}
      </p>
    );
  }

  return (
    <LivingPcsView
      viewPayload={viewPayload}
      onEdited={() => setReloadKey(k => k + 1)}
    />
  );
}
