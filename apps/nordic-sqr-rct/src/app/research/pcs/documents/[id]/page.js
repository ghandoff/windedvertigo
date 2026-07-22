'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import WordLayoutView from '@/components/pcs/WordLayoutView';
import RevisionSidePanel from '@/components/pcs/RevisionSidePanel';

export default function PcsDocumentDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wordPayload, setWordPayload] = useState(null);
  const [wordPayloadLoading, setWordPayloadLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pcs/documents/${id}`).then(r => r.json()),
      // Defensive: on API error, fall back to [] so the sourceType redirect
      // effect below never throws on versions.some(...) and strands the user.
      fetch(`/api/pcs/versions?documentId=${id}`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([docData, versionsData]) => {
      setDoc(docData);
      setVersions(Array.isArray(versionsData) ? versionsData : []);
    }).finally(() => setLoading(false));
  }, [id]);

  // Mark as mounted so the redirect effect knows client-side hydration is done.
  useEffect(() => { setHasMounted(true); }, []);

  // Redirect to the Living View (/view) unless this document has a historical
  // pdf-import or fuzzy-match version and the user explicitly wants Word view.
  // The redirect happens after data loads so we can check version sourceTypes.
  useEffect(() => {
    if (!hasMounted || loading) return;
    const hasHistoricalVersion = versions.some(
      v => v.sourceType === 'pdf-import' || v.sourceType === 'fuzzy-match'
    );
    if (!hasHistoricalVersion) {
      // No historical versions — Living View is the only destination.
      router.replace(`/research/pcs/documents/${id}/view`);
    }
    // If there are historical versions, stay on this page to show Word view.
  }, [hasMounted, loading, versions, id, router]);

  // Lazy-fetch the Word-view payload once historical version data is confirmed.
  useEffect(() => {
    if (wordPayload || wordPayloadLoading) return;
    setWordPayloadLoading(true);
    fetch(`/api/pcs/documents/${id}/view`)
      .then(r => r.json())
      .then(data => setWordPayload(data))
      .catch(() => setWordPayload({}))
      .finally(() => setWordPayloadLoading(false));
  }, [wordPayload, wordPayloadLoading, id]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-200 rounded w-96" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!doc || doc.error) {
    return <p className="text-red-600">Document not found</p>;
  }

  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  return (
    <div className="space-y-6">
      {/* Sticky toolbar header — stays accessible while scrolling long PCS bodies.
          top-14 = below the navbar (h-14). -mx + px keeps the full-width white
          background under the buttons even though the parent has page padding. */}
      <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href="/research/pcs/documents" className="text-sm text-pacific-600 hover:underline">
            ← All documents
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">{doc.pcsId}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href={`/research/pcs/documents/${id}/view`}
              className="px-4 py-2 text-sm font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 transition-colors"
            >
              ← Back to Living View
            </Link>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title="Revision history"
            >
              History
            </button>
          </div>
      </div>

      {/* Word view — historical PDF import and fuzzy-match versions only */}
      <>
        {canWrite ? (
          <div className="mb-4 rounded-lg border border-pacific-200 bg-pacific-50/60 text-gray-800 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
            <div>
              <span className="font-semibold">Word view is read-only.</span>{' '}
              This shows the original PDF import. Go to <em>Living View</em> to edit claims and formula lines.
            </div>
            <Link
              href={`/research/pcs/documents/${id}/view`}
              className="whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium text-white bg-pacific-600 hover:bg-pacific-700"
            >
              Open Living View
            </Link>
          </div>
        ) : null}
          <WordLayoutView doc={doc} viewPayload={wordPayloadLoading ? null : wordPayload} />
        </>

      {/* Wave 8 Phase D — revisions side panel */}
      <RevisionSidePanel
        entityType="pcs_document"
        entityId={doc.id}
        entityLabel={doc.pcsId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
