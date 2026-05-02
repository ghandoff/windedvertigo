'use client';

/**
 * Wave 8 Phase C1 — InlineEditField
 *
 * Click-to-edit field used on canonical-claim detail pages (and, later, other
 * PCS entity pages). Non-capable users see read-only display text via the
 * `<Can>` gate; capable users click to edit, then Enter/blur saves and Esc
 * cancels. Saves are optimistic with rollback on API error.
 *
 * This is a UX component only — `requireCapability` on the server remains
 * the authoritative gate. A tampered client cannot bypass the PATCH route.
 *
 * Variants:
 *   - 'text'     → <input type="text"> (or <textarea> when multiline)
 *   - 'number'   → <input type="number">; submits as Number (or null if empty)
 *   - 'select'   → <select> driven by `options` ([{ value, label }] | [string])
 *   - 'checkbox' → <input type="checkbox">; submits as boolean, clicks save immediately
 *   - 'tags'     → comma-separated string in the input; submits as string[]
 *                  (trimmed, empties dropped)
 *   - 'relation' → (MVP) plain text id input; a proper searchable picker is
 *                  out-of-scope here — ship the edit primitive and layer
 *                  picker UX on top later.
 *
 * Props:
 *   - entityType  (string)   — e.g. 'canonical_claim' (used to pick the API URL)
 *   - entityId    (string)   — Notion page id
 *   - fieldPath   (string)   — server-side allowlist key ('title', 'claimFamily', …)
 *   - value       (any)      — current value
 *   - options     (array)    — for 'select'
 *   - capability  (string)   — e.g. 'pcs.canonical:edit'
 *   - variant     (string)   — 'text' | 'select' | 'relation'
 *   - multiline   (boolean)  — text variant only
 *   - placeholder (string)
 *   - onSaved     (fn)       — called with the updated row payload
 *   - displayValue (fn)      — optional custom renderer for the read-only view
 */

import { useEffect, useRef, useState } from 'react';
import Can from '@/components/auth/Can';

// Wave 8 Phase A.8 — single place to teach new entity types the PATCH
// route. Must match the entity-type identifiers from
// `REVISION_ENTITY_TYPES` in pcs-config.js (with the obvious kebab-case
// URL mapping).
const ENTITY_PATCH_URL = {
  canonical_claim: (id) => `/api/admin/pcs/canonical-claims/${id}`,
  pcs_document:    (id) => `/api/admin/pcs/documents/${id}`,
  claim:           (id) => `/api/admin/pcs/claims/${id}`,
  evidence_packet: (id) => `/api/admin/pcs/evidence/${id}`,
};

function urlFor(entityType, entityId) {
  const build = ENTITY_PATCH_URL[entityType];
  if (!build) throw new Error(`InlineEditField: no PATCH url for entityType "${entityType}"`);
  return build(entityId);
}

function normaliseOptions(options = []) {
  return options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label || o.value },
  );
}

