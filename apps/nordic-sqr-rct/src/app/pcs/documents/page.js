'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PcsTable from '@/components/pcs/PcsTable';

export default function PcsDocumentsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-gray-400">Loading...</div>}>
      <PcsDocuments />
    </Suspense>
  );
}

// 2026-05-04 — view filters operate on the canonical / archived / template
// fields the platform already records. "Active" is the default and excludes
// duplicates (rows with `canonicalDocumentId` set) and archived rows. The
// other views surface specific subsets so noise is opt-in.
const VIEW_OPTIONS = [
  { id: 'active',            label: 'Active',             description: 'Canonical, non-archived rows. Hides duplicates.' },
  { id: 'needs-replacement', label: 'Needs Replacement',  description: 'Pre-Lauren / partial / no-template version. Re-upload required.' },
  { id: 'needs-revision',    label: 'Needs Revision',     description: 'File status is "Under revision".' },
  { id: 'has-duplicates',    label: 'Has Duplicates',     description: 'Canonical rows that have ≥1 marked duplicate.' },
  { id: 'archived',          label: 'Archived',           description: 'Archived rows + duplicates. Read-only audit view.' },
  { id: 'all',               label: 'All',                description: 'Every row, no filtering. Diagnostic only.' },
];

function PcsDocuments() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'active';
  const canEdit = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pcs/documents')
      .then(res => res.json())
      .then((data) => setDocuments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  // Build a Map<canonicalId, count> so we can show "+N duplicates" on canonical rows.
  const dupeCounts = useMemo(() => {
    const m = new Map();
    for (const d of documents) {
      if (d.canonicalDocumentId) m.set(d.canonicalDocumentId, (m.get(d.canonicalDocumentId) || 0) + 1);
    }
    return m;
  }, [documents]);

  const stats = useMemo(() => {
    const isActive = (d) => !d.canonicalDocumentId && !d.archived;
    const needsReplacement = (d) =>
      isActive(d) && (!d.templateVersion || d.templateVersion === 'Legacy pre-Lauren' || d.templateVersion === 'Lauren v1.0 partial');
    const needsRevision = (d) => isActive(d) && d.fileStatus === 'Under revision';
    return {
      total: documents.length,
      active: documents.filter(isActive).length,
      needsReplacement: documents.filter(needsReplacement).length,
      needsRevision: documents.filter(needsRevision).length,
      hasDuplicates: dupeCounts.size,
      archived: documents.filter((d) => d.archived || d.canonicalDocumentId).length,
    };
  }, [documents, dupeCounts]);

  const filtered = useMemo(() => {
    switch (view) {
      case 'active':
        return documents.filter((d) => !d.canonicalDocumentId && !d.archived);
      case 'needs-replacement':
        return documents.filter((d) =>
          !d.canonicalDocumentId && !d.archived &&
          (!d.templateVersion || d.templateVersion === 'Legacy pre-Lauren' || d.templateVersion === 'Lauren v1.0 partial')
        );
      case 'needs-revision':
        return documents.filter((d) => !d.canonicalDocumentId && !d.archived && d.fileStatus === 'Under revision');
      case 'has-duplicates':
        return documents.filter((d) => !d.canonicalDocumentId && !d.archived && dupeCounts.has(d.id));
      case 'archived':
        return documents.filter((d) => d.archived || d.canonicalDocumentId);
      case 'all':
      default:
        return documents;
    }
  }, [documents, view, dupeCounts]);

  async function handleUpdate(id, field, value) {
    await fetch(`/api/pcs/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, [field]: value } : d)));
  }

  // Track per-document filing state so the button shows feedback.
  const [filing, setFiling] = useState({});
  const [filed, setFiled] = useState({});

  async function fileReplacementRequest(docId) {
    setFiling((s) => ({ ...s, [docId]: true }));
    try {
      const res = await fetch(`/api/pcs/documents/${docId}/file-replacement-request`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setFiled((s) => ({ ...s, [docId]: true }));
    } catch (err) {
      setFiled((s) => ({ ...s, [docId]: { error: err.message } }));
    } finally {
      setFiling((s) => ({ ...s, [docId]: false }));
    }
  }

  function setView(next) {
    const sp = new URLSearchParams(searchParams);
    if (next === 'active') sp.delete('view');
    else sp.set('view', next);
    router.replace(`/pcs/documents${sp.toString() ? '?' + sp.toString() : ''}`);
  }

  const columns = [
    {
      key: 'pcsId',
      label: 'PCS ID',
      render: (val, row) => {
        const dupes = dupeCounts.get(row.id) || 0;
        const isDupe = !!row.canonicalDocumentId;
        return (
          <div className="flex items-center gap-2">
            <Link href={`/pcs/documents/${row.id}`} className="font-mono text-pacific-600 hover:underline font-medium">
              {typeof val === 'string' && val.startsWith('PCS-') ? val.slice(4) : val}
            </Link>
            {dupes > 0 ? (
              <Link
                href={`/pcs/documents?view=archived`}
                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200"
                title={`${dupes} duplicate row${dupes === 1 ? '' : 's'} folded into this canonical`}
              >
                +{dupes} dupe{dupes === 1 ? '' : 's'}
              </Link>
            ) : null}
            {isDupe ? (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700" title="Duplicate of another row">
                duplicate
              </span>
            ) : null}
          </div>
        );
      },
    },
    // 2026-05-04 column audit:
    //   removed: View (redundant — PCS ID is already a link)
    //   removed: Classification (19/38 empty, mixed semantics A/APPROVED/INTERNAL USE; not actionable in list view)
    //   removed: Approved date (0/38 populated)
    //   removed: File status (33/38 empty; better edited on the detail page)
    //   added:   Finished Good Name (33/38 populated — the actual product)
    //   added:   Format (33/38 populated — Capsule/Softgel/Gummy/etc.)
    {
      key: 'finishedGoodName',
      label: 'Product',
      render: (val) =>
        val ? <span className="text-sm text-gray-900">{val}</span>
            : <span className="text-xs text-gray-400">— unnamed —</span>,
    },
    {
      key: 'format',
      label: 'Format',
      render: (val) => val ? (
        <span className="inline-block whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {val}
        </span>
      ) : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      key: 'templateVersion',
      label: 'Template',
      render: (val) => {
        if (!val) return <span className="text-amber-700 text-xs font-medium">— none —</span>;
        const colors = {
          'Lauren v1.0': 'bg-green-100 text-green-700',
          'Lauren v1.0 partial': 'bg-yellow-100 text-yellow-800',
          'Legacy pre-Lauren': 'bg-orange-100 text-orange-800',
          Unknown: 'bg-gray-100 text-gray-600',
        };
        return (
          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colors[val] || colors.Unknown}`}>
            {val}
          </span>
        );
      },
    },
    {
      key: 'productStatus',
      label: 'Status',
      render: (val) => {
        if (!val) return <span className="text-gray-400 text-xs">—</span>;
        const colors = {
          'On-market': 'bg-green-100 text-green-700',
          'In development': 'bg-blue-100 text-blue-700',
          Retired: 'bg-gray-100 text-gray-600',
          Unknown: 'bg-gray-100 text-gray-500',
        };
        return (
          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colors[val] || colors.Unknown}`}>
            {val}
          </span>
        );
      },
    },
    // Inline replacement-request action — only renders meaningfully on the
    // Needs Replacement view (the button shows everywhere but is gated to
    // canEdit + non-Lauren-v1.0 + no prior file).
    ...(view === 'needs-replacement' && canEdit
      ? [{
          key: '_action',
          label: 'Action',
          sortable: false,
          render: (_val, row) => {
            const f = filed[row.id];
            if (f === true) {
              return <span className="text-xs text-green-700">✓ Request filed</span>;
            }
            if (f && f.error) {
              return <span className="text-xs text-red-700" title={f.error}>✗ Failed</span>;
            }
            return (
              <button
                type="button"
                disabled={!!filing[row.id]}
                onClick={() => fileReplacementRequest(row.id)}
                className="rounded border border-orange-400 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-40 whitespace-nowrap"
              >
                {filing[row.id] ? 'Filing…' : 'File replacement request'}
              </button>
            );
          },
        }]
      : []),
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">PCS Documents</h1>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const currentView = VIEW_OPTIONS.find((v) => v.id === view) || VIEW_OPTIONS[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PCS Documents</h1>
        <p className="mt-1 text-sm text-gray-500">{currentView.description}</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Stat label="Active" value={stats.active} active={view === 'active'} onClick={() => setView('active')} />
        <Stat label="Needs Replacement" value={stats.needsReplacement} className="text-orange-700" active={view === 'needs-replacement'} onClick={() => setView('needs-replacement')} />
        <Stat label="Needs Revision" value={stats.needsRevision} className="text-yellow-700" active={view === 'needs-revision'} onClick={() => setView('needs-revision')} />
        <Stat label="Has Duplicates" value={stats.hasDuplicates} className="text-amber-700" active={view === 'has-duplicates'} onClick={() => setView('has-duplicates')} />
        <Stat label="Archived" value={stats.archived} className="text-gray-500" active={view === 'archived'} onClick={() => setView('archived')} />
        <Stat label="All" value={stats.total} active={view === 'all'} onClick={() => setView('all')} />
      </div>

      {/* Banner — only on non-default views */}
      {view !== 'active' ? (
        <div className="rounded-lg border border-pacific-200 bg-pacific-50/60 px-4 py-2.5 text-sm flex items-center justify-between gap-3">
          <div className="text-gray-800">
            Showing <strong>{filtered.length}</strong> of {stats.total} rows — <span className="italic">{currentView.label}</span>.
          </div>
          <button
            type="button"
            onClick={() => setView('active')}
            className="text-xs font-medium text-pacific-700 hover:underline"
          >
            ← Back to Active
          </button>
        </div>
      ) : null}

      {/* "Mark for replacement" affordance — only when looking at Legacy / partial / no-template rows */}
      {view === 'needs-replacement' && filtered.length > 0 && canEdit ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
          <div className="font-semibold text-orange-900">{filtered.length} document{filtered.length === 1 ? '' : 's'} need re-uploading under Lauren&apos;s v1.0 template.</div>
          <p className="mt-1 text-orange-800">
            Each row below predates the standardized PCS template. Click into a document → use the
            &ldquo;Mark for replacement&rdquo; action to file a PCS Request asking Research to re-upload.
          </p>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center text-gray-500">
          No documents in this view.
        </div>
      ) : (
        <PcsTable
          columns={columns}
          data={filtered}
          onUpdate={handleUpdate}
          tableKey="documents"
          userId={user?.reviewerId}
          defaultSortKey="lastEditedTime"
          defaultSortDir="desc"
        />
      )}
    </div>
  );
}

function Stat({ label, value, className = '', active = false, onClick = null }) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={onClick || undefined}
      type={onClick ? 'button' : undefined}
      className={[
        'rounded-lg border bg-white p-2.5 text-left transition-colors',
        active ? 'border-pacific-400 ring-1 ring-pacific-200' : 'border-gray-200 hover:border-gray-300',
      ].join(' ')}
    >
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${className || 'text-gray-900'}`}>{value ?? '—'}</div>
    </Cmp>
  );
}
