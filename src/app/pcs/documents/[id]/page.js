'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PcsTable from '@/components/pcs/PcsTable';
import WordLayoutView from '@/components/pcs/WordLayoutView';
import RevisionSidePanel from '@/components/pcs/RevisionSidePanel';

import { FORMATS } from '@/lib/pcs-config';

const FILE_STATUSES = ['Static', 'Under revision', 'Unknown'];
const PRODUCT_STATUSES = ['Active', 'Discontinued', 'Unknown'];
const TRANSFER_STATUSES = ['Not started', 'In progress', 'Complete', 'Unknown'];

/**
 * Wave 8 Phase C2 — local inline-edit control. A parallel worktree (C1) may
 * introduce `src/components/pcs/InlineEditField.js`; if so, the parent merge
 * will consolidate. Keeping this local for now keeps the worktree buildable.
 *
 * Variants: 'text' (single-line), 'textarea', 'select', 'tags' (comma list).
 * Submits via PATCH /api/admin/pcs/documents/[id] — guarded server-side by
 * `pcs.documents:edit`, so this also serves as the canWrite UX gate.
 */
function InlineField({
  documentId,
  fieldPath,
  value,
  variant = 'text',
  options,          // for variant='select'
  placeholder,
  displayClassName = 'text-sm font-medium text-gray-900',
  canEdit = true,
  onSaved,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!editing) {
      setDraft(
        variant === 'tags'
          ? (Array.isArray(value) ? value.join(', ') : '')
          : (value ?? '')
      );
    }
  }, [value, editing, variant]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      let outVal = draft;
      if (variant === 'tags') {
        outVal = String(draft || '').split(',').map(s => s.trim()).filter(Boolean);
      } else if (variant === 'select' && draft === '') {
        outVal = null;
      }
      const res = await fetch(`/api/admin/pcs/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, value: outVal }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setEditing(false);
      if (onSaved) onSaved(updated);
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEditing(false);
    setErr(null);
  }

  if (!canEdit || !editing) {
    const isEmpty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    return (
      <div className="group flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {variant === 'tags' && Array.isArray(value) && value.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {value.map(v => (
                <span key={v} className="px-2 py-0.5 text-xs font-mono bg-white border border-gray-200 rounded">
                  {v}
                </span>
              ))}
            </div>
          ) : (
            <p className={isEmpty ? 'text-sm text-gray-400' : displayClassName}>
              {isEmpty ? '—' : String(value)}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-pacific-600 hover:underline shrink-0"
            aria-label={`Edit ${fieldPath}`}
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {variant === 'select' ? (
        <select
          value={draft || ''}
          onChange={e => setDraft(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-white focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          disabled={saving}
          autoFocus
        >
          <option value="">—</option>
          {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : variant === 'textarea' ? (
        <textarea
          value={draft || ''}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          disabled={saving}
          autoFocus
        />
      ) : (
        <input
          type="text"
          value={draft || ''}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          disabled={saving}
          autoFocus
        />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-2 py-0.5 text-xs font-medium text-white bg-pacific-600 rounded hover:bg-pacific-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}

export default function PcsDocumentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  // Wave 4.5.1 — Outstanding Research Requests card
  const [openRequests, setOpenRequests] = useState([]);
  const [requestsExpanded, setRequestsExpanded] = useState(false);
  // Wave 8 Phase B — view mode toggle (compact | word). Word layout
  // mirrors Lauren's Word template for easier team transition off .docx.
  const [viewMode, setViewMode] = useState('compact');
  const [wordPayload, setWordPayload] = useState(null);
  const [wordPayloadLoading, setWordPayloadLoading] = useState(false);
  // Wave 8 Phase D — revisions side panel
  const [historyOpen, setHistoryOpen] = useState(false);

  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pcs/documents/${id}`).then(r => r.json()),
      fetch(`/api/pcs/versions?documentId=${id}`).then(r => r.json()),
      fetch(`/api/pcs/requests?documentId=${id}&status=open`).then(r => r.json()).catch(() => []),
    ]).then(([docData, versionsData, requestsData]) => {
      setDoc(docData);
      setDraft(docData);
      setVersions(versionsData);
      setOpenRequests(Array.isArray(requestsData) ? requestsData.filter(r => r?.status !== 'Done') : []);
    }).finally(() => setLoading(false));
  }, [id]);

  // Wave 8 Phase B — hydrate view mode from localStorage (avoids SSR mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pcsDocViewMode');
      if (saved === 'word' || saved === 'compact') setViewMode(saved);
    } catch { /* ignore */ }
  }, []);

  // Lazy-fetch the Word-view payload when the user switches to Word mode
  useEffect(() => {
    if (viewMode !== 'word' || wordPayload || wordPayloadLoading) return;
    setWordPayloadLoading(true);
    fetch(`/api/pcs/documents/${id}/view`)
      .then(r => r.json())
      .then(data => setWordPayload(data))
      .catch(() => setWordPayload({}))
      .finally(() => setWordPayloadLoading(false));
  }, [viewMode, wordPayload, wordPayloadLoading, id]);

  function handleViewModeChange(mode) {
    setViewMode(mode);
    try { localStorage.setItem('pcsDocViewMode', mode); } catch { /* ignore */ }
  }

  function updateDraft(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changes = {};
      for (const key of [
        'fileStatus', 'productStatus', 'transferStatus', 'documentNotes',
        // Lauren's template Table B — added 2026-04-18
        'finishedGoodName', 'format', 'sapMaterialNo',
      ]) {
        if (draft[key] !== doc[key]) changes[key] = draft[key];
      }
      // SKUs is an array — compare by JSON serialization
      if (JSON.stringify(draft.skus || []) !== JSON.stringify(doc.skus || [])) {
        changes.skus = draft.skus || [];
      }

      if (Object.keys(changes).length > 0) {
        const res = await fetch(`/api/pcs/documents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        const updated = await res.json();
        setDoc(updated);
        setDraft(updated);
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(doc);
    setEditing(false);
  }

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

  const versionColumns = [
    {
      key: 'version',
      label: 'Version',
      render: (val) => (
        <span className="font-medium">{val}</span>
      ),
    },
    { key: 'effectiveDate', label: 'Effective date' },
    {
      key: 'isLatest',
      label: 'Latest',
      render: (val) => val ? <span className="text-green-600 font-medium">Yes</span> : '—',
    },
    {
      key: 'claimIds',
      label: 'Claims',
      sortable: false,
      render: (val) => val?.length || 0,
    },
    {
      key: 'formulaLineIds',
      label: 'Formula lines',
      sortable: false,
      render: (val) => val?.length || 0,
    },
    {
      key: 'referenceIds',
      label: 'References',
      sortable: false,
      render: (val) => val?.length || 0,
    },
    { key: 'versionNotes', label: 'Notes' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/pcs/documents" className="text-sm text-pacific-600 hover:underline">
            ← All documents
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{doc.pcsId}</h1>
        </div>
        {!editing && (
          <div className="flex items-center gap-3">
            {/* Wave 8 Phase B — view mode segmented control */}
            <div
              className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm font-medium"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                onClick={() => handleViewModeChange('compact')}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-pacific-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={viewMode === 'compact'}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('word')}
                className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${
                  viewMode === 'word'
                    ? 'bg-pacific-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={viewMode === 'word'}
              >
                Word
              </button>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title="Revision history"
            >
              History
            </button>
            <Link
              href={`/pcs/documents/${id}/view`}
              className="px-4 py-2 text-sm font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 transition-colors"
            >
              Open Living View
            </Link>
            {canWrite && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-pacific-600 border border-pacific-600 rounded-md hover:bg-pacific-50 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-pacific-600 rounded-md hover:bg-pacific-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Wave 8 Phase B — Word layout replaces compact body when toggled */}
      {viewMode === 'word' ? (
        <WordLayoutView doc={doc} viewPayload={wordPayloadLoading ? null : wordPayload} />
      ) : (
      <>
      {/* Document metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">Classification</p>
          <p className="text-sm font-medium text-gray-900">{doc.classification || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">File status</p>
          {editing ? (
            <select
              value={draft.fileStatus || ''}
              onChange={e => updateDraft('fileStatus', e.target.value || null)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            >
              <option value="">—</option>
              {FILE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <InlineField
              documentId={id}
              fieldPath="fileStatus"
              value={doc.fileStatus}
              variant="select"
              options={FILE_STATUSES}
              canEdit={canWrite}
              onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
            />
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Product status</p>
          {editing ? (
            <select
              value={draft.productStatus || ''}
              onChange={e => updateDraft('productStatus', e.target.value || null)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            >
              <option value="">—</option>
              {PRODUCT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <InlineField
              documentId={id}
              fieldPath="productStatus"
              value={doc.productStatus}
              variant="select"
              options={PRODUCT_STATUSES}
              canEdit={canWrite}
              onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
            />
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Transfer status</p>
          {editing ? (
            <select
              value={draft.transferStatus || ''}
              onChange={e => updateDraft('transferStatus', e.target.value || null)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            >
              <option value="">—</option>
              {TRANSFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <InlineField
              documentId={id}
              fieldPath="transferStatus"
              value={doc.transferStatus}
              variant="select"
              options={TRANSFER_STATUSES}
              canEdit={canWrite}
              onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
            />
          )}
        </div>
      </div>

      {/* Product Details — Lauren's template Table B */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Product Details</h2>
          <span className="text-xs text-gray-400">Lauren&apos;s template Table B</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase">Finished Good Name</p>
            {editing ? (
              <input
                type="text"
                value={draft.finishedGoodName || ''}
                onChange={e => updateDraft('finishedGoodName', e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full"
                placeholder="e.g. Ultimate Omega-D3 Minis"
              />
            ) : (
              <InlineField
                documentId={id}
                fieldPath="finishedGoodName"
                value={doc.finishedGoodName}
                variant="text"
                placeholder="e.g. Ultimate Omega-D3 Minis"
                canEdit={canWrite}
                onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
              />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Format (FMT)</p>
            {editing ? (
              <select
                value={draft.format || ''}
                onChange={e => updateDraft('format', e.target.value || null)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-white"
              >
                <option value="">—</option>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <InlineField
                documentId={id}
                fieldPath="format"
                value={doc.format}
                variant="select"
                options={FORMATS}
                canEdit={canWrite}
                onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
              />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">SAP Material No.</p>
            {editing ? (
              <input
                type="text"
                value={draft.sapMaterialNo || ''}
                onChange={e => updateDraft('sapMaterialNo', e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full font-mono"
                placeholder="e.g. 41490"
              />
            ) : (
              <InlineField
                documentId={id}
                fieldPath="sapMaterialNo"
                value={doc.sapMaterialNo}
                variant="text"
                placeholder="e.g. 41490"
                displayClassName="text-sm font-mono font-medium text-gray-900"
                canEdit={canWrite}
                onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
              />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">SKUs</p>
            {editing ? (
              <input
                type="text"
                value={(draft.skus || []).join(', ')}
                onChange={e => updateDraft('skus', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full font-mono"
                placeholder="Comma-separated SKU codes"
              />
            ) : (
              <InlineField
                documentId={id}
                fieldPath="skus"
                value={doc.skus}
                variant="tags"
                placeholder="Comma-separated SKU codes"
                canEdit={canWrite}
                onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Research Requests — Wave 4.5.1 */}
      <div className={`rounded-lg border ${openRequests.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'} p-4 space-y-2`}>
        <button
          type="button"
          onClick={() => setRequestsExpanded(v => !v)}
          className="flex items-center justify-between w-full"
          aria-expanded={requestsExpanded}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">Outstanding Research Requests</h2>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                openRequests.length > 0 ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'
              }`}
            >
              {openRequests.length} open
            </span>
          </div>
          <span className="text-xs text-gray-500">{requestsExpanded ? '▾' : '▸'}</span>
        </button>
        {requestsExpanded && (
          <div className="space-y-1.5 pt-1">
            {openRequests.length === 0 ? (
              <p className="text-xs text-gray-600">No outstanding validation requests for this document.</p>
            ) : (
              <>
                <ul className="divide-y divide-amber-200 border border-amber-200 rounded-md bg-white">
                  {openRequests.slice(0, 10).map(r => (
                    <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden="true">
                          {r.requestType === 'template-drift' ? '🔧'
                            : r.requestType === 'low-confidence' ? '🔍'
                            : r.requestType === 'label-drift' ? '🏷️' : '•'}
                        </span>
                        <span className="font-mono truncate max-w-[10rem]">{r.specificField || r.request || '—'}</span>
                        {r.assignedRole && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-700">
                            {r.assignedRole}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500">
                          {r.assignees?.length > 0
                            ? (r.assignees[0].name || r.assignees[0].email || 'assigned')
                            : 'unassigned'}
                        </span>
                        {typeof r.ageDays === 'number' && (
                          <span className={r.ageDays > 14 ? 'text-orange-700 font-medium' : 'text-gray-500'}>
                            {r.ageDays}d
                          </span>
                        )}
                        <span className="text-gray-600">{r.status || '—'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/pcs/requests?filter=all&pcsId=${id}`}
                  className="text-xs text-pacific-600 hover:underline inline-block"
                >
                  View all →
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
        {editing ? (
          <textarea
            value={draft.documentNotes || ''}
            onChange={e => updateDraft('documentNotes', e.target.value)}
            rows={3}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        ) : (
          <InlineField
            documentId={id}
            fieldPath="documentNotes"
            value={doc.documentNotes}
            variant="textarea"
            placeholder="Document-level notes"
            canEdit={canWrite}
            onSaved={(updated) => { setDoc(updated); setDraft(updated); }}
          />
        )}
      </div>

      {/* Versions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Versions ({versions.length})</h2>
        <PcsTable columns={versionColumns} data={versions} emptyMessage="No versions found" />
      </div>

      {/* Timestamps */}
      <div className="border-t pt-4 text-xs text-gray-400">
        Created: {new Date(doc.createdTime).toLocaleString()} · Last edited: {new Date(doc.lastEditedTime).toLocaleString()}
      </div>
      </>
      )}

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