function defaultDisplay(value, variant) {
  if (variant === 'checkbox') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${value ? 'text-green-700' : 'text-gray-500'}`}>
        <span aria-hidden="true">{value ? '☑' : '☐'}</span>
        <span>{value ? 'Yes' : 'No'}</span>
      </span>
    );
  }
  if (variant === 'tags') {
    const arr = Array.isArray(value) ? value : [];
    if (arr.length === 0) return <span className="text-gray-400 italic">—</span>;
    return (
      <span className="inline-flex flex-wrap gap-1">
        {arr.map((t) => (
          <span key={t} className="px-1.5 py-0.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded">{t}</span>
        ))}
      </span>
    );
  }
  if (value == null || value === '') {
    return <span className="text-gray-400 italic">—</span>;
  }
  if (variant === 'relation') {
    return <code className="text-xs text-gray-700">{String(value)}</code>;
  }
  return <span>{String(value)}</span>;
}

function coerceForSave(raw, variant) {
  if (variant === 'number') {
    if (raw === '' || raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (variant === 'checkbox') {
    return !!raw;
  }
  if (variant === 'tags') {
    return String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw === '' ? null : raw;
}

function coerceForDraft(value, variant) {
  if (variant === 'checkbox') return !!value;
  if (variant === 'tags') return Array.isArray(value) ? value.join(', ') : '';
  return value ?? '';
}

export default function InlineEditField({
  entityType,
  entityId,
  fieldPath,
  value,
  options,
  capability,
  variant = 'text',
  multiline = false,
  placeholder = '',
  onSaved,
  displayValue,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(coerceForDraft(value, variant));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // `committed` holds the canonical value in ORIGINAL shape (not draft shape)
  // so renderers and rollback get the right thing.
  const [committed, setCommitted] = useState(value);

  // Keep in sync if the parent re-fetches and changes `value` out from under us.
  useEffect(() => {
    if (!editing) {
      setDraft(coerceForDraft(value, variant));
      setCommitted(value);
    }
  }, [value, editing, variant]);

  const inputRef = useRef(null);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === 'function') inputRef.current.select();
    }
  }, [editing]);

  async function save(overrideDraft) {
    const effectiveDraft = overrideDraft !== undefined ? overrideDraft : draft;
    const nextValue = coerceForSave(effectiveDraft, variant);
    // No-op detection that handles arrays (tags) and primitives uniformly.
    const sameAsCommitted = (() => {
      if (variant === 'tags') {
        const a = Array.isArray(committed) ? committed : [];
        const b = Array.isArray(nextValue) ? nextValue : [];
        return a.length === b.length && a.every((v, i) => v === b[i]);
      }
      if (nextValue === committed) return true;
      const bothNullish = (nextValue == null || nextValue === '') && (committed == null || committed === '');
      return bothNullish;
    })();
    if (sameAsCommitted) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const previous = committed;
    // Optimistic update — committed stores the server-shaped value.
    setCommitted(nextValue);
    setEditing(false);
    try {
      const res = await fetch(urlFor(entityType, entityId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, value: nextValue }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      if (typeof onSaved === 'function') onSaved(updated);
    } catch (err) {
      // Rollback
      setCommitted(previous);
      setDraft(coerceForDraft(previous, variant));
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(coerceForDraft(committed, variant));
    setEditing(false);
    setError(null);
  }

  const display = typeof displayValue === 'function'
    ? displayValue(committed)
    : defaultDisplay(committed, variant);

  const readOnlyView = (
    <span className="inline-block text-gray-800">{display}</span>
  );

  // Checkbox variant bypasses edit-mode entirely: click toggles and saves.
  if (variant === 'checkbox') {
    return (
      <Can capability={capability} fallback={readOnlyView}>
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!committed}
            disabled={saving}
            onChange={(e) => save(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-pacific-600 focus:ring-pacific-500"
          />
          <span className="text-xs text-gray-700">{committed ? 'Yes' : 'No'}</span>
          {saving && <span className="text-xs text-gray-500">Saving…</span>}
          {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
        </span>
      </Can>
    );
  }

  // Non-capable users see plain read-only text. `<Can>` returns fallback.
  return (
    <Can capability={capability} fallback={readOnlyView}>
      <span className="inline-flex items-start gap-2">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left px-1 -mx-1 rounded hover:bg-yellow-50 border border-transparent hover:border-yellow-200 transition-colors cursor-text"
            title="Click to edit"
          >
            {display}
          </button>
        ) : (
          <span className="inline-flex flex-col gap-1">
            {variant === 'select' ? (
              <select
                ref={inputRef}
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                disabled={saving}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">— none —</option>
                {normaliseOptions(options || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : multiline ? (
              <textarea
                ref={inputRef}
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save()}
                onKeyDown={(e) => {
                  // Enter alone saves; Shift+Enter inserts a newline.
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                placeholder={placeholder}
                disabled={saving}
                rows={Math.min(8, Math.max(2, String(draft || '').split('\n').length))}
                className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[20rem]"
              />
            ) : variant === 'number' ? (
              <input
                ref={inputRef}
                type="number"
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                placeholder={placeholder}
                disabled={saving}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-32"
              />
            ) : variant === 'tags' ? (
              <input
                ref={inputRef}
                type="text"
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                placeholder={placeholder || 'Comma-separated values'}
                disabled={saving}
                className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[18rem] font-mono"
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                placeholder={placeholder}
                disabled={saving}
                className="px-2 py-1 border border-gray-300 rounded text-sm min-w-[14rem]"
              />
            )}
            {saving && <span className="text-xs text-gray-500">Saving…</span>}
          </span>
        )}
        {error && (
          <span
            role="alert"
            className="text-xs text-red-600"
            title="Save failed; value rolled back"
          >
            {error}
          </span>
        )}
      </span>
    </Can>
  );
}
