"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import type { Hint, HintMatchData, HintEvidence } from "@/lib/types";
import { acceptHintAction, rejectHintAction } from "../hints/actions";

type EnrichedHint = Hint & {
  person: {
    displayName: string;
    givenNames: string;
    surname: string;
    birthDate: string | null;
    birthPlace: string | null;
    deathDate: string | null;
    thumbnailUrl: string | null;
  } | null;
};

function confidenceColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function confidenceBadge(score: number) {
  if (score >= 70) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function sourceLabel(source: string) {
  switch (source) {
    case "familysearch": return "FamilySearch Tree";
    case "familysearch_records": return "FamilySearch Records";
    case "wikidata": return "Wikidata";
    case "chronicling_america": return "Newspaper Archive";
    case "nara": return "National Archives";
    case "dpla": return "Digital Public Library";
    default: return source;
  }
}

function sourceIcon(source: string) {
  switch (source) {
    case "familysearch":
    case "familysearch_records":
      return "🌳";
    case "wikidata":
      return "📖";
    case "chronicling_america":
      return "📰";
    case "nara":
      return "🏛️";
    case "dpla":
      return "📚";
    default:
      return "🔍";
  }
}

function isRecordSource(source: string) {
  return ["familysearch_records", "chronicling_america", "nara", "dpla"].includes(source);
}

/** format a structured name with first, middle, last */
function formatFullName(match: HintMatchData): string {
  const parts = [match.givenNames, match.middleName, match.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : match.displayName;
}

// ---------- sub-components ----------

function HintTile({
  hint,
  isSelected,
  onClick,
}: {
  hint: EnrichedHint;
  isSelected: boolean;
  onClick: () => void;
}) {
  const match = hint.match_data;
  const person = hint.person;
  const matchName = formatFullName(match);
  const isRecord = isRecordSource(hint.source_system);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-foreground/20 hover:shadow-sm"
      }`}
    >
      <div className="flex gap-3">
        {/* image / avatar */}
        <div className="shrink-0">
          {match.imageUrl ? (
            <img
              src={match.imageUrl}
              alt=""
              className="h-14 w-14 rounded-lg object-cover border border-border"
              loading="lazy"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-lg">
              {sourceIcon(hint.source_system)}
            </div>
          )}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${confidenceBadge(hint.confidence)}`}>
              {hint.confidence}%
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {sourceLabel(hint.source_system)}
            </span>
          </div>

          {/* your person → match */}
          <div className="text-xs text-muted-foreground truncate">
            {person?.displayName ?? "unknown"}
          </div>
          <div className="text-sm font-medium text-foreground truncate">
            {matchName}
          </div>

          {/* key details — show birth info for person hints, event info for record hints */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {!isRecord && match.birthDate && <span>b. {match.birthDate}</span>}
            {!isRecord && match.birthPlace && <span>{match.birthPlace}</span>}
            {isRecord && match.eventDate && <span>{match.eventDate}</span>}
            {isRecord && match.eventPlace && <span>{match.eventPlace}</span>}
            {match.recordType && (
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase font-medium">
                {match.recordType}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function HintDetail({
  hint,
  onAccepted,
  onRejected,
}: {
  hint: EnrichedHint;
  onAccepted: () => void;
  onRejected: () => void;
}) {
  const [acceptPending, startAccept] = useTransition();
  const [rejectPending, startReject] = useTransition();
  const isPending = acceptPending || rejectPending;

  const match = hint.match_data;
  const evidence = hint.evidence;
  const person = hint.person;
  const isRecord = isRecordSource(hint.source_system);
  const isReviewed = hint.status !== "pending";

  const matchName = formatFullName(match);

  return (
    <div className="space-y-5">
      {/* header image */}
      {match.imageUrl && (
        <div className="rounded-lg border border-border overflow-hidden bg-muted">
          <img
            src={match.imageUrl}
            alt={matchName}
            className="w-full max-h-64 object-contain"
            loading="lazy"
          />
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-card border-t border-border">
            {isRecord ? (match.collectionTitle ?? "document preview") : "portrait"}
            {" — "}via {sourceLabel(hint.source_system)}
          </div>
        </div>
      )}

      {/* confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${confidenceBadge(hint.confidence)}`}>
            {hint.confidence}% match
          </span>
          <span className="text-xs text-muted-foreground">
            via {sourceLabel(hint.source_system)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${confidenceColor(hint.confidence)}`}
            style={{ width: `${Math.min(hint.confidence, 100)}%` }}
          />
        </div>
      </div>

      {/* side-by-side comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* your tree person */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            your tree
          </div>
          {person?.thumbnailUrl && (
            <img src={person.thumbnailUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
          )}
          <div className="text-sm font-semibold text-foreground">{person?.displayName ?? "unknown"}</div>
          {person?.givenNames && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">name:</span> {person.givenNames} {person.surname}
            </div>
          )}
          {person?.birthDate && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">born:</span> {person.birthDate}
            </div>
          )}
          {person?.birthPlace && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">place:</span> {person.birthPlace}
            </div>
          )}
          {person?.deathDate && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">died:</span> {person.deathDate}
            </div>
          )}
        </div>

        {/* suggested match / record */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            {isRecord ? "record found" : "suggested match"}
          </div>
          <div className="text-sm font-semibold text-foreground">{matchName}</div>
          {/* structured name breakdown */}
          {(match.givenNames || match.middleName || match.surname) && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {match.givenNames && (
                <div><span className="font-medium">first:</span> {match.givenNames}</div>
              )}
              {match.middleName && (
                <div><span className="font-medium">middle:</span> {match.middleName}</div>
              )}
              {match.surname && (
                <div><span className="font-medium">last:</span> {match.surname}</div>
              )}
            </div>
          )}
          {match.birthDate && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">born:</span> {match.birthDate}
            </div>
          )}
          {match.birthPlace && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">birth place:</span> {match.birthPlace}
            </div>
          )}
          {match.deathDate && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">died:</span> {match.deathDate}
            </div>
          )}
          {match.deathPlace && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">death place:</span> {match.deathPlace}
            </div>
          )}
          {isRecord && match.eventDate && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">record date:</span> {match.eventDate}
            </div>
          )}
          {isRecord && match.eventPlace && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">record place:</span> {match.eventPlace}
            </div>
          )}
          {match.sex && !isRecord && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">sex:</span> {match.sex === "M" ? "male" : match.sex === "F" ? "female" : match.sex}
            </div>
          )}
          {match.recordType && (
            <div className="text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium text-muted-foreground">
                {match.recordType}
              </span>
            </div>
          )}
          {match.collectionTitle && (
            <div className="text-xs text-muted-foreground truncate" title={match.collectionTitle}>
              <span className="font-medium">collection:</span> {match.collectionTitle}
            </div>
          )}
        </div>
      </div>

      {/* OCR snippet for newspaper hints */}
      {match.snippet && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            text excerpt
          </div>
          <p className="text-xs text-foreground italic leading-relaxed">{match.snippet}</p>
        </div>
      )}

      {/* relationships from source */}
      {match.relationships && match.relationships.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            relationships from source
          </div>
          {match.relationships.map((rel, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium capitalize">{rel.type}:</span> {rel.name}
            </div>
          ))}
        </div>
      )}

      {/* evidence breakdown */}
      {evidence && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            evidence breakdown
          </div>
          <EvidenceBar label="name" score={evidence.nameMatch.score} max={40} details={evidence.nameMatch.details} />
          {evidence.dateMatch && <EvidenceBar label="date" score={evidence.dateMatch.score} max={30} details={evidence.dateMatch.details} />}
          {evidence.placeMatch && <EvidenceBar label="place" score={evidence.placeMatch.score} max={15} details={evidence.placeMatch.details} />}
          {evidence.familyMatch && <EvidenceBar label="family" score={evidence.familyMatch.score} max={15} details={evidence.familyMatch.details} />}
        </div>
      )}

      {/* external link */}
      {match.sourceUrl && (
        <a
          href={match.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          view on {sourceLabel(hint.source_system)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}

      {/* action buttons */}
      {!isReviewed && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <form
            className="flex-1"
            action={(formData) => {
              startAccept(async () => {
                await acceptHintAction(formData);
                onAccepted();
              });
            }}
          >
            <input type="hidden" name="hintId" value={hint.id} />
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {acceptPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {acceptPending ? "importing..." : "accept & import"}
            </button>
          </form>
          <form
            action={(formData) => {
              startReject(async () => {
                await rejectHintAction(formData);
                onRejected();
              });
            }}
          >
            <input type="hidden" name="hintId" value={hint.id} />
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {rejectPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              reject
            </button>
          </form>
        </div>
      )}

      {isReviewed && (
        <div className={`text-center py-2 text-sm font-medium ${
          hint.status === "accepted" ? "text-green-600" : "text-muted-foreground"
        }`}>
          {hint.status === "accepted" ? "accepted & imported" : hint.status}
        </div>
      )}
    </div>
  );
}

function EvidenceBar({ label, score, max, details }: { label: string; score: number; max: number; details: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{score}/{max}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-yellow-500" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground">{details}</div>
    </div>
  );
}

// ---------- main modal ----------

export function HintsModal({
  open,
  onClose,
  pendingCount,
}: {
  open: boolean;
  onClose: () => void;
  pendingCount: number;
}) {
  const [hints, setHints] = useState<EnrichedHint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "accepted" | "rejected" | "all">("pending");
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchHints = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/hints" : `/api/hints?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHints(data.hints ?? []);
        // auto-select first
        if (data.hints?.length > 0 && !selectedId) {
          setSelectedId(data.hints[0].id);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (open) {
      fetchHints();
    } else {
      setHints([]);
      setSelectedId(null);
      setFilter("pending");
    }
  }, [open, fetchHints]);

  // keyboard: escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const selectedHint = hints.find((h) => h.id === selectedId) ?? null;

  const handleReviewed = useCallback(() => {
    // remove from list and select next
    setHints((prev) => {
      const next = prev.filter((h) => h.id !== selectedId);
      if (next.length > 0) {
        const currentIdx = prev.findIndex((h) => h.id === selectedId);
        const nextIdx = Math.min(currentIdx, next.length - 1);
        setSelectedId(next[nextIdx].id);
      } else {
        setSelectedId(null);
      }
      return next;
    });
  }, [selectedId]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-stretch"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* backdrop — semi-transparent so tree is visible */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* modal panel — full height, anchored right */}
      <div className="relative ml-auto flex h-full w-full max-w-4xl shadow-2xl">
        {/* hint list (left panel) */}
        <div className="w-80 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          {/* header */}
          <div className="border-b border-border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">suggested matches</h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* filter tabs */}
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
              {(["pending", "all", "accepted", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelectedId(null); }}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* hint tiles */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : hints.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                {filter === "pending" ? "no pending hints" : `no ${filter} hints`}
              </div>
            ) : (
              hints.map((h) => (
                <HintTile
                  key={h.id}
                  hint={h}
                  isSelected={h.id === selectedId}
                  onClick={() => setSelectedId(h.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* detail panel (right) */}
        <div className="flex-1 overflow-y-auto bg-background p-5">
          {selectedHint ? (
            <HintDetail
              hint={selectedHint}
              onAccepted={handleReviewed}
              onRejected={handleReviewed}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {hints.length > 0 ? "select a hint to review" : "no hints to display"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- trigger button ----------

export function HintsModalTrigger({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-muted-foreground hover:text-foreground transition-colors"
        title={`${pendingCount} suggested matches`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M11 8v4" />
          <path d="M11 16h.01" />
        </svg>
        {pendingCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {pendingCount}
          </span>
        )}
      </button>

      <HintsModal open={open} onClose={() => setOpen(false)} pendingCount={pendingCount} />
    </>
  );
}
