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
import { useEffect, useRef } from "react";
import Link from "next/link";
import { haptic } from "@/lib/haptics";
import EvidenceCaptureSection, {
  hasEvidenceContent,
} from "../evidence-capture-section";
import { uploadPhotoToR2 } from "../evidence-photo-upload";
import type { PhotoItem } from "../evidence-photo-upload";
import type { Playdate, Material } from "./types";
import { useRunFormState } from "./use-run-form-state";
import { RunFormEssentials } from "./run-form-essentials";
import { RunFormOptional } from "./run-form-optional";
import { RunFormActions } from "./run-form-actions";
import { CoPlayInvite } from "@/components/co-play-invite";
import FunctionDiscoveryToast from "../function-discovery-toast";
import { apiUrl } from "@/lib/api-url";

/** Optional pack upsell info passed from the server page. */
export interface ReflectionPackInfo {
  packSlug: string;
  packTitle: string;
  playdateCount: number;
}

export default function RunForm({
  playdates,
  materials,
  isPractitioner = false,
  initialPlaydateId = "",
  packInfo,
}: {
  playdates: Playdate[];
  materials: Material[];
  /** Whether the current user has practitioner-level access for evidence capture. */
  isPractitioner?: boolean;
  /** Pre-select a playdate (e.g. from ?playdate=slug deep link). */
  initialPlaydateId?: string;
  /** Optional pack info for post-reflection upsell CTA. */
  packInfo?: ReflectionPackInfo | null;
}) {
  const router = useRouter();
  const state = useRunFormState(initialPlaydateId);
  const quickPhotoInputRef = useRef<HTMLInputElement>(null);

  const QUICK_MAX_PHOTOS = 3;
  const QUICK_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const QUICK_ACCEPTED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
  ]);

  let quickPhotoLocalId = 0;

  function handleQuickPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = "";

    if (!QUICK_ACCEPTED_MIME.has(file.type)) {
      state.setError("unsupported file type — use jpeg, png, webp, or heic");
      return;
    }
    if (file.size > QUICK_MAX_FILE_SIZE) {
      state.setError("photo must be under 5 MB");
      return;
    }
    if (state.evidenceState.photos.length >= QUICK_MAX_PHOTOS) return;

    const newPhoto: PhotoItem = {
      localId: `quick-${Date.now()}-${quickPhotoLocalId++}`,
      previewUrl: URL.createObjectURL(file),
      file,
      status: "pending",
    };

    state.setEvidenceState({
      ...state.evidenceState,
      photos: [...state.evidenceState.photos, newPhoto],
    });
  }

  function removeQuickPhoto(localId: string) {
    const photo = state.evidenceState.photos.find((p) => p.localId === localId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    state.setEvidenceState({
      ...state.evidenceState,
      photos: state.evidenceState.photos.filter((p) => p.localId !== localId),
    });
  }

  // Default to quick share mode — playful, low-friction for everyone
  useEffect(() => {
    state.setQuickMode(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Save evidence items for a newly created reflection.
   * Called after the reflection POST succeeds. Best-effort — errors are
   * logged but don’t block navigation.
   */
  async function saveEvidence(runId: string, evidenceState: typeof state.evidenceState) {
    const promises: Promise<void>[] = [];

    // Save photos — create evidence record, upload to R2, then save consent
    const photoEvidenceIds: string[] = [];
    for (const photo of evidenceState.photos) {
      promises.push(
        (async () => {
          const res = await fetch(apiUrl(`/api/runs/${runId}/evidence`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evidenceType: "photo" }),
          });
          if (!res.ok) throw new Error("failed to create photo evidence");
          const { id: evidenceId } = await res.json();
          photoEvidenceIds.push(evidenceId);

          // Upload to R2 — storage keys are saved server-side
          // in the upload-url route, no client PATCH needed
          await uploadPhotoToR2(photo, runId, evidenceId);
        })(),
      );
    }

    // Save quotes
    for (const quote of evidenceState.quotes) {
      promises.push(
        (async () => {
          await fetch(apiUrl(`/api/runs/${runId}/evidence`), {
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
          await fetch(apiUrl(`/api/runs/${runId}/evidence`), {
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

    // Save photo consent for all photo evidence items (if consent was given)
    if (evidenceState.photoConsent && photoEvidenceIds.length > 0) {
      const consentPromises = photoEvidenceIds.map((evidenceId) =>
        fetch(apiUrl("/api/photo-consents"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runEvidenceId: evidenceId,
            consentTier: evidenceState.photoConsent!.tier,
            marketingApproved: evidenceState.photoConsent!.marketingApproved,
            parentName: evidenceState.photoConsent!.parentName || null,
            childAgeRange: evidenceState.photoConsent!.childAgeRange || null,
          }),
        }).catch((err) => console.error("photo consent save error:", err)),
      );
      await Promise.allSettled(consentPromises);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    haptic("medium");

    // Quick mode only requires title + date; full mode requires runType too
    if (state.quickMode) {
      if (!state.title.trim() || !state.runDate) return;
    } else {
      if (!state.title.trim() || !state.runType || !state.runDate) return;
    }

    state.setLoading(true);
    state.setError(null);

    try {
      // 1. Create the run
      const res = await fetch(apiUrl("/api/runs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title.trim(),
          playdateId: state.playdateId || null,
          runType: state.quickMode ? "quick_log" : state.runType,
          runDate: state.runDate,
          contextTags: state.quickMode ? [] : state.contextTags,
          traceEvidence: state.quickMode ? [] : state.traceEvidence,
          materialIds: state.quickMode ? [] : state.selectedMaterials,
          materialsUsedAs: state.quickMode
            ? []
            : state.selectedMaterials
                .filter((id) => state.materialsUsedAs[id])
                .map((id) => ({
                  material_id: id,
                  function_used: state.materialsUsedAs[id],
                })),
          whatChanged: state.quickMode ? null : (state.whatChanged.trim() || null),
          nextIteration: state.quickMode ? null : (state.nextIteration.trim() || null),
          isFindAgain: state.isFindAgain,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to create run");

      // Store run ID for co-play invite in success panel
      state.setCreatedRunId(data.id);

      // Store function discoveries for celebration toast
      if (data.newDiscoveries?.length > 0) {
        state.setNewDiscoveries(data.newDiscoveries);
      }

      // 2. Save evidence items if any exist (practitioner tier)
      if ((isPractitioner || state.quickMode) && hasEvidenceContent(state.evidenceState) && data.id) {
        state.setSavingEvidence(true);
        try {
          await saveEvidence(data.id, state.evidenceState);
        } catch (evidenceErr) {
          // Log but don’t block — the run itself was saved
          console.error("evidence save error:", evidenceErr);
        }
      }

      // Show success state with optional upsell before redirecting
      state.setSuccess(true);
    } catch (err: any) {
      state.setError(err.message);
    } finally {
      state.setLoading(false);
      state.setSavingEvidence(false);
    }
  }

  // Auto-redirect to playbook after success panel is shown
  // Pause the timer if user is interacting with co-play invite
  const coPlayInteracted = useRef(false);
  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(() => {
      if (!coPlayInteracted.current) router.push("/playbook");
    }, 5000);
    return () => clearTimeout(timer);
  }, [state.success, router]);

  // ── success state with optional pack upsell + co-play invite ──
  if (state.success) {
    return (
      <>
        {/* function discovery celebration toasts */}
        {state.newDiscoveries.map((d, i) => (
          <FunctionDiscoveryToast
            key={`${d.materialTitle}-${d.functionUsed}-${i}`}
            materialTitle={d.materialTitle}
            functionUsed={d.functionUsed}
          />
        ))}

        <div className="rounded-xl border border-champagne/40 bg-cream/10 p-6 text-center space-y-4">
          <p className="text-lg font-semibold text-cadet">
            ✓ reflection saved!
          </p>

          {packInfo && (
            <div className="bg-white rounded-lg border border-sienna/15 p-4">
              <p className="text-sm text-cadet/70 mb-2">
                love exploring? <span className="font-semibold text-cadet">{packInfo.packTitle}</span> has{" "}
                {packInfo.playdateCount} more playdate{packInfo.playdateCount !== 1 ? "s" : ""} like this one.
              </p>
              <Link
                href={`/packs/${packInfo.packSlug}`}
                className="inline-block rounded-lg bg-redwood px-5 py-2 text-sm text-white font-medium hover:bg-sienna transition-colors"
              >
                unlock the full pack &rarr;
              </Link>
            </div>
          )}

          {/* co-play invite — let users invite someone to this run */}
          {state.createdRunId && (
            <div
              className="text-left"
              onMouseDown={() => { coPlayInteracted.current = true; }}
              onTouchStart={() => { coPlayInteracted.current = true; }}
            >
              <p className="text-xs font-semibold text-cadet/60 mb-2 text-center">
                play together?
              </p>
              <CoPlayInvite runId={state.createdRunId} />
            </div>
          )}

          {/* credit nudge when no pack upsell */}
          {!packInfo && (
            <p className="text-xs text-cadet/50">
              +1 credit earned!{" "}
              {state.isFindAgain && "+2 bonus for find again! "}
              <Link
                href="/playbook"
                className="text-sienna hover:text-redwood transition-colors"
              >
                see your progress &rarr;
              </Link>
            </p>
          )}

          <p className="text-xs text-cadet/40">
            heading to your playbook&hellip;
          </p>
        </div>
      </>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={state.quickMode ? "space-y-4" : "space-y-6"}
      aria-label="log a reflection"
      aria-describedby={state.error ? "reflection-error" : undefined}
    >
      {/* ── mode toggle: quick share / full reflection ──────────────── */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "rgba(39, 50, 72, 0.06)" }}>
        <button
          type="button"
          onClick={() => state.setQuickMode(true)}
          className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            backgroundColor: state.quickMode ? "var(--wv-seafoam)" : "transparent",
            color: state.quickMode ? "white" : "var(--wv-cadet)",
            opacity: state.quickMode ? 1 : 0.6,
          }}
        >
          quick share
        </button>
        <button
          type="button"
          onClick={() => state.setQuickMode(false)}
          className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            backgroundColor: !state.quickMode ? "var(--wv-sienna)" : "transparent",
            color: !state.quickMode ? "white" : "var(--wv-cadet)",
            opacity: !state.quickMode ? 1 : 0.6,
          }}
        >
          full reflection
        </button>
      </div>

      {state.quickMode ? (
        /* ── quick share mode ──────────────────────────────────────── */
        <div className="space-y-3">
          {/* playdate selector */}
          <div>
            <label className="block text-xs text-cadet/60 mb-1">
              linked playdate
            </label>
            <select
              value={state.playdateId}
              onChange={(e) => state.setPlaydateId(e.target.value)}
              className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
            >
              <option value="">none</option>
              {playdates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* what happened? */}
          <div>
            <label className="block text-xs text-cadet/60 mb-1">
              what happened? <span className="text-redwood">*</span>
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => state.setTitle(e.target.value)}
              placeholder="e.g. we built a tower and it kept falling over"
              className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
              required
            />
          </div>

          {/* inline photo capture */}
          <input
            ref={quickPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            className="hidden"
            onChange={handleQuickPhotoSelect}
          />

          {state.evidenceState.photos.length === 0 ? (
            <button
              type="button"
              className="w-full rounded-lg border-2 border-dashed border-cadet/15 px-4 py-6 text-center transition-all hover:border-cadet/25 hover:bg-cream/20"
              onClick={() => quickPhotoInputRef.current?.click()}
            >
              <span className="block text-2xl mb-1" aria-hidden>
                📷
              </span>
              <span className="text-xs text-cadet/50">
                add a photo
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {state.evidenceState.photos.map((photo) => (
                  <div
                    key={photo.localId}
                    className="relative"
                    style={{ width: 80, height: 80 }}
                  >
                    <img
                      src={photo.previewUrl}
                      alt="photo preview"
                      className="rounded-lg object-cover"
                      style={{ width: 80, height: 80 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeQuickPhoto(photo.localId)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center leading-none"
                      style={{ backgroundColor: "var(--wv-redwood)" }}
                      aria-label="remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {state.evidenceState.photos.length < QUICK_MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => quickPhotoInputRef.current?.click()}
                  className="text-xs transition-colors"
                  style={{ color: "var(--wv-sienna)" }}
                >
                  + add another
                </button>
              )}
            </div>
          )}

          {/* hidden date field — auto-set to today */}
          <input type="hidden" value={state.runDate} />

          {/* submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={state.loading || !state.title.trim() || !state.runDate}
              className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
              style={{ backgroundColor: "var(--wv-seafoam)" }}
            >
              {state.loading
                ? "sharing…"
                : state.evidenceState.photos.length > 0
                  ? "share with photo"
                  : "share"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/playbook")}
              className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-70"
              style={{ color: "var(--wv-cadet)" }}
            >
              cancel
            </button>
          </div>

          {/* error */}
          {state.error && (
            <div
              id="reflection-error"
              className="rounded-lg p-3 text-sm"
              style={{
                backgroundColor: "rgba(177, 80, 67, 0.08)",
                color: "var(--wv-redwood)",
              }}
            >
              {state.error}
            </div>
          )}
        </div>
      ) : (
        /* ── full reflection mode ──────────────────────────────────── */
        <>
          <RunFormEssentials state={state} playdates={playdates} />

          {/* ── evidence capture section (practitioner tier) ────────── */}
          <EvidenceCaptureSection
            runId={null}
            state={state.evidenceState}
            onChange={state.setEvidenceState}
            isPractitioner={isPractitioner}
          />

          <RunFormOptional state={state} materials={materials} />

          <RunFormActions state={state} />
        </>
      )}
    </form>
  );
}

