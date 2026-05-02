'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import {
  DOSE_MATCH, FORM_MATCH, DURATION_MATCH, POPULATION_MATCH,
  OUTCOME_RELEVANCE, STRUCTURAL_LIMITATIONS,
} from '@/lib/pcs-config';

/**
 * Per-claim applicability dashboard.
 *
 * Lists every evidence item linked to a PCS Claim via evidence packets
 * and shows the applicability assessment (if any) for each pair. The
 * five ordinal domains, structural-limitation flags, and notes are all
 * editable inline; the score/rating recomputes automatically on save.
 *
 * Separates "is this study biased?" (the RoB 2 tab on /analytics) from
 * "does this study apply to this specific claim?" (this page).
 */

const RATING_COLORS = {
  High: 'bg-green-100 text-green-800',
  Moderate: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-red-100 text-red-800',
  Pending: 'bg-gray-100 text-gray-600',
};

export default function ApplicabilityPage({ params }) {
  const { id: claimId } = use(params);
  const { user } = useAuth();
  // Client check is UX hint; server is the source of truth (authenticatePcsWrite).
  const canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

  const [claim, setClaim] = useState(null);
  const [packets, setPackets] = useState([]);
  const [evidenceById, setEvidenceById] = useState({});
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [claimRes, packetRes, applRes] = await Promise.all([
        fetch(`/api/pcs/claims/${claimId}`),
        fetch(`/api/pcs/evidence-packets?claimId=${claimId}`),
        fetch(`/api/pcs/applicability?claimId=${claimId}`),
      ]);
      if (!claimRes.ok) throw new Error('Could not load claim');
      const claimData = await claimRes.json();
      setClaim(claimData);
      const packetData = packetRes.ok ? await packetRes.json() : [];
      setPackets(Array.isArray(packetData) ? packetData : []);
      const applData = applRes.ok ? await applRes.json() : [];
      setAssessments(Array.isArray(applData) ? applData : []);

      // Fetch evidence items referenced by packets (parallel single-item calls)
      const evidenceIds = [...new Set((packetData || []).map(p => p.evidenceItemId).filter(Boolean))];
      if (evidenceIds.length > 0) {
        const items = await Promise.all(
          evidenceIds.map(id => fetch(`/api/pcs/evidence/${id}`).then(r => r.ok ? r.json() : null))
        );
        const map = {};
        for (const it of items) if (it) map[it.id] = it;
        setEvidenceById(map);
      } else {
        setEvidenceById({});
      }
    } catch (err) {
      setError(err.message || 'Failed to load applicability data');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  // Group assessments by evidence item for quick lookup
  const assessmentByEvidenceId = {};
  for (const a of assessments) {
    if (a.evidenceItemId) assessmentByEvidenceId[a.evidenceItemId] = a;
  }

  const rated = assessments.filter(a => a.applicabilityRating && a.applicabilityRating !== 'Pending');
  const avgScore = rated.length > 0
    ? rated.reduce((s, a) => s + (a.applicabilityScore || 0), 0) / rated.length
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/pcs/claims" className="hover:underline">Claims</Link>
          <span>/</span>
          <Link href={`/pcs/claims/${claimId}`} className="hover:underline">
            {claim?.claim ? claim.claim.slice(0, 60) : claimId.slice(0, 8)}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Applicability</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Applicability Assessment</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Rates how well each linked evidence item applies to this specific claim on Nordic&apos;s specific product &mdash; dose, form, duration, population, outcome relevance. This is external validity, separate from bias. A study can be unbiased (Low RoB 2) yet inapplicable here.
        </p>
      </div>

      {/* Claim summary */}
      {claim && (
        <div className="card p-4 bg-gray-50">
          <div className="text-xs text-gray-500 uppercase mb-1">Claim</div>
          <p className="font-medium text-gray-900">{claim.claim || 'Untitled'}</p>
          {claim.claimBucket && (
            <div className="mt-2 flex gap-3 text-xs text-gray-600">
              <span>Bucket: <span className="font-medium">{claim.claimBucket}</span></span>
              {claim.claimStatus && <span>Status: <span className="font-medium">{claim.claimStatus}</span></span>}
              {(claim.minDoseMg != null || claim.maxDoseMg != null) && (
                <span>Dose: <span className="font-medium">
                  {claim.minDoseMg != null ? claim.minDoseMg : '?'}
                  {claim.maxDoseMg != null ? `–${claim.maxDoseMg}` : ''} mg
                </span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pacific">{packets.length}</p>
          <p className="text-xs text-gray-500 mt-1">Linked evidence</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pacific">{rated.length}</p>
          <p className="text-xs text-gray-500 mt-1">Assessed for applicability</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pacific">
            {avgScore != null ? avgScore.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Mean applicability (0–10)</p>
        </div>
      </div>

      {/* Per-evidence assessment cards */}
      {packets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-2">No evidence items linked to this claim yet.</p>
          <Link href={`/pcs/claims/${claimId}`} className="text-sm text-pacific-600 hover:underline">
            ← Back to claim to link evidence
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {packets.map(packet => {
            const evidence = evidenceById[packet.evidenceItemId];
            const assessment = packet.evidenceItemId ? assessmentByEvidenceId[packet.evidenceItemId] : null;
            return (
              <ApplicabilityCard
                key={packet.id}
                claimId={claimId}
                packet={packet}
                evidence={evidence}
                assessment={assessment}
                canWrite={canWrite}
                onSaved={refresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * One card per (evidence item, claim) pair. Displays evidence context
 * from the linked Evidence Library row, plus an inline form for the
 * five applicability domains + structural limitations + notes.
 */
function ApplicabilityCard({ claimId, packet, evidence, assessment, canWrite, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const initial = assessment || {
    doseMatch: null, formMatch: null, durationMatch: null,
    populationMatch: null, outcomeRelevance: null,
    structuralLimitations: [], notes: '',
  };
  const [form, setForm] = useState(initial);

  useEffect(() => { setForm(assessment || initial); /* eslint-disable-next-line */ }, [assessment?.id]);

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: evidence ? `${(evidence.name || 'Untitled').slice(0, 80)} × ${packet.name || 'claim'}` : packet.name,
        evidenceItemId: packet.evidenceItemId,
        pcsClaimId: claimId,
        doseMatch: form.doseMatch,
        formMatch: form.formMatch,
        durationMatch: form.durationMatch,
        populationMatch: form.populationMatch,
        outcomeRelevance: form.outcomeRelevance,
        structuralLimitations: form.structuralLimitations,
        notes: form.notes,
        assessmentDate: new Date().toISOString().slice(0, 10),
      };
      let res;
      if (assessment?.id) {
        res = await fetch(`/api/pcs/applicability/${assessment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/pcs/applicability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      onSaved();
      setExpanded(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const rating = assessment?.applicabilityRating || 'Pending';
  const score = assessment?.applicabilityScore;

  return (
    <div className="card">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/pcs/evidence/${packet.evidenceItemId}`}
            className="text-pacific-600 hover:underline font-medium line-clamp-1"
          >
            {evidence?.name || packet.name || 'Untitled evidence'}
          </Link>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            {evidence?.publicationYear && <span>{evidence.publicationYear}</span>}
            {evidence?.doi && <span>DOI {evidence.doi.slice(0, 40)}</span>}
            {evidence?.sqrScore != null && (
              <span>SQR {evidence.sqrScore}/22</span>
            )}
            {packet.evidenceRole && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{packet.evidenceRole}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${RATING_COLORS[rating]}`}>
            {rating}{score != null ? ` · ${score.toFixed(1)}` : ''}
          </span>
          {canWrite && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-sm text-pacific-600 hover:underline"
            >
              {expanded ? 'Cancel' : (assessment ? 'Edit' : 'Assess')}
            </button>
          )}
        </div>
      </div>

      {expanded && canWrite && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField label="Dose match" value={form.doseMatch} options={DOSE_MATCH}
              onChange={v => setForm(f => ({ ...f, doseMatch: v }))} />
            <SelectField label="Form / matrix match" value={form.formMatch} options={FORM_MATCH}
              onChange={v => setForm(f => ({ ...f, formMatch: v }))} />
            <SelectField label="Duration match" value={form.durationMatch} options={DURATION_MATCH}
              onChange={v => setForm(f => ({ ...f, durationMatch: v }))} />
            <SelectField label="Population match" value={form.populationMatch} options={POPULATION_MATCH}
              onChange={v => setForm(f => ({ ...f, populationMatch: v }))} />
            <SelectField label="Outcome relevance" value={form.outcomeRelevance} options={OUTCOME_RELEVANCE}
              onChange={v => setForm(f => ({ ...f, outcomeRelevance: v }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Structural limitations (flagged, not penalized)
            </label>
            <div className="flex flex-wrap gap-2">
              {STRUCTURAL_LIMITATIONS.map(flag => {
                const on = (form.structuralLimitations || []).includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => setForm(f => {
                      const cur = new Set(f.structuralLimitations || []);
                      if (cur.has(flag)) cur.delete(flag); else cur.add(flag);
                      return { ...f, structuralLimitations: [...cur] };
                    })}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      on ? 'bg-orange-100 text-orange-800 border border-orange-300'
                         : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {on ? '✓ ' : ''}{flag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Assessor rationale, manuscript quotes, dose-match reasoning…"
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pacific focus:border-transparent"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setForm(assessment || initial); setExpanded(false); }}
              disabled={saving}
              className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm px-4 py-1.5 bg-pacific-600 text-white rounded-md hover:bg-pacific-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pacific focus:border-transparent bg-white"
      >
        <option value="">— Not rated —</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
