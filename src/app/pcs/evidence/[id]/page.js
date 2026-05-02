'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import { EVIDENCE_TYPES, SQR_RISK_OF_BIAS } from '@/lib/pcs-config';

function Field({ label, value, editing, onEdit, type = 'text', options }) {
  if (editing) {
    if (type === 'select') {
      return (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
          <select
            value={value || ''}
            onChange={e => onEdit(e.target.value || null)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          >
            <option value="">—</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }
    if (type === 'number') {
      return (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
          <input
            type="number"
            value={value ?? ''}
            onChange={e => onEdit(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        </div>
      );
    }
    if (type === 'textarea') {
      return (
        <div className="col-span-full">
          <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
          <textarea
            value={value || ''}
            onChange={e => onEdit(e.target.value)}
            rows={4}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        </div>
      );
    }
    if (type === 'url') {
      return (
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
          <input
            type="url"
            value={value || ''}
            onChange={e => onEdit(e.target.value || null)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        </div>
      );
    }
    return (
      <div>
        <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
        <input
          type="text"
          value={value || ''}
          onChange={e => onEdit(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      {type === 'url' && value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-pacific-600 hover:underline break-all">{value}</a>
      ) : (
        <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
      )}
    </div>
  );
}

export default function PcsEvidenceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [sendingToReview, setSendingToReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichFeedback, setEnrichFeedback] = useState(null);

  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  useEffect(() => {
    fetch(`/api/pcs/evidence/${id}`)
      .then(r => r.json())
      .then(data => {
        setEvidence(data);
        setDraft(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function updateDraft(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changes = {};
      for (const key of ['name', 'citation', 'doi', 'pmid', 'url', 'evidenceType', 'publicationYear', 'canonicalSummary']) {
        if (draft[key] !== evidence[key]) changes[key] = draft[key];
      }
      if (JSON.stringify(draft.ingredient) !== JSON.stringify(evidence.ingredient)) {
        changes.ingredient = draft.ingredient;
      }

      if (Object.keys(changes).length > 0) {
        const res = await fetch(`/api/pcs/evidence/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        const updated = await res.json();
        setEvidence(updated);
        setDraft(updated);
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(evidence);
    setEditing(false);
  }

  async function handleSendToReview() {
    setSendingToReview(true);
    setReviewFeedback(null);
    try {
      const res = await fetch('/api/pcs/evidence/send-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const r = data.result;
      if (r.status === 'created') {
        setReviewFeedback({ type: 'success', message: 'Sent to SQR-RCT reviewer queue' });
      } else if (r.status === 'duplicate') {
        setReviewFeedback({ type: 'info', message: 'Already in reviewer queue' });
      } else {
        setReviewFeedback({ type: 'warning', message: r.reason || 'Not eligible for review' });
      }
    } catch (err) {
      setReviewFeedback({ type: 'error', message: err.message });
    } finally {
      setSendingToReview(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichFeedback(null);
    try {
      const res = await fetch(`/api/pcs/evidence/${id}/enrich`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (data.enriched && data.changes?.length > 0) {
        setEnrichFeedback({
          type: 'success',
          message: `Enriched: ${data.changes.join(', ')}`,
          reasoning: data.ingredientReasoning,
        });
        // Refresh the evidence data
        const refreshRes = await fetch(`/api/pcs/evidence/${id}`);
        const refreshed = await refreshRes.json();
        setEvidence(refreshed);
        setDraft(refreshed);
      } else if (data.enriched && data.noChanges) {
        setEnrichFeedback({ type: 'info', message: 'All fields already populated' });
      } else {
        setEnrichFeedback({ type: 'warning', message: data.reason || 'Could not enrich' });
      }
    } catch (err) {
      setEnrichFeedback({ type: 'error', message: err.message });
    } finally {
      setEnriching(false);
    }
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

  if (!evidence || evidence.error) {
    return <p className="text-red-600">Evidence item not found</p>;
  }

  const sqrColor = evidence.sqrScore != null
    ? (evidence.sqrScore >= 17 ? 'text-green-600' : evidence.sqrScore >= 11 ? 'text-yellow-600' : 'text-red-600')
    : 'text-gray-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/pcs/evidence" className="text-sm text-pacific-600 hover:underline">
            ← Evidence Library
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {editing ? (
              <input
                type="text"
                value={draft.name || ''}
                onChange={e => updateDraft('name', e.target.value)}
                className="text-2xl font-bold text-gray-900 border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
              />
            ) : (
              evidence.name || 'Untitled'
            )}
          </h1>
        </div>
        {canWrite && !editing && (
          <div className="flex gap-2">
            {evidence.pdf && (
              <a
                href={evidence.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                View PDF
              </a>
            )}
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {enriching ? 'Enriching...' : 'Enrich from PubMed'}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm font-medium text-pacific-600 border border-pacific-600 rounded-md hover:bg-pacific-50 transition-colors"
            >
              Edit
            </button>
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

      {/* Enrich feedback */}
      {enrichFeedback && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          enrichFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          enrichFeedback.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
          enrichFeedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <p>{enrichFeedback.message}</p>
          {enrichFeedback.reasoning && (
            <p className="mt-1 text-xs opacity-75">Ingredient reasoning: {enrichFeedback.reasoning}</p>
          )}
        </div>
      )}

      {/* Core metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Evidence Type" value={editing ? draft.evidenceType : evidence.evidenceType} editing={editing} onEdit={v => updateDraft('evidenceType', v)} type="select" options={EVIDENCE_TYPES} />
        <Field label="Publication Year" value={editing ? draft.publicationYear : evidence.publicationYear} editing={editing} onEdit={v => updateDraft('publicationYear', v)} type="number" />
        <Field label="DOI" value={editing ? draft.doi : evidence.doi} editing={editing} onEdit={v => updateDraft('doi', v)} />
        <Field label="PMID" value={editing ? draft.pmid : evidence.pmid} editing={editing} onEdit={v => updateDraft('pmid', v)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="URL" value={editing ? draft.url : evidence.url} editing={editing} onEdit={v => updateDraft('url', v)} type="url" />
        <div>
          <p className="text-xs text-gray-500 uppercase">PDF</p>
          {evidence.pdf ? (
            <a href={evidence.pdf} target="_blank" rel="noopener noreferrer" className="text-sm text-pacific-600 hover:underline inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download PDF
            </a>
          ) : (
            <p className="text-sm text-gray-400">No PDF available</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Ingredients</p>
          {editing ? (
            <input
              type="text"
              value={(draft.ingredient || []).join(', ')}
              onChange={e => updateDraft('ingredient', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="Comma-separated"
              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
            />
          ) : (
            <p className="text-sm font-medium text-gray-900">
              {evidence.ingredient?.length ? evidence.ingredient.join(', ') : '—'}
            </p>
          )}
        </div>
        <Field label="EndNote Group" value={evidence.endnoteGroup} />
        <Field label="EndNote Record ID" value={evidence.endnoteRecordId} />
      </div>

      {/* Citation */}
      <div>
        <p className="text-xs text-gray-500 uppercase mb-1">Citation</p>
        {editing ? (
          <textarea
            value={draft.citation || ''}
            onChange={e => updateDraft('citation', e.target.value)}
            rows={3}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        ) : (
          <p className="text-sm text-gray-700">{evidence.citation || '—'}</p>
        )}
      </div>

      {/* Summary */}
      <div>
        <p className="text-xs text-gray-500 uppercase mb-1">Research Summary</p>
        {editing ? (
          <textarea
            value={draft.canonicalSummary || ''}
            onChange={e => updateDraft('canonicalSummary', e.target.value)}
            rows={5}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500"
          />
        ) : evidence.canonicalSummary ? (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{evidence.canonicalSummary}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No summary available</p>
        )}
      </div>

      {/* SQR Review */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">SQR-RCT Review</h2>
          {canWrite && !evidence.sqrReviewed && evidence.doi && !editing && (
            <button
              onClick={handleSendToReview}
              disabled={sendingToReview}
              className="px-3 py-1.5 text-xs font-medium text-pacific-700 bg-pacific-50 border border-pacific-200 rounded-md hover:bg-pacific-100 disabled:opacity-50 transition-colors"
            >
              {sendingToReview ? 'Sending...' : 'Send to SQR-RCT Review'}
            </button>
          )}
        </div>
        {reviewFeedback && (
          <div className={`mb-3 px-3 py-2 rounded-md text-sm ${
            reviewFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            reviewFeedback.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
            reviewFeedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {reviewFeedback.message}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Reviewed</p>
            <p className="text-sm font-medium">
              {evidence.sqrReviewed
                ? <span className="text-green-600">Yes</span>
                : <span className="text-gray-400">No</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Score</p>
            <p className={`text-sm font-medium ${sqrColor}`}>
              {evidence.sqrScore != null ? evidence.sqrScore : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Risk of Bias</p>
            <p className="text-sm font-medium text-gray-900">{evidence.sqrRiskOfBias || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Review Date</p>
            <p className="text-sm font-medium text-gray-900">{evidence.sqrReviewDate || '—'}</p>
          </div>
        </div>
        {evidence.sqrReviewUrl && (
          <div className="mt-2">
            <a href={evidence.sqrReviewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-pacific-600 hover:underline">
              View SQR-RCT Review →
            </a>
          </div>
        )}
      </div>

      {/* Relationships */}
      {(evidence.usedInPacketIds?.length > 0 || evidence.pcsReferenceIds?.length > 0) && (
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Linked Records</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Evidence Packets</p>
              <p className="text-sm font-medium text-gray-900">{evidence.usedInPacketIds?.length || 0} linked</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">PCS References</p>
              <p className="text-sm font-medium text-gray-900">{evidence.pcsReferenceIds?.length || 0} linked</p>
            </div>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-t pt-4 text-xs text-gray-400">
        Created: {new Date(evidence.createdTime).toLocaleString()} · Last edited: {new Date(evidence.lastEditedTime).toLocaleString()}
      </div>
    </div>
  );
}
