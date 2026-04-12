"use client";

import { useState, useRef, useCallback } from "react";

type CustomFieldsSectionProps = {
  personId: string;
  initialFields: Record<string, string>;
};

const SUGGESTED_FIELDS = [
  "occupation",
  "religion",
  "ethnicity",
  "immigration_year",
  "cause_of_death",
  "education",
  "military_service",
  "nationality",
  "birth_place_detail",
  "burial_place",
];

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function CustomFieldsSection({
  personId,
  initialFields,
}: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<Record<string, string>>(initialFields);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const clearError = () => setError(null);

  const saveFields = useCallback(
    async (updated: Record<string, string>) => {
      setSaving(true);
      clearError();
      try {
        const res = await fetch(`/api/person/${personId}/custom-fields`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: updated }),
        });
        if (!res.ok) throw new Error("failed to save");
      } catch {
        setError("save failed — reverting");
        setFields(initialFields);
      } finally {
        setSaving(false);
      }
    },
    [personId, initialFields],
  );

  const handleAdd = () => {
    const key = normalizeKey(newKey);
    if (!key || !newValue.trim()) return;
    if (fields[key] !== undefined) {
      setError(`"${key}" already exists`);
      return;
    }
    const updated = { ...fields, [key]: newValue.trim() };
    setFields(updated);
    setNewKey("");
    setNewValue("");
    saveFields({ [key]: newValue.trim() });
  };

  const handleDelete = async (key: string) => {
    const prev = { ...fields };
    const next = { ...fields };
    delete next[key];
    setFields(next);
    setSaving(true);
    clearError();
    try {
      const res = await fetch(`/api/person/${personId}/custom-fields`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error("failed to delete");
    } catch {
      setError("delete failed — reverting");
      setFields(prev);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (key: string) => {
    setEditingKey(key);
    setEditValue(fields[key]);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (!editingKey) return;
    const val = editValue.trim();
    if (!val || val === fields[editingKey]) {
      setEditingKey(null);
      return;
    }
    const updated = { ...fields, [editingKey]: val };
    setFields(updated);
    setEditingKey(null);
    saveFields({ [editingKey]: val });
  };

  const entries = Object.entries(fields);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          custom fields
        </h2>
        {saving && (
          <span className="text-[10px] text-muted-foreground animate-pulse">
            saving...
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">no custom fields yet</p>
      )}

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map(([key, value]) => (
            <li key={key} className="flex items-center gap-2 group">
              <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                {key.replace(/_/g, " ")}
              </span>
              {editingKey === key ? (
                <input
                  ref={editRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                />
              ) : (
                <span
                  onClick={() => startEdit(key)}
                  className="flex-1 min-w-0 text-sm text-foreground cursor-pointer rounded px-1 -mx-1 hover:bg-primary/5 truncate"
                  title="click to edit"
                >
                  {value}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(key)}
                className="shrink-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                aria-label={`delete ${key}`}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* add field form */}
      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1 min-w-0">
          <label className="text-[10px] text-muted-foreground block mb-0.5">
            field name
          </label>
          <input
            type="text"
            list="custom-field-suggestions"
            value={newKey}
            onChange={(e) => { setNewKey(e.target.value); clearError(); }}
            placeholder="e.g. occupation"
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40"
          />
          <datalist id="custom-field-suggestions">
            {SUGGESTED_FIELDS.filter((f) => !(f in fields)).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-[10px] text-muted-foreground block mb-0.5">
            value
          </label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="value"
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newKey.trim() || !newValue.trim()}
          className="shrink-0 rounded bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          add
        </button>
      </div>
    </section>
  );
}
