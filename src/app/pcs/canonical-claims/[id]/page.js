'use client';

/**
 * Wave 8 Phase C1 — canonical-claim detail view with inline-edit.
 *
 * Minimal read + edit surface for a single canonical claim. Title, claim
 * family, notes/guardrails, and the new dedupe-decision field are editable
 * via <InlineEditField> (guarded by `pcs.canonical:edit`). Relation fields
 * (prefix, benefit category, active ingredient) are rendered as read-only
 * ids for now — wiring a searchable picker for them is scoped to a later
 * phase (C1+).
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import InlineEditField from '@/components/pcs/InlineEditField';

const CLAIM_FAMILY_OPTIONS = [
  'Mood / stress',
  'Sleep',
  'Cognition',
  'Cardiovascular',
  'Muscle',
  'Energy / metabolism',
  'Cellular signaling',
  'Deficiency',
  'Other',
];

const DEDUPE_DECISION_OPTIONS = [
  { value: 'keep-survivor',      label: 'Keep (survivor)' },
  { value: 'retire-into-other',  label: 'Retire into other' },
  { value: 'archive',            label: 'Archive' },
  { value: 'actually-different', label: 'Actually different' },
  { value: 'needs-more-info',    label: 'Needs more info' },
];

export default function CanonicalClaimDetailPage({ params }) {
  const { id } = use(params);
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/pcs/canonical-claims/${id}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setClaim(data);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  function onSaved(updated) {
    setClaim(updated);
  }

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!claim) return <div className="p-6">Not found.</div>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/pcs" className="hover:underline">PCS</Link>
        <span>/</span>
        <span>Canonical claims</span>
        <span>/</span>
        <code className="text-xs">{claim.id.slice(0, 8)}</code>
      </div>

      <section className="space-y-1">
        <label className="block text-xs uppercase tracking-wide text-gray-500">
          Canonical claim (title)
        </label>
        <div className="text-xl font-semibold">
          <InlineEditField
            entityType="canonical_claim"
            entityId={claim.id}
            fieldPath="title"
            value={claim.canonicalClaim}
            capability="pcs.canonical:edit"
            variant="text"
            placeholder="Canonical claim title"
            onSaved={onSaved}
          />
        </div>
      </section>

      <section className="space-y-1">
        <label className="block text-xs uppercase tracking-wide text-gray-500">
          Claim family
        </label>
        <InlineEditField
          entityType="canonical_claim"
          entityId={claim.id}
          fieldPath="claimFamily"
          value={claim.claimFamily}
          capability="pcs.canonical:edit"
          variant="select"
          options={CLAIM_FAMILY_OPTIONS}
          onSaved={onSaved}
        />
      </section>

      <section className="space-y-1">
        <label className="block text-xs uppercase tracking-wide text-gray-500">
          Notes / guardrails
        </label>
        <InlineEditField
          entityType="canonical_claim"
          entityId={claim.id}
          fieldPath="notesGuardrails"
          value={claim.notesGuardrails}
          capability="pcs.canonical:edit"
          variant="text"
          multiline
          placeholder="Guardrails, constraints, or usage notes…"
          onSaved={onSaved}
        />
      </section>

      <section className="space-y-1">
        <label className="block text-xs uppercase tracking-wide text-gray-500">
          Dedupe decision
        </label>
        <InlineEditField
          entityType="canonical_claim"
          entityId={claim.id}
          fieldPath="dedupeDecision"
          value={claim.dedupeDecision}
          capability="pcs.canonical:edit"
          variant="select"
          options={DEDUPE_DECISION_OPTIONS}
          onSaved={onSaved}
        />
      </section>

      <section className="grid grid-cols-2 gap-4 text-sm text-gray-600 border-t pt-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Prefix (relation)</div>
          <code className="text-xs">{claim.claimPrefixId || '—'}</code>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Benefit category (relation)</div>
          <code className="text-xs">{claim.benefitCategoryId || '—'}</code>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Active ingredient (relation)</div>
          <code className="text-xs">{claim.activeIngredientId || '—'}</code>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Canonical key</div>
          <code className="text-xs break-all">{claim.canonicalKey || '—'}</code>
        </div>
      </section>

      <p className="text-xs text-gray-400">
        Relation pickers (prefix / benefit category / active ingredient) will ship in a
        later phase. For now these are read-only.
      </p>
    </main>
  );
}
