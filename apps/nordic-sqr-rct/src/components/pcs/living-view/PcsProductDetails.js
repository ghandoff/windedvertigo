'use client';

/**
 * PcsProductDetails — Table 1 (Product Details) for the Living PCS View.
 *
 * Wave 4.3.1 introduced the read-only view.
 * Wave 4.3.5 adds inline "save as new version" editing for writers:
 *   - Pencil icon next to editable text fields (Product Name, Daily Serving
 *     Size). Click to enter contenteditable mode. Enter commits to the edit
 *     modal; Escape cancels.
 *   - Chip axes (biologicalSex, ageGroup, lifeStage, lifestyle, legacy
 *     demographic) get an "+ Add" button and an ✕ on each chip.
 *   - Every commit opens EditVersionModal which requires a version note
 *     before POSTing to /api/pcs/documents/[id]/view/edit.
 *
 * Read-only users (canWrite=false) see the pre-Wave-4.3.5 display.
 */

import { useState, useRef, useEffect } from 'react';

export default function PcsProductDetails({
  version,
  doc,
  canWrite = false,
  onEdited,
}) {
  const [pending, setPending] = useState(null); // { field, value, fieldLabel }
  const [error, setError] = useState(null);

  if (!version) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          Product name and demographic not recorded.
        </p>
      </div>
    );
  }

  const productName = version.productName || doc?.finishedGoodName || '';
  const format = version.formatOverride || doc?.format || '';

  const axes = [
    { key: 'biologicalSex', label: 'Biological Sex' },
    { key: 'ageGroup', label: 'Age Group' },
    { key: 'lifeStage', label: 'Life Stage' },
    { key: 'lifestyle', label: 'Lifestyle' },
  ];
  const anyAxisPopulated = axes.some(
    a => Array.isArray(version[a.key]) && version[a.key].length > 0
  );
  const legacyDemographic = Array.isArray(version.demographic)
    ? version.demographic
    : [];

  function requestEdit({ field, value, fieldLabel }) {
    setError(null);
    setPending({ field, value, fieldLabel });
  }

  function removeChip(axisKey, axisLabel, chip) {
    const current = Array.isArray(version[axisKey]) ? version[axisKey] : [];
    const next = current.filter(c => c !== chip);
    requestEdit({ field: axisKey, value: next, fieldLabel: axisLabel });
  }

  function addChip(axisKey, axisLabel) {
    const raw = typeof window !== 'undefined'
      ? window.prompt(`Add a value to ${axisLabel}`, '')
      : '';
    if (!raw || !raw.trim()) return;
    const current = Array.isArray(version[axisKey]) ? version[axisKey] : [];
    if (current.includes(raw.trim())) return;
    requestEdit({
      field: axisKey,
      value: [...current, raw.trim()],
      fieldLabel: axisLabel,
    });
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <EditableKV
          label="Product Name"
          value={productName}
          canWrite={canWrite}
          onCommit={next => requestEdit({
            field: 'productName',
            value: next,
            fieldLabel: 'Product Name',
          })}
        />
        <KV label="Format" value={format} />
        <EditableKV
          label="Daily Serving Size"
          value={version.dailyServingSize}
          canWrite={canWrite}
          onCommit={next => requestEdit({
            field: 'dailyServingSize',
            value: next,
            fieldLabel: 'Daily Serving Size',
          })}
        />
      </div>

      <div className="pt-3 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Demographic
        </p>
        {anyAxisPopulated || canWrite ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {axes.map(a => (
              <EditableAxisChips
                key={a.key}
                label={a.label}
                values={version[a.key]}
                canWrite={canWrite}
                onRemove={chip => removeChip(a.key, a.label, chip)}
                onAdd={() => addChip(a.key, a.label)}
              />
            ))}
          </div>
        ) : legacyDemographic.length > 0 ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {legacyDemographic.map(d => (
                <span
                  key={d}
                  className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded"
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 italic">
              legacy single-field demographic — four-axis breakdown pending (Wave 4.1b)
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </div>

      {pending && (
        <EditVersionModal
          documentId={doc?.id}
          field={pending.field}
          fieldLabel={pending.fieldLabel}
          value={pending.value}
          onCancel={() => setPending(null)}
          onError={msg => {
            setError(msg);
            setPending(null);
          }}
          onSaved={() => {
            setPending(null);
            if (typeof onEdited === 'function') onEdited();
          }}
        />
      )}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-medium text-gray-900">
        {value || <span className="text-gray-400">—</span>}
      </p>
    </div>
  );
}

/**
 * EditableKV — read-only KV when canWrite=false. When canWrite=true, shows a
 * pencil affordance; click swaps the display for a contenteditable input.
 * Enter (no shift) commits; Escape cancels.
 */
function EditableKV({ label, value, canWrite, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  if (!canWrite) return <KV label={label} value={value} />;

  if (!editing) {
    return (
      <div>
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        <div className="flex items-center gap-1 group">
          <p className="text-sm font-medium text-gray-900">
            {value || <span className="text-gray-400">—</span>}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs text-pacific-600 hover:text-pacific-700"
            title={`Edit ${label}`}
            aria-label={`Edit ${label}`}
          >
            ✎
          </button>
        </div>
      </div>
    );
  }

  function commit() {
    const next = draft.trim();
    if (next === (value || '')) {
      setEditing(false);
      return;
    }
    setEditing(false);
    onCommit(next);
  }

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value || '');
            setEditing(false);
          }
        }}
        className="w-full text-sm font-medium text-gray-900 border border-pacific-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-pacific-500"
      />
    </div>
  );
}

