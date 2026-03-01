"use client";

import { useState, useRef } from "react";
import { uploadPhotoToR2, type PhotoItem } from "@/components/ui/evidence-photo-upload";
import { apiUrl } from "@/lib/api-url";

interface PhotoQuickLogButtonProps {
  playdateId: string;
  playdateTitle: string;
  playdateSlug?: string;
}

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Camera-first quick reflection button.
 *
 * Tap → device camera opens → photo captured → auto-creates run +
 * evidence record → uploads to R2 → awards photo credit.
 *
 * Sits alongside the existing QuickLogButton. The key difference is
 * that this button leads with the photo, creating the run only after
 * the user has taken a picture.
 *
 * Backlog item #15: "camera icon → opens device camera → auto-creates
 * run with photo. alongside existing quick-log button."
 */
export default function PhotoQuickLogButton({
  playdateId,
  playdateTitle,
  playdateSlug,
}: PhotoQuickLogButtonProps) {
  const [state, setState] = useState<
    "idle" | "capturing" | "uploading" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openCamera() {
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-selected

    if (!file) return;

    // validate
    if (!ACCEPTED_MIME.has(file.type)) {
      setErrorMsg("unsupported image type");
      setState("error");
      setTimeout(() => setState("idle"), 2500);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("photo must be under 5 MB");
      setState("error");
      setTimeout(() => setState("idle"), 2500);
      return;
    }

    // show preview immediately
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setState("uploading");

    try {
      // 1. create the run
      const runRes = await fetch(apiUrl("/api/runs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playdateTitle,
          playdateId,
          runType: "quick log",
          runDate: new Date().toISOString().slice(0, 10),
          contextTags: [],
          traceEvidence: [],
          whatChanged: null,
          nextIteration: null,
          materialIds: [],
        }),
      });
      if (!runRes.ok) throw new Error("could not create run");
      const { id: runId } = await runRes.json();

      // 2. create the evidence record
      const evidenceRes = await fetch(`/api/runs/${runId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceType: "photo",
          sortOrder: 0,
        }),
      });
      if (!evidenceRes.ok) throw new Error("could not create evidence");
      const { id: evidenceId } = await evidenceRes.json();

      // 3. upload the photo to R2 via presigned URL
      const photo: PhotoItem = {
        localId: `pql-${Date.now()}`,
        previewUrl: preview,
        file,
        status: "uploading",
      };
      const { storageKey, thumbnailKey } = await uploadPhotoToR2(
        photo,
        runId,
        evidenceId,
      );

      // 4. patch the evidence record with the storage keys
      await fetch(`/api/runs/${runId}/evidence/${evidenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey, thumbnailKey }),
      });

      setState("done");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "something went wrong",
      );
      setState("error");
      setTimeout(() => {
        setState("idle");
        setPreviewUrl(null);
        setErrorMsg(null);
      }, 3000);
    }
  }

  /* ── done state ── */
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-cadet/60 bg-champagne/20">
        {previewUrl && (
          <img
            src={previewUrl}
            alt=""
            className="w-5 h-5 rounded object-cover"
          />
        )}
        <span>photo logged</span>
      </span>
    );
  }

  /* ── uploading state ── */
  if (state === "uploading") {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-sienna/30 bg-sienna/5 px-4 py-2 text-sm font-medium text-cadet/70">
        {previewUrl && (
          <img
            src={previewUrl}
            alt=""
            className="w-5 h-5 rounded object-cover opacity-70"
          />
        )}
        <span
          className="inline-block w-3.5 h-3.5 border-2 rounded-full animate-spin"
          style={{
            borderColor: "var(--wv-sienna)",
            borderTopColor: "transparent",
          }}
        />
        <span className="text-xs">saving…</span>
      </span>
    );
  }

  /* ── idle / error state ── */
  return (
    <>
      <button
        type="button"
        onClick={openCamera}
        disabled={state === "capturing"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sienna/25 px-4 py-2 text-sm font-medium text-sienna hover:bg-sienna/5 hover:border-sienna/40 transition-all disabled:opacity-50"
        title="snap a photo and log it"
      >
        <CameraIcon />
        <span>{state === "error" ? (errorMsg ?? "try again") : "snap it"}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
}

/* ── camera icon ── */
function CameraIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width={18}
      height={18}
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M7.5 4l-1 2H3.5A1.5 1.5 0 0 0 2 7.5v7A1.5 1.5 0 0 0 3.5 16h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 16.5 6H13.5l-1-2h-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10.5"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

