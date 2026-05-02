'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import CommentThread from '@/components/pcs/CommentThread';
import ClaimDoseRequirements from '@/components/pcs/ClaimDoseRequirements';
import RevisionSidePanel from '@/components/pcs/RevisionSidePanel';
import { EVIDENCE_ROLES, SUBSTANTIATION_TIERS } from '@/lib/pcs-config';
import { can } from '@/lib/auth/capabilities';

const BUCKET_COLORS = {
  '3A': 'bg-green-100 text-green-800 border-green-200',
  '3B': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '3C': 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_OPTIONS = ['Authorized', 'Proposed', 'Not approved', 'NA', 'Unknown'];
const BUCKET_OPTIONS = ['3A', '3B', '3C'];

/* ------------------------------------------------------------------ */
/*  Wave 8 Phase C3 — audited inline-edit control                      */
/* ------------------------------------------------------------------ */
function InlineEditField({ claimId, fieldPath, label, value, type = 'text', options, onSaved, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload =
        type === 'number'
          ? (draft === '' ? null : Number(draft))
          : type === 'select'
          ? (draft || null)
          : draft;
      const res = await fetch(`/api/admin/pcs/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, value: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `HTTP ${res.status}`);
        return;
      }
      const updated = await res.json();
      setEditing(false);
      onSaved?.(updated);
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const display = value == null || value === '' ? <span className="text-gray-400 italic">—</span> : String(value);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {!editing && !disabled && (
          <button
            onClick={() => { setDraft(value ?? ''); setEditing(true); }}
            className="text-xs text-pacific-600 hover:text-pacific-800"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1 space-y-1">
          {type === 'select' ? (
            <select
              value={draft ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            >
              <option value="">—</option>
              {(options || []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : type === 'number' ? (
            <input
              type="number"
              value={draft ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            />
          ) : (
            <textarea
              value={draft ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-2.5 py-1 bg-pacific-600 text-white text-xs font-medium rounded hover:bg-pacific-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(value ?? ''); setError(null); }}
              disabled={saving}
              className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-900">{display}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Link Evidence Modal                                                */
/* ------------------------------------------------------------------ */
function LinkEvidenceModal({ claimId, existingEvidenceItemIds, onLinked, onClose }) {
  const [evidence, setEvidence] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [selectedRole, setSelectedRole] = useState(EVIDENCE_ROLES[0]);
  const [toast, setToast] = useState(null);
  const backdropRef = useRef(null);

  useEffect(() => {
    fetch('/api/pcs/evidence')
      .then(r => r.ok ? r.json() : [])
      .then(data => setEvidence(Array.isArray(data) ? data : []))
      .catch(() => setEvidence([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = evidence.filter(item => {
    if (existingEvidenceItemIds.includes(item.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.doi || '').toLowerCase().includes(q) ||
      (item.ingredient || []).some(i => i.toLowerCase().includes(q))
    );
  });

  async function linkItem(item) {
    setLinking(item.id);
    try {
      const res = await fetch('/api/pcs/evidence-packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          pcsClaimId: claimId,
          evidenceItemId: item.id,
          evidenceRole: selectedRole,
        }),
      });
      if (res.ok) {
        setToast(`Linked "${item.name.slice(0, 40)}${item.name.length > 40 ? '...' : ''}"`);
        setTimeout(() => setToast(null), 2500);
        onLinked();
      }
    } catch { /* silent */ }
    finally { setLinking(null); }
  }

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Link Evidence</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, DOI, or ingredient..."
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-gray-500">Role:</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            >
              {EVIDENCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {search ? 'No matching evidence items' : 'All evidence items are already linked'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => linkItem(item)}
                  disabled={linking === item.id}
                  className="w-full text-left border border-gray-100 rounded-lg p-3 hover:bg-pacific-50 hover:border-pacific-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name || 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.doi && (
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{item.doi}</span>
                        )}
                        {item.ingredient?.length > 0 && (
                          <span className="text-xs text-gray-500">{item.ingredient.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.evidenceType && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.evidenceType}</span>
                      )}
                      {item.sqrScore != null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          item.sqrScore >= 70 ? 'bg-green-100 text-green-700'
                          : item.sqrScore >= 40 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                          SQR {item.sqrScore}
                        </span>
                      )}
                    </div>
                  </div>
                  {linking === item.id && (
                    <p className="text-xs text-pacific-600 mt-1">Linking...</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="px-5 pb-3">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Evidence Packet Row — Wave 8 Phase C4 inline edit                  */
/* ------------------------------------------------------------------ */
function EvidencePacketRow({ packet, canEdit, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(packet);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) setDraft(packet);
  }, [packet, editing]);

  async function patchField(fieldPath, value) {
    const res = await fetch(`/api/admin/pcs/evidence/${packet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldPath, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Update failed');
    }
    return data;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Send one PATCH per changed field so each edit lands as its own
      // revision row (mutate() logs per-fieldPath).
      const candidates = [
        'name',
        'substantiationTier',
        'evidenceRole',
        'keyTakeaway',
        'relevanceNote',
        'studyDesignSummary',
        'sampleSize',
        'meetsSqrThreshold',
        'nullResultRationale',
      ];
      let latest = packet;
      for (const key of candidates) {
        const before = packet[key];
        const after = draft[key];
        const changed = key === 'sampleSize'
          ? (before ?? null) !== (after === '' || after == null ? null : Number(after))
          : (before ?? '') !== (after ?? '');
        if (!changed) continue;
        latest = await patchField(key, after);
      }
      onUpdated?.(latest);
      setEditing(false);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleSqrThreshold(nextValue) {
    setSaving(true);
    setError(null);
    try {
      const updated = await patchField('meetsSqrThreshold', nextValue);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="border border-pacific-200 rounded-lg p-3 bg-pacific-50/30 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600 block">
            Name
            <input
              type="text"
              value={draft.name || ''}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
            />
          </label>
          <label className="text-xs text-gray-600 block">
            Evidence role
            <select
              value={draft.evidenceRole || ''}
              onChange={e => setDraft(d => ({ ...d, evidenceRole: e.target.value || null }))}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">—</option>
              {EVIDENCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 block">
            Substantiation tier
            <select
              value={draft.substantiationTier || ''}
              onChange={e => setDraft(d => ({ ...d, substantiationTier: e.target.value || null }))}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">—</option>
              {SUBSTANTIATION_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 block">
            Sample size (N)
            <input
              type="number"
              value={draft.sampleSize ?? ''}
              onChange={e => setDraft(d => ({ ...d, sampleSize: e.target.value === '' ? null : Number(e.target.value) }))}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </label>
        </div>

        <label className="text-xs text-gray-600 block">
          Key takeaway
          <textarea
            value={draft.keyTakeaway || ''}
            onChange={e => setDraft(d => ({ ...d, keyTakeaway: e.target.value }))}
            rows={2}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 block">
          Relevance note
          <textarea
            value={draft.relevanceNote || ''}
            onChange={e => setDraft(d => ({ ...d, relevanceNote: e.target.value }))}
            rows={2}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 block">
          Study design summary
          <textarea
            value={draft.studyDesignSummary || ''}
            onChange={e => setDraft(d => ({ ...d, studyDesignSummary: e.target.value }))}
            rows={2}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 block">
          Null-result rationale
          <textarea
            value={draft.nullResultRationale || ''}
            onChange={e => setDraft(d => ({ ...d, nullResultRationale: e.target.value }))}
            rows={2}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(draft.meetsSqrThreshold)}
            onChange={e => setDraft(d => ({ ...d, meetsSqrThreshold: e.target.checked }))}
            className="rounded"
          />
          Meets SQR-RCT threshold
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-pacific-600 text-white text-xs font-medium rounded-md hover:bg-pacific-700 disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(packet); setError(null); }}
            disabled={saving}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{packet.name || 'Untitled'}</p>
          {packet.evidenceRole && (
            <span className="text-xs text-gray-500">{packet.evidenceRole}</span>
          )}
          {packet.substantiationTier && (
            <span className="ml-2 text-xs text-gray-400">· {packet.substantiationTier}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {packet.meetsSqrThreshold !== undefined && (
            <button
              onClick={() => canEdit && !saving && toggleSqrThreshold(!packet.meetsSqrThreshold)}
              disabled={!canEdit || saving}
              className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                packet.meetsSqrThreshold ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              } ${canEdit ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} disabled:opacity-60`}
              title={canEdit ? 'Click to toggle' : undefined}
            >
              {packet.meetsSqrThreshold ? 'Meets SQR' : 'Below SQR'}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-pacific-600 hover:text-pacific-800"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {packet.relevanceNote && (
        <p className="text-xs text-gray-500 mt-1">{packet.relevanceNote}</p>
      )}
      {packet.keyTakeaway && (
        <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Key takeaway:</span> {packet.keyTakeaway}</p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function ClaimDetail({ params }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [claim, setClaim] = useState(null);
  const [evidencePackets, setEvidencePackets] = useState([]);
  const [wordingVariants, setWordingVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const savingRef = useRef(false);

  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);
  // Wave 8 Phase C4 — inline edit of packet fields. Server re-checks the
  // capability on PATCH /api/admin/pcs/evidence/[id].
  const canEditEvidence = can(user, 'pcs.evidence:edit');

  const fetchEvidencePackets = useCallback(async () => {
    try {
      const epRes = await fetch(`/api/pcs/evidence-packets?claimId=${id}`);
      if (epRes.ok) {
        const packets = await epRes.json();
        setEvidencePackets(Array.isArray(packets) ? packets : []);
      }
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => {
    fetchClaim();
  }, [id]);

  async function fetchClaim() {
    try {
      const res = await fetch(`/api/pcs/claims/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClaim(data);
        setNotesValue(data.claimNotes || '');

        // Fetch evidence packets for this claim
        if (data.evidencePacketIds?.length > 0) {
          const epRes = await fetch(`/api/pcs/evidence-packets?claimId=${id}`);
          if (epRes.ok) {
            const packets = await epRes.json();
            setEvidencePackets(Array.isArray(packets) ? packets : []);
          }
        }

        // Fetch wording variants
        if (data.wordingVariantIds?.length > 0) {
          const wvRes = await fetch(`/api/pcs/wording-variants?claimId=${id}`);
          if (wvRes.ok) {
            const variants = await wvRes.json();
            setWordingVariants(Array.isArray(variants) ? variants : []);
          }
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function updateField(field, value) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/pcs/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setClaim(updated);
      }
    } catch { /* silent */ }
    finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function saveNotes() {
    await updateField('claimNotes', notesValue);
    setEditingNotes(false);
  }

  // Derive the set of already-linked evidence item IDs for the modal filter
  const linkedEvidenceItemIds = evidencePackets.map(ep => ep.evidenceItemId).filter(Boolean);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Claim not found</p>
        <Link href="/pcs/claims" className="text-sm text-pacific-600 hover:underline mt-2 inline-block">
          Back to claims
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Link Evidence Modal */}
      {showLinkModal && (
        <LinkEvidenceModal
          claimId={id}
          existingEvidenceItemIds={linkedEvidenceItemIds}
          onLinked={fetchEvidencePackets}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/pcs/claims" className="text-sm text-gray-500 hover:text-gray-700">
              Claims
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">#{claim.claimNo || '—'}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug">{claim.claim}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            title="Revision history"
          >
            History
          </button>
          {claim.claimBucket && (
            <span className={`text-lg font-bold px-4 py-1.5 rounded-lg border ${BUCKET_COLORS[claim.claimBucket] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {claim.claimBucket}
            </span>
          )}
        </div>
      </div>

      {/* Metadata + Actions grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: claim details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                {canWrite ? (
                  <select
                    value={claim.claimStatus || ''}
                    onChange={e => updateField('claimStatus', e.target.value || null)}
                    disabled={saving}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
                  >
                    <option value="">—</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">{claim.claimStatus || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Bucket</label>
                <p className="text-sm text-gray-900">{claim.claimBucket || '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Disclaimer</label>
                <p className="text-sm text-gray-900">{claim.disclaimerRequired ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Evidence Items</label>
                <p className="text-sm text-gray-900">
                  {claim.evidencePacketIds?.length || 0}
                  {claim.evidencePacketIds?.length === 0 && (
                    <span className="text-red-500 ml-1 text-xs">gap</span>
                  )}
                </p>
              </div>
            </div>

            {/* Legacy dose guidance — min/max mg single-AI — kept for backward-compat with old imports */}
            {(claim.minDoseMg || claim.maxDoseMg) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Legacy Dose Guidance
                  <span className="text-gray-400 font-normal ml-1">(pre-Lauren-template)</span>
                </label>
                <p className="text-sm text-gray-900">
                  {claim.minDoseMg && claim.maxDoseMg
                    ? `${claim.minDoseMg}–${claim.maxDoseMg} mg`
                    : claim.minDoseMg
                    ? `${claim.minDoseMg}+ mg`
                    : `Up to ${claim.maxDoseMg} mg`
                  }
                  {claim.doseGuidanceNote && (
                    <span className="text-gray-500 ml-2">— {claim.doseGuidanceNote}</span>
                  )}
                </p>
              </div>
            )}

            {/* Lauren's template Table 3A — multi-AI OR-logic dose requirements */}
            <ClaimDoseRequirements claimId={id} canWrite={canWrite} />
          </div>

          {/* RA Approval Actions */}
          {canWrite && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">RA Review Actions</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateField('claimStatus', 'Authorized')}
                  disabled={saving || claim.claimStatus === 'Authorized'}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  Approve Claim
                </button>
                <button
                  onClick={() => updateField('claimStatus', 'Not approved')}
                  disabled={saving || claim.claimStatus === 'Not approved'}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => updateField('claimStatus', 'Proposed')}
                  disabled={saving || claim.claimStatus === 'Proposed'}
                  className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-600 disabled:opacity-40 transition-colors"
                >
                  Request More Evidence
                </button>
              </div>
              {saving && <p className="text-xs text-gray-400 mt-2">Saving...</p>}
            </div>
          )}

          {/* Notes (rich edit) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Notes</h2>
              {canWrite && !editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-pacific-600 hover:text-pacific-800">
                  Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500 outline-none"
                  placeholder="RA notes, mechanistic summary overrides, review rationale..."
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={saving} className="px-3 py-1.5 bg-pacific-600 text-white text-xs font-medium rounded-md hover:bg-pacific-700 disabled:opacity-40">
                    Save notes
                  </button>
                  <button onClick={() => { setEditingNotes(false); setNotesValue(claim.claimNotes || ''); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {claim.claimNotes || <span className="text-gray-400 italic">No notes yet</span>}
              </p>
            )}
          </div>

          {/* Wave 8 Phase C3 — audited inline edit */}
          {canWrite && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Edit Fields (audited)</h2>
              <p className="text-xs text-gray-500 mb-3">
                Changes here are logged to PCS Revisions with a before/after snapshot.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <InlineEditField
                  claimId={id}
                  fieldPath="claim"
                  label="Claim text"
                  type="text"
                  value={claim.claim}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="notes"
                  label="Notes"
                  type="text"
                  value={claim.claimNotes}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="claimBucket"
                  label="Bucket"
                  type="select"
                  options={BUCKET_OPTIONS}
                  value={claim.claimBucket}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="claimStatus"
                  label="Status"
                  type="select"
                  options={STATUS_OPTIONS}
                  value={claim.claimStatus}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="minDoseMg"
                  label="Min dose (mg)"
                  type="number"
                  value={claim.minDoseMg}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="maxDoseMg"
                  label="Max dose (mg)"
                  type="number"
                  value={claim.maxDoseMg}
                  onSaved={setClaim}
                />
                <InlineEditField
                  claimId={id}
                  fieldPath="claimPrefix"
                  label="Claim prefix (relation id)"
                  type="text"
                  value={claim.claimPrefixId}
                  onSaved={setClaim}
                />
              </div>
            </div>
          )}

          {/* Evidence Packets */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Linked Evidence
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {evidencePackets.length}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {evidencePackets.length > 0 && (
                  <>
                    <Link
                      href={`/pcs/claims/${id}/applicability`}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
                      title="Rate how well each linked study applies to this specific claim (dose, form, duration, population, outcome)"
                    >
                      Applicability →
                    </Link>
                    <Link
                      href={`/pcs/claims/${id}/certainty`}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
                      title="Body-of-evidence certainty rating (NutriGrade-style rollup of quality, applicability, and RA judgments)"
                    >
                      Certainty →
                    </Link>
                  </>
                )}
                {canWrite && (
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="px-3 py-1.5 bg-pacific-600 text-white text-xs font-medium rounded-md hover:bg-pacific-700 transition-colors"
                  >
                    Link Evidence
                  </button>
                )}
              </div>
            </div>
            {evidencePackets.length === 0 ? (
              <div className="text-center py-6 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-600 font-medium">No evidence linked to this claim</p>
                <p className="text-xs text-red-400 mt-1">This is an evidence gap that needs to be addressed</p>
                {canWrite && (
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="mt-3 px-4 py-2 bg-pacific-600 text-white text-sm font-medium rounded-md hover:bg-pacific-700 transition-colors"
                  >
                    Link Evidence
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {evidencePackets.map(ep => (
                  <EvidencePacketRow
                    key={ep.id}
                    packet={ep}
                    canEdit={canEditEvidence}
                    onUpdated={(updated) => {
                      setEvidencePackets(prev => prev.map(p => p.id === updated.id ? updated : p));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Wording Variants */}
          {wordingVariants.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Wording Variants</h2>
              <div className="space-y-2">
                {wordingVariants.map(wv => (
                  <div key={wv.id} className="flex items-start gap-2">
                    {wv.isPrimary && (
                      <span className="text-xs bg-pacific-100 text-pacific-700 px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5">Primary</span>
                    )}
                    <p className="text-sm text-gray-700">{wv.wording}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: discussion + metadata */}
        <div className="space-y-6">
          {/* Quick info card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Claim #</span>
                <span className="text-gray-900">{claim.claimNo || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{claim.createdTime ? new Date(claim.createdTime).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last edited</span>
                <span className="text-gray-900">{claim.lastEditedTime ? new Date(claim.lastEditedTime).toLocaleDateString() : '—'}</span>
              </div>
              {claim.pcsVersionId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Version</span>
                  <span className="text-gray-400 text-xs">{claim.pcsVersionId.slice(0, 8)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Comment Thread */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <CommentThread pageId={id} />
          </div>
        </div>
      </div>

      {/* Wave 8 Phase D — revisions side panel */}
      <RevisionSidePanel
        entityType="claim"
        entityId={id}
        entityLabel={claim.claim ? `#${claim.claimNo || '—'} ${claim.claim}` : undefined}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
