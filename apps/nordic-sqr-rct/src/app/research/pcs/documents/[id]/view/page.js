'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import LivingPcsView from '@/components/pcs/living-view/LivingPcsView';
import InlineField from '@/components/pcs/InlineField';

const FILE_STATUSES = ['Static', 'Under revision', 'Unknown'];

function fileStatusColor(status) {
  if (status === 'Static') return 'bg-green-100 text-green-700';
  if (status === 'Under revision') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

function DocMetadataHeader({ doc, documentId, hasHistoricalVersion, canWrite, onDocSaved }) {
  const [metaOpen, setMetaOpen] = useState(false);
  const [localDoc, setLocalDoc] = useState(doc);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteStatus, setDeleteStatus] = useState(null); // null | 'submitting' | 'sent' | 'error'

  // Sync if parent gets fresh doc (e.g. after full reload).
  useEffect(() => { setLocalDoc(doc); }, [doc]);

  async function patchField(fieldPath, value) {
    const res = await fetch(`/api/pcs/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldPath]: value }),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const updated = await res.json();
    setLocalDoc(updated);
    if (onDocSaved) onDocSaved(updated);
    return updated;
  }

  async function submitDeleteRequest() {
    if (!deleteReason.trim()) return;
    setDeleteStatus('submitting');
    try {
      const res = await fetch('/api/pcs/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: `Delete request: PCS Document — ${localDoc.pcsId || documentId}`,
          requestType: 'Delete',
          requestNotes: deleteReason.trim(),
          specificField: `/research/pcs/documents/${documentId}/view`,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setDeleteStatus('sent');
      setDeleteOpen(false);
    } catch {
      setDeleteStatus('error');
    }
  }

  const hasAnyChip = localDoc.fileStatus || localDoc.classification || localDoc.finishedGoodName;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {localDoc.fileStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${fileStatusColor(localDoc.fileStatus)}`}>
              {localDoc.fileStatus}
            </span>
          )}
          {localDoc.classification && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pacific-50 text-pacific-700 border border-pacific-200">
              {localDoc.classification}
            </span>
          )}
          {localDoc.finishedGoodName && (
            <span className="text-xs text-gray-500 truncate">{localDoc.finishedGoodName}</span>
          )}
          {!hasAnyChip && !metaOpen && canWrite && (
            <span className="text-xs text-gray-400 italic">No metadata set</span>
          )}
          {hasHistoricalVersion && (
            <Link
              href={`/research/pcs/documents/${documentId}`}
              className="text-xs text-pacific-600 hover:underline whitespace-nowrap"
            >
              View PDF import →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {canWrite && deleteStatus !== 'sent' && (
            <button
              type="button"
              onClick={() => { setDeleteOpen(o => !o); setDeleteStatus(null); }}
              className="text-xs text-red-400 hover:text-red-600 transition whitespace-nowrap"
            >
              {deleteOpen ? 'Cancel' : 'Request deletion'}
            </button>
          )}
          {deleteStatus === 'sent' && (
            <span className="text-xs text-green-600">Deletion request sent</span>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={() => setMetaOpen(o => !o)}
              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              {metaOpen ? 'Close ↑' : 'Edit metadata ↓'}
            </button>
          )}
        </div>
      </div>

      {/* Inline delete request form */}
      {deleteOpen && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-red-800">
            Deletion requires admin approval. Sharon and the admin team will be notified.
          </p>
          <textarea
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            placeholder="Reason for deletion (required)"
            rows={2}
            className="w-full text-xs rounded border border-red-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitDeleteRequest}
              disabled={!deleteReason.trim() || deleteStatus === 'submitting'}
              className="text-xs px-3 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition"
            >
              {deleteStatus === 'submitting' ? 'Submitting…' : 'Submit request'}
            </button>
            {deleteStatus === 'error' && (
              <span className="text-xs text-red-600">Failed — please try again.</span>
            )}
          </div>
        </div>
      )}

      {metaOpen && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">File status</div>
            <InlineField
              value={localDoc.fileStatus}
              variant="select"
              options={FILE_STATUSES}
              fieldName="file status"
              canEdit={canWrite}
              onSave={v => patchField('fileStatus', v)}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Classification</div>
            <InlineField
              value={localDoc.classification}
              variant="text"
              placeholder="e.g. Proprietary Formula"
              fieldName="classification"
              canEdit={canWrite}
              onSave={v => patchField('classification', v)}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Finished good name</div>
            <InlineField
              value={localDoc.finishedGoodName}
              variant="text"
              placeholder="Product name"
              fieldName="finished good name"
              canEdit={canWrite}
              onSave={v => patchField('finishedGoodName', v)}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">SAP material #</div>
            <InlineField
              value={localDoc.sapMaterialNo}
              variant="text"
              placeholder="e.g. 123456"
              fieldName="SAP material number"
              canEdit={canWrite}
              onSave={v => patchField('sapMaterialNo', v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LivingPcsViewContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const versionId = searchParams?.get('versionId') || '';
  const { user } = useAuth();
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [viewPayload, setViewPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Track whether this doc has any pdf-import or fuzzy-match versions.
  const [hasHistoricalVersion, setHasHistoricalVersion] = useState(false);

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
    return () => { cancelled = true; };
  }, [id, reloadKey, versionId]);

  // Fetch versions once to check for pdf-import/fuzzy-match history.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pcs/versions?documentId=${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(versions => {
        if (cancelled) return;
        const hasHistorical = Array.isArray(versions) && versions.some(
          v => v.sourceType === 'pdf-import' || v.sourceType === 'fuzzy-match'
        );
        setHasHistoricalVersion(hasHistorical);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-full" />
        <div className="h-10 bg-gray-200 rounded w-2/3" />
        <div className="h-32 bg-gray-200 rounded" />
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
    <div className="max-w-4xl mx-auto space-y-4">
      <DocMetadataHeader
        doc={viewPayload.document}
        documentId={id}
        hasHistoricalVersion={hasHistoricalVersion}
        canWrite={canWrite}
      />
      <LivingPcsView
        viewPayload={viewPayload}
        onEdited={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}

export default function LivingPcsViewPage() {
  return (
    <Suspense fallback={null}>
      <LivingPcsViewContent />
    </Suspense>
  );
}
