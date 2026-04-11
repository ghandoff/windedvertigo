"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Hint } from "@/lib/types";
import { acceptHintAction, rejectHintAction } from "./actions";

function confidenceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function confidenceBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function sourceLabel(source: string): string {
  switch (source) {
    case "familysearch":
      return "FamilySearch Tree";
    case "familysearch_records":
      return "FamilySearch Records";
    case "wikidata":
      return "Wikidata";
    case "chronicling_america":
      return "Newspaper Archive";
    case "nara":
      return "National Archives";
    case "dpla":
      return "Digital Public Library";
    default:
      return source;
  }
}

function isRecordHint(source: string): boolean {
  return ["familysearch_records", "chronicling_america", "nara", "dpla"].includes(source);
}

function EvidenceRow({
  label,
  score,
  maxScore,
  details,
}: {
  label: string;
  score: number;
  maxScore: number;
  details: string;
}) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const icon = score > 0 ? (pct >= 60 ? "+" : "~") : "-";
  const iconColor =
    score > 0
      ? pct >= 60
        ? "text-green-600"
        : "text-yellow-600"
      : "text-muted-foreground";

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={`font-mono font-bold shrink-0 w-3 ${iconColor}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{details}</span>
        <span className="text-muted-foreground ml-1">
          ({score}/{maxScore})
        </span>
      </div>
    </div>
  );
}

export function HintCard({
  hint,
  personDisplayName,
  personBirthYear,
  personBirthPlace,
  compact = false,
}: {
  hint: Hint;
  personDisplayName?: string;
  personBirthYear?: string | null;
  personBirthPlace?: string | null;
  compact?: boolean;
}) {
  const [acceptPending, startAcceptTransition] = useTransition();
  const [rejectPending, startRejectTransition] = useTransition();
  const isPending = acceptPending || rejectPending;

  const match = hint.match_data;
  const evidence = hint.evidence;
  const isReviewed = hint.status !== "pending";

  const matchDisplayName =
    match.displayName ||
    [match.givenNames, match.surname].filter(Boolean).join(" ") ||
    "unnamed";

  // build evidence rows from the evidence object
  const evidenceRows: {
    label: string;
    score: number;
    maxScore: number;
    details: string;
  }[] = [];

  if (evidence) {
    evidenceRows.push({
      label: "name",
      score: evidence.nameMatch.score,
      maxScore: 40,
      details: evidence.nameMatch.details,
    });
    if (evidence.dateMatch) {
      evidenceRows.push({
        label: "date",
        score: evidence.dateMatch.score,
        maxScore: 30,
        details: evidence.dateMatch.details,
      });
    }
    if (evidence.placeMatch) {
      evidenceRows.push({
        label: "place",
        score: evidence.placeMatch.score,
        maxScore: 15,
        details: evidence.placeMatch.details,
      });
    }
    if (evidence.familyMatch) {
      evidenceRows.push({
        label: "family",
        score: evidence.familyMatch.score,
        maxScore: 15,
        details: evidence.familyMatch.details,
      });
    }
  }

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 ${
        isReviewed ? "opacity-60" : "border-border"
      }`}
    >
      {/* top row: confidence + source */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceColor(hint.confidence)}`}
          >
            {hint.confidence}% match
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            via {sourceLabel(hint.source_system)}
          </span>
        </div>
        {isReviewed && (
          <span
            className={`text-xs font-medium ${
              hint.status === "accepted"
                ? "text-green-600"
                : hint.status === "rejected"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {hint.status}
          </span>
        )}
      </div>

      {/* side-by-side comparison */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* your tree */}
        <div className="rounded-md border border-border bg-background p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            your tree
          </div>
          <div className="text-sm font-medium truncate">
            {personDisplayName || "unknown"}
          </div>
          {personBirthYear && (
            <div className="text-xs text-muted-foreground">
              b. {personBirthYear}
            </div>
          )}
          {personBirthPlace && (
            <div className="text-xs text-muted-foreground truncate">
              {personBirthPlace}
            </div>
          )}
          <Link
            href={`/person/${hint.person_id}`}
            className="text-xs text-primary hover:underline"
          >
            view person
          </Link>
        </div>

        {/* arrow */}
        <div className="flex items-center justify-center pt-6 text-muted-foreground">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 12h8" />
            <path d="M5 12l3-3M5 12l3 3" />
            <path d="M19 12l-3-3M19 12l-3 3" />
          </svg>
        </div>

        {/* suggested match */}
        <div className="rounded-md border border-border bg-background p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {isRecordHint(hint.source_system) ? "record found" : "suggested match"}
          </div>
          <div className="text-sm font-medium truncate">{matchDisplayName}</div>
          {match.recordType && (
            <div className="text-xs">
              <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {match.recordType}
              </span>
            </div>
          )}
          {match.collectionTitle && (
            <div className="text-xs text-muted-foreground truncate" title={match.collectionTitle}>
              {match.collectionTitle}
            </div>
          )}
          {match.birthDate && (
            <div className="text-xs text-muted-foreground">
              {isRecordHint(hint.source_system) ? match.birthDate : `b. ${match.birthDate}`}
            </div>
          )}
          {match.birthPlace && (
            <div className="text-xs text-muted-foreground truncate">
              {match.birthPlace}
            </div>
          )}
          {match.deathDate && !isRecordHint(hint.source_system) && (
            <div className="text-xs text-muted-foreground">
              d. {match.deathDate}
            </div>
          )}
          {match.snippet && (
            <div className="text-xs text-muted-foreground italic line-clamp-2 mt-1">
              {match.snippet}
            </div>
          )}
        </div>
      </div>

      {/* evidence breakdown */}
      {!compact && evidenceRows.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            evidence breakdown
          </div>
          {evidenceRows.map((row) => (
            <EvidenceRow key={row.label} {...row} />
          ))}
          {/* overall confidence bar */}
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${confidenceBarColor(hint.confidence)}`}
                style={{ width: `${Math.min(hint.confidence, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* relationships from source */}
      {!compact && match.relationships && match.relationships.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            relationships from source
          </div>
          <ul className="space-y-0.5">
            {match.relationships.map((rel, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="capitalize">{rel.type}</span>: {rel.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* external link */}
      {match.sourceUrl && (
        <a
          href={match.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          view on {sourceLabel(hint.source_system)}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}

      {/* action buttons */}
      {!isReviewed && (
        <div className="flex gap-2 pt-1">
          <form
            action={(formData) => {
              startAcceptTransition(() => acceptHintAction(formData));
            }}
          >
            <input type="hidden" name="hintId" value={hint.id} />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {acceptPending ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {acceptPending ? "importing..." : "accept & import"}
            </button>
          </form>
          <form
            action={(formData) => {
              startRejectTransition(() => rejectHintAction(formData));
            }}
          >
            <input type="hidden" name="hintId" value={hint.id} />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {rejectPending ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              reject
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
