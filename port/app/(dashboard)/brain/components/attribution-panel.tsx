"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Pencil, ExternalLink, AlertTriangle, X } from "lucide-react";
import { type AttributionRecord, type CvEntryOption } from "@/lib/knowledge/attribution";
import { updateAttribution } from "../actions/update-attribution";
import { AGENT_META } from "@/lib/knowledge/types";

// ── helpers ──────────────────────────────────────────────────────

function agentColor(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const slug = key === "carl" ? "carl" : key === "mo" ? "mo" : key === "pam" ? "pam"
    : key === "opsy" ? "opsy" : key === "biz" ? "biz" : key === "fin" ? "fin" : null;
  return slug ? AGENT_META[slug as keyof typeof AGENT_META].color : "#6b7280";
}

function confirmedKey(nodeId: string) {
  return `adj:confirmed:${nodeId}`;
}

// ── combobox ─────────────────────────────────────────────────────

function CvEntryCombobox({
  options,
  value,
  onChange,
}: {
  options: CvEntryOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.memberLabel ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const selected = options.find((o) => o.id === value);

  return (
    <div className="space-y-1">
      <input
        type="text"
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Search cv-entries…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {selected && !query && (
        <p className="text-xs text-muted-foreground px-1">
          Current: <span className="font-medium">{selected.label}</span>
          {selected.memberLabel && <span className="ml-1 text-muted-foreground">({selected.memberLabel})</span>}
        </p>
      )}
      <ul className="max-h-48 overflow-y-auto rounded border border-border bg-card divide-y divide-border text-sm">
        {filtered.slice(0, 50).map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onChange(o.id)}
              className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                value === o.id ? "bg-primary/10 font-medium" : ""
              }`}
            >
              <span className="block truncate">{o.label}</span>
              {o.memberLabel && (
                <span className="text-xs text-muted-foreground">{o.memberLabel}</span>
              )}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-muted-foreground text-xs">no matches</li>
        )}
      </ul>
    </div>
  );
}

// ── single attribution row ────────────────────────────────────────

function AttributionRow({
  record,
  cvEntryOptions,
}: {
  record: AttributionRecord;
  cvEntryOptions: CvEntryOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [selectedCvEntry, setSelectedCvEntry] = useState<string | null>(record.currentCvEntryId);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(!!localStorage.getItem(confirmedKey(record.nodeId)));
  }, [record.nodeId]);

  const wasEdited = record.adjudicatorEditedAt !== null;
  const hasAttribution = record.currentCvEntryId !== null;

  function handleConfirm() {
    localStorage.setItem(confirmedKey(record.nodeId), "1");
    setConfirmed(true);
  }

  function handleEditOpen() {
    setSelectedCvEntry(record.currentCvEntryId);
    setSaveError(null);
    setEditing(true);
  }

  function handleEditCancel() {
    setEditing(false);
    setSaveError(null);
  }

  function handleSave() {
    if (!selectedCvEntry) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await updateAttribution(record.nodeId, selectedCvEntry);
      if (result.ok) {
        // clear confirmed flag — correction means needs re-review
        localStorage.removeItem(confirmedKey(record.nodeId));
        setConfirmed(false);
        setEditing(false);
        router.refresh();
      } else {
        setSaveError(result.error ?? "unknown error");
      }
    });
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 space-y-2 transition-colors ${
        confirmed || wasEdited
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
          : !hasAttribution
          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
          : "border-border bg-card"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{record.nodeLabel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">
              {record.nodeCategory}
            </span>
            {wasEdited && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                corrected
              </span>
            )}
          </div>

          {/* Contributing agents */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {record.contributingAgents.map((agent) => (
              <span
                key={agent}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: agentColor(agent) }}
              >
                {agent}
              </span>
            ))}
            {record.contributingAgents.length === 0 && (
              <span className="text-xs text-muted-foreground">no agents listed</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {record.sourceRef && (
            <a
              href={record.sourceRef}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Open in Notion"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {!editing && (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmed}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                  confirmed
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
                title="Mark as confirmed"
              >
                <CheckCircle className="w-3 h-3" />
                {confirmed ? "confirmed" : "confirm"}
              </button>
              {record.editable && (
                <button
                  type="button"
                  onClick={handleEditOpen}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground transition-colors"
                  title="Reassign to different cv-entry"
                >
                  <Pencil className="w-3 h-3" />
                  edit
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Current attribution */}
      {!editing && (
        <div className="flex items-center gap-1.5 text-xs">
          {record.currentMemberLabel ? (
            <>
              <span className="text-muted-foreground">credited to</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {record.currentMemberLabel}
              </span>
            </>
          ) : hasAttribution ? (
            <>
              <span className="text-muted-foreground">attributed to</span>
              <span className="font-medium">{record.currentCvEntryLabel ?? record.currentCvEntryId}</span>
              <span className="text-muted-foreground text-[10px]">(no member linked — check notion)</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              unattributed — no cv-entry linked
            </span>
          )}
        </div>
      )}

      {/* Inline edit mode */}
      {editing && (
        <div className="space-y-2">
          <CvEntryCombobox
            options={cvEntryOptions}
            value={selectedCvEntry}
            onChange={setSelectedCvEntry}
          />
          {saveError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <X className="w-3 h-3" />
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !selectedCvEntry || selectedCvEntry === record.currentCvEntryId}
              className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={handleEditCancel}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── main panel ───────────────────────────────────────────────────

export function AttributionPanel({
  records,
  cvEntryOptions,
}: {
  records: AttributionRecord[];
  cvEntryOptions: CvEntryOption[];
}) {
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);

  // Derive filter options from records
  const allMembers = Array.from(
    new Set(records.map((r) => r.currentMemberLabel).filter(Boolean) as string[]),
  ).sort();
  const allAgents = Array.from(
    new Set(records.flatMap((r) => r.contributingAgents)),
  ).sort();

  const filtered = records.filter((r) => {
    if (memberFilter !== "all" && r.currentMemberLabel !== memberFilter) return false;
    if (agentFilter !== "all" && !r.contributingAgents.includes(agentFilter)) return false;
    if (unreviewedOnly && r.adjudicatorEditedAt !== null) return false;
    return true;
  });

  const unreviewed = records.filter((r) => r.adjudicatorEditedAt === null && !r.currentCvEntryId);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
        <p className="text-sm font-medium">agent deliverable attribution</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          each row is something an agent produced (a lit review, report, or evaluation instrument)
          that fed into real client work. the <span className="font-medium text-foreground">attributed to</span> line
          shows which team member's cv-entry gets credit for that engagement.
          if it shows the wrong person, click <span className="font-medium text-foreground">edit</span> to
          reassign it — the next notion sync won't overwrite your correction.
        </p>
        {unreviewed.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {unreviewed.length} deliverable{unreviewed.length !== 1 ? "s" : ""} not yet linked to a cv-entry — run a knowledge sync or check notion
          </p>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">member</label>
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none"
          >
            <option value="all">all</option>
            {allMembers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">agent</label>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none"
          >
            <option value="all">all</option>
            {allAgents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={unreviewedOnly}
            onChange={(e) => setUnreviewedOnly(e.target.checked)}
            className="rounded"
          />
          unreviewed only
        </label>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {records.length}
        </span>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {records.length === 0
            ? "no co-created nodes found — run a knowledge sync to populate"
            : "no nodes match the current filters"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <AttributionRow
              key={record.nodeId}
              record={record}
              cvEntryOptions={cvEntryOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