function EditableAxisChips({ label, values, canWrite, onRemove, onAdd }) {
  const list = Array.isArray(values) ? values : [];
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-1 items-center">
          {list.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-pacific-200 text-pacific-700 rounded"
            >
              {v}
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onRemove(v)}
                  className="text-pacific-500 hover:text-red-600"
                  aria-label={`Remove ${v}`}
                  title={`Remove ${v}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={onAdd}
              className="px-2 py-0.5 text-xs border border-dashed border-pacific-300 text-pacific-600 rounded hover:bg-pacific-50"
            >
              + Add
            </button>
          )}
        </div>
      ) : canWrite ? (
        <button
          type="button"
          onClick={onAdd}
          className="px-2 py-0.5 text-xs border border-dashed border-pacific-300 text-pacific-600 rounded hover:bg-pacific-50"
        >
          + Add
        </button>
      ) : (
        <span className="text-sm text-gray-400">—</span>
      )}
    </div>
  );
}

/**
 * EditVersionModal — confirms the edit by collecting a version note and
 * calling the save-as-new-version endpoint. The note is saved to the new
 * Version row's "Version notes" property.
 */
function EditVersionModal({
  documentId,
  field,
  fieldLabel,
  value,
  onCancel,
  onError,
  onSaved,
}) {
  const defaultNote = `Inline edit: Table 1 ${fieldLabel} updated`;
  const [note, setNote] = useState(defaultNote);
  const [saving, setSaving] = useState(false);

  const preview = Array.isArray(value)
    ? (value.length ? value.join(', ') : '(empty)')
    : (value || '(empty)');

  async function handleConfirm() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pcs/documents/${documentId}/view/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'table1',
          field,
          value,
          versionNote: note.trim(),
        }),
      });
      if (!res.ok) {
        let msg = `Save failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch { /* ignore */ }
        setSaving(false);
        onError(msg);
        return;
      }
      onSaved();
    } catch (err) {
      setSaving(false);
      onError(err?.message || 'Network error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm edit"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Save as new version
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            This creates a new version row. Previous versions stay in history.
          </p>
        </div>

        <div className="text-sm space-y-1">
          <p className="text-xs text-gray-500 uppercase">{fieldLabel}</p>
          <p className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-900 whitespace-pre-wrap break-words">
            {preview}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 uppercase" htmlFor="version-note">
            Version note
          </label>
          <textarea
            id="version-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pacific-500"
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !note.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-pacific-600 rounded hover:bg-pacific-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save as new version'}
          </button>
        </div>
      </div>
    </div>
  );
}
