"use client";

/**
 * Run creation form — client component.
 *
 * Lightweight UX per DESIGN.md: required fields are minimal (title,
 * type, date). Everything else is optional and collapsible.
 *
 * Phase B adds the evidence capture section for practitioner-tier
 * users: photo upload, quote capture, guided observation prompts.
 * After the run is created, evidence items are saved via the
 * /api/runs/[id]/evidence endpoint, and photos are uploaded to R2.
 *
 * MVP 5 — reflections and evidence.
 */

import { useRouter } from "next/navigation";
import EvidenceCaptureSection, {
  hasEvidenceContent,
} from "../evidence-capture-section";
import { uploadPhotoToR2 } from "../evidence-photo-upload";
import type { Playdate, Material } from "./types";
import { useRunFormState } from "./use-run-form-state";
import { RunFormEssentials } from "./run-form-essentials";
import { RunFormOptional } from "./run-form-optional";
import { RunFormActions } from "./run-form-actions";

export default function RunForm({
  playdates,
  materials,
  isPractitioner = false,
  initialPlaydateId = "",
}: {
  playdates: Playdate[];
  materials: Material[];
  /** Whether the current user has practitioner-level access for evidence capture. */
  isPractitioner?: boolean;
  /** Pre-select a playdate (e.g. from ?playdate=slug deep link). */
  initialPlaydateId?: string;
}) {
  const router = useRouter();
  const state = useRunFormState(initialPlaydateId);

  /**
   * Save evidence items for a newly created reflection.
   * Called after the reflection POST succeeds. Best-effort — errors are
   * logged but don't block navigation.
   */
  async function saveEvidence(runId: string, evidenceState: typeof state.evidenceState) {
    const promises: Promise<void>[] = [];

    // Save photos — create evidence record, then upload to R2
    for (const photo of evidenceState.photos) {
      promises.push(
        (async () => {
          const res = await fetch(`/api/runs/${runId}/evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evidenceType: "photo" }),
          });
          if (!res.ok) throw new Error("failed to create photo evidence");
          const { id: evidenceId } = await res.json();

          // Upload to R2
          const { storageKey, thumbnailKey } = await uploadPhotoToR2(
            photo,
            runId,
            evidenceId,
          );

          // Update evidence record with storage keys
          await fetch(`/api/runs/${runId}/evidence/${evidenceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storageKey, thumbnailKey }),
          });
        })(),
      );
    }

    // Save quotes
    for (const quote of evidenceState.quotes) {
      promises.push(
        (async () => {
          await fetch(`/api/runs/${runId}/evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evidenceType: "quote",
              quoteText: quote.text,
              quoteAttribution: quote.attribution || null,
            }),
          });
        })(),
      );
    }

    // Save observations (only non-empty ones)
    for (const obs of evidenceState.observations) {
      if (!obs.body.trim()) continue;
      promises.push(
        (async () => {
          await fetch(`/api/runs/${runId}/evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evidenceType: "observation",
              body: obs.body.trim(),
              promptKey: obs.promptKey,
            }),
          });
        })(),
      );
    }

    await Promise.allSettled(promises);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.title.trim() || !state.runType || !state.runDate) return;

    state.setLoading(true);
    state.setError(null);

    try {
      // 1. Create the run
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title.trim(),
          playdateId: state.playdateId || null,
          runType: state.runType,
          runDate: state.runDate,
          contextTags: state.contextTags,
          traceEvidence: state.traceEvidence,
          materialIds: state.selectedMaterials,
          whatChanged: state.whatChanged.trim() || null,
          nextIteration: state.nextIteration.trim() || null,
          isFindAgain: state.isFindAgain,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to create run");

      // 2. Save evidence items if any exist (practitioner tier)
      if (isPractitioner && hasEvidenceContent(state.evidenceState) && data.id) {
        state.setSavingEvidence(true);
        try {
          await saveEvidence(data.id, state.evidenceState);
        } catch (evidenceErr) {
          // Log but don't block — the run itself was saved
          console.error("evidence save error:", evidenceErr);
        }
      }

      router.push("/playbook");
    } catch (err: any) {
      state.setError(err.message);
    } finally {
      state.setLoading(false);
      state.setSavingEvidence(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      aria-label="log a reflection"
      aria-describedby={state.error ? "reflection-error" : undefined}
    >
      <RunFormEssentials state={state} playdates={playdates} />

      {/* ── evidence capture section (practitioner tier) ────────────── */}
      <EvidenceCaptureSection
        runId={null}
        state={state.evidenceState}
        onChange={state.setEvidenceState}
        isPractitioner={isPractitioner}
      />

      <RunFormOptional state={state} materials={materials} />

      <RunFormActions state={state} />
    </form>
  );
}
