'use client';

import { useState, useEffect } from 'react';

/**
 * InlineField — generic click-to-edit field for database-native PCS surfaces.
 *
 * Shared across:
 *   - PCS document Compact view  (document detail page)
 *   - Living View — Table 2 (PcsComposition formula lines)
 *   - Living View — Tables 3A/3B/3C (PcsClaimsSection claims)
 *   - Active Ingredients list + detail pages
 *
 * The component renders in display mode by default. Clicking enters edit
 * mode with the appropriate control. The caller supplies `onSave(value)`
 * which should fire the PATCH request and return the updated row. This
 * keeps URL and body-format knowledge out of the component itself.
 *
 * Props:
 *   value          — current value (string | number | boolean | string[])
 *   onSave(v)      — async fn; receives the cleaned value, returns updated row
 *   onSaved(row)   — called after successful save with the returned row
 *   variant        — 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'tags'
 *   options        — string[] OR {value,label}[] — for variant='select'
 *   placeholder    — shown in input and as empty-state text
 *   displayClassName — tailwind classes for the display value
 *   canEdit        — when false, renders read-only with no controls
 *   emptyLabel     — overrides default '+ Click to add' for empty state
 *   rows           — textarea row count (default 3)
 *   fieldName      — used for aria-label, e.g. 'claim text'
 */
export default function InlineField({
  value,
  onSave,
  onSaved,
  variant = 'text',
  options,
  placeholder,
  displayClassName = 'text-sm font-medium text-gray-900',
  canEdit = true,
  emptyLabel,
  rows = 3,
  fieldName = 'field',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDisplayDraft(value, variant));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Sync external value changes (e.g. parent re-fetched) when not editing.
  useEffect(() => {
    if (!editing) setDraft(toDisplayDraft(value, variant));
  }, [value, editing, variant]);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const outVal = toSaveValue(draft, variant);
      const updated = await onSave(outVal);
      setEditing(false);
      if (onSaved) onSaved(updated);
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setErr(null);
    setDraft(toDisplayDraft(value, variant));
  }

  // ── Display mode ──────────────────────────────────────────────────────────

  if (!canEdit || !editing) {
    const isEmpty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    const defaultEmpty = emptyLabel ?? (canEdit ? '+ Click to add' : '—');

    if (variant === 'checkbox') {
      // Boolean toggle — display-only pill
      const checked = Boolean(value);
      return (
        <button
          type="button"
          onClick={canEdit ? () => setEditing(true) : undefined}
          disabled={!canEdit}
          aria-label={canEdit ? `Toggle ${fieldName}` : undefined}
          className={[
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
            checked ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500',
            canEdit ? 'cursor-pointer hover:opacity-80' : '',
          ].join(' ')}
        >
          {checked ? '⚠ Yes' : 'No'}
          {canEdit && <PencilIcon />}
        </button>
      );
    }

    const Wrapper = canEdit ? 'button' : 'div';
    return (
      <Wrapper
        type={canEdit ? 'button' : undefined}
        onClick={canEdit ? () => setEditing(true) : undefined}
        aria-label={canEdit ? `Edit ${fieldName}` : undefined}
        className={[
          'group flex items-start gap-2 w-full text-left',
          canEdit ? 'rounded -mx-1 px-1 py-0.5 hover:bg-pacific-50/60 focus:bg-pacific-50 focus:outline-none focus:ring-1 focus:ring-pacific-300 cursor-text' : '',
        ].join(' ')}
      >
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
            <p className={isEmpty ? 'text-sm text-pacific-600 italic' : displayClassName}>
              {isEmpty ? defaultEmpty : String(value)}
            </p>
          )}
        </div>
        {canEdit && <PencilIcon className="shrink-0 mt-0.5 text-pacific-400 group-hover:text-pacific-700" />}
      </Wrapper>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  const inputClass =
    'text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-1 focus:ring-pacific-500 focus:border-pacific-500';

  return (
    <div className="space-y-1">
      {variant === 'checkbox' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(draft)}
            onChange={e => setDraft(e.target.checked)}
            disabled={saving}
            autoFocus
            className="rounded border-gray-300 text-pacific-600 focus:ring-pacific-500"
          />
          <span className="text-sm text-gray-700">{fieldName}</span>
        </label>
      ) : variant === 'select' ? (
        <select
          value={String(draft ?? '')}
          onChange={e => setDraft(e.target.value)}
          className={inputClass + ' bg-white'}
          disabled={saving}
          autoFocus
        >
          <option value="">—</option>
          {(options || []).map(o => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return <option key={v} value={v}>{l}</option>;
          })}
        </select>
      ) : variant === 'textarea' ? (
        <textarea
          value={draft ?? ''}
          onChange={e => setDraft(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={inputClass}
          disabled={saving}
          autoFocus
        />
      ) : variant === 'number' ? (
        <input
          type="number"
          value={draft ?? ''}
          onChange={e => setDraft(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={placeholder}
          className={inputClass}
          disabled={saving}
          autoFocus
          step="any"
        />
      ) : (
        /* text or tags — both use a plain text input */
        <input
          type="text"
          value={draft ?? ''}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
          disabled={saving}
          autoFocus
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-0.5 text-xs font-medium text-white bg-pacific-600 rounded hover:bg-pacific-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function PencilIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <span aria-hidden="true" className={className}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
      </svg>
    </span>
  );
}

/** Convert stored value to a string/boolean suitable for the draft input. */
function toDisplayDraft(value, variant) {
  if (variant === 'checkbox') return Boolean(value);
  if (variant === 'tags') return Array.isArray(value) ? value.join(', ') : '';
  if (value == null) return '';
  return value;
}

/** Convert the draft state back to the value to send to the API. */
function toSaveValue(draft, variant) {
  if (variant === 'checkbox') return Boolean(draft);
  if (variant === 'tags') {
    return String(draft || '').split(',').map(s => s.trim()).filter(Boolean);
  }
  if (variant === 'select' && draft === '') return null;
  if (variant === 'number') {
    if (draft === '' || draft == null) return null;
    const n = Number(draft);
    return isNaN(n) ? null : n;
  }
  return draft;
}
