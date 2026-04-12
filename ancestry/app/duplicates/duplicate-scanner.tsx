"use client";

import { useState, useTransition } from "react";
import { scanDuplicatesAction, mergePersonsAction, type SerializedDuplicate } from "./actions";

export function DuplicateScanner() {
  const [duplicates, setDuplicates] = useState<SerializedDuplicate[] | null>(null);
  const [scanning, startScan] = useTransition();
  const [merging, startMerge] = useTransition();
  const [mergedPairs, setMergedPairs] = useState<Set<string>>(new Set());
  const [confirmMerge, setConfirmMerge] = useState<SerializedDuplicate | null>(null);
  const [keepId, setKeepId] = useState<string>("");

  function handleScan() {
    startScan(async () => {
      const results = await scanDuplicatesAction();
      setDuplicates(results);
      setMergedPairs(new Set());
    });
  }

  function openMergeDialog(dup: SerializedDuplicate) {
    setConfirmMerge(dup);
    setKeepId(dup.personAId); // default: keep person A
  }

  function handleMerge() {
    if (!confirmMerge || !keepId) return;
    const removeId = keepId === confirmMerge.personAId ? confirmMerge.personBId : confirmMerge.personAId;
    const pairKey = `${confirmMerge.personAId}|${confirmMerge.personBId}`;

    startMerge(async () => {
      await mergePersonsAction(keepId, removeId);
      setMergedPairs((prev) => new Set(prev).add(pairKey));
      setConfirmMerge(null);
    });
  }

  function confidenceColor(score: number): string {
    if (score >= 70) return "text-green-600 bg-green-500/10";
    if (score >= 50) return "text-yellow-600 bg-yellow-500/10";
    return "text-orange-600 bg-orange-500/10";
  }

  function confidenceLabel(score: number): string {
    if (score >= 70) return "high";
    if (score >= 50) return "medium";
    return "low";
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handleScan}
        disabled={scanning}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {scanning ? "scanning..." : duplicates ? "re-scan tree" : "scan for duplicates"}
      </button>

      {duplicates !== null && duplicates.length === 0 && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-6 text-center">
          <p className="text-sm text-green-600 font-medium">no duplicates found</p>
          <p className="text-xs text-muted-foreground mt-1">your tree looks clean</p>
        </div>
      )}

      {duplicates && duplicates.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {duplicates.length} potential duplicate{duplicates.length === 1 ? "" : "s"} found
          </p>

          {duplicates.map((dup) => {
            const pairKey = `${dup.personAId}|${dup.personBId}`;
            const isMerged = mergedPairs.has(pairKey);

            if (isMerged) {
              return (
                <div
                  key={pairKey}
                  className="rounded-md border border-green-500/30 bg-green-500/5 p-4"
                >
                  <p className="text-sm text-green-600">merged successfully</p>
                </div>
              );
            }

            return (
              <div
                key={pairKey}
                className="rounded-md border border-border p-4 space-y-3 hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {dup.personAName}
                      </span>
                      <span className="text-xs text-muted-foreground">↔</span>
                      <span className="text-sm font-medium text-foreground">
                        {dup.personBName}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dup.reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceColor(dup.score)}`}
                    >
                      {confidenceLabel(dup.score)} ({dup.score}%)
                    </span>
                    <button
                      onClick={() => openMergeDialog(dup)}
                      className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      merge
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* merge confirmation dialog */}
      {confirmMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">merge persons</h3>
            <p className="text-xs text-muted-foreground">
              choose which person to keep. the other person&apos;s names, events,
              relationships, and notes will be merged in, then the duplicate will be removed.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="keepPerson"
                  checked={keepId === confirmMerge.personAId}
                  onChange={() => setKeepId(confirmMerge.personAId)}
                  className="accent-primary"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    keep {confirmMerge.personAName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    remove {confirmMerge.personBName}
                  </span>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="keepPerson"
                  checked={keepId === confirmMerge.personBId}
                  onChange={() => setKeepId(confirmMerge.personBId)}
                  className="accent-primary"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    keep {confirmMerge.personBName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    remove {confirmMerge.personAName}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleMerge}
                disabled={merging}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {merging ? "merging..." : "confirm merge"}
              </button>
              <button
                onClick={() => setConfirmMerge(null)}
                disabled={merging}
                className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* empty state */}
      {duplicates === null && !scanning && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          click &quot;scan for duplicates&quot; to check your tree for potential matches
        </div>
      )}
    </div>
  );
}
