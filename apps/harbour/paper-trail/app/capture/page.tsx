"use client";

/**
 * paper.trail — capture page
 *
 * Camera viewfinder + capture + annotation flow.
 * Can be opened standalone or from an activity.
 */

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCamera } from "@/hooks/use-camera";
import { AnnotationOverlay } from "@/components/annotation-overlay";
import { saveCapture, generateCaptureId } from "@/lib/storage";
import type { Annotation, Capture } from "@/lib/types";

type ActivityMeta = { title: string; skillSlugs: string[] };

type Phase = "viewfinder" | "annotate" | "saved";

export default function CapturePage() {
  return (
    <Suspense>
      <CaptureInner />
    </Suspense>
  );
}

function CaptureInner() {
  const searchParams = useSearchParams();
  const activitySlug = searchParams.get("activity") ?? "freeform";
  const promptText = searchParams.get("prompt") ?? "";

  const { videoRef, error, ready, start, stop, capture } = useCamera();
  const [phase, setPhase] = useState<Phase>("viewfinder");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [notes, setNotes] = useState("");
  const [started, setStarted] = useState(false);
  const [activityMeta, setActivityMeta] = useState<ActivityMeta | null>(null);

  // Snapshot activity metadata so the saved capture carries its real
  // title + skills into the gallery (feeds mirror.log's skill tallies).
  useEffect(() => {
    if (activitySlug === "freeform") return;
    let cancelled = false;
    fetch(`/harbour/paper-trail/api/activity/${activitySlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.title) {
          setActivityMeta({ title: data.title, skillSlugs: data.skillSlugs ?? [] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activitySlug]);

  const handleStart = useCallback(async () => {
    await start();
    setStarted(true);
  }, [start]);

  const handleCapture = useCallback(() => {
    const dataUrl = capture();
    if (dataUrl) {
      stop();
      setImageDataUrl(dataUrl);
      setPhase("annotate");
    }
  }, [capture, stop]);

  const handleRetake = useCallback(async () => {
    setImageDataUrl(null);
    setAnnotations([]);
    setPhase("viewfinder");
    await start();
  }, [start]);

  const handleSave = useCallback(() => {
    if (!imageDataUrl) return;

    const captureData: Capture = {
      id: generateCaptureId(),
      activitySlug,
      timestamp: new Date().toISOString(),
      imageDataUrl,
      annotations,
      promptUsed: promptText || undefined,
      notes: notes || undefined,
      activityTitle: activityMeta?.title,
      activitySkills: activityMeta?.skillSlugs,
    };

    saveCapture(captureData);
    setPhase("saved");
  }, [imageDataUrl, activitySlug, annotations, promptText, notes, activityMeta]);

  const handleAddAnnotation = useCallback((ann: Annotation) => {
    setAnnotations((prev) => [...prev, ann]);
  }, []);

  const handleRemoveAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Prompt banner */}
      {promptText && (
        <div className="shrink-0 px-4 pt-3">
          <div className="p-3 rounded-xl border border-white/10 bg-white/5 text-sm">
            <span className="text-[var(--wv-sienna)] font-semibold text-xs uppercase tracking-wider mr-2">
              capture prompt
            </span>
            <span className="text-[var(--color-text-on-dark-muted)]">
              {promptText}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 min-h-0">
        {/* Viewfinder phase */}
        {phase === "viewfinder" && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {!started ? (
              <div className="text-center">
                <p className="text-[var(--color-text-on-dark-muted)] mb-6">
                  capture your physical work with your device camera.
                </p>
                <button
                  onClick={handleStart}
                  className="px-6 py-3 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all"
                >
                  open camera
                </button>
              </div>
            ) : error ? (
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Link
                  href="/"
                  className="text-[var(--color-accent-on-dark)] underline"
                >
                  back to activities
                </Link>
              </div>
            ) : (
              <>
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={handleCapture}
                  disabled={!ready}
                  className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all disabled:opacity-30"
                  aria-label="capture photo"
                />
              </>
            )}
          </div>
        )}

        {/* Annotate phase */}
        {phase === "annotate" && imageDataUrl && (
          <div className="flex flex-col gap-4 w-full max-w-lg">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
              <img
                src={imageDataUrl}
                alt="captured photo"
                className="w-full h-full object-cover"
              />
              <AnnotationOverlay
                width={1920}
                height={1080}
                annotations={annotations}
                onAdd={handleAddAnnotation}
                onRemove={handleRemoveAnnotation}
              />
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="add notes about what you notice..."
              className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-sm text-[var(--color-text-on-dark)] placeholder:text-[var(--color-text-on-dark-muted)] resize-none h-20"
              aria-label="capture notes"
            />

            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/5 transition-all"
              >
                retake
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all"
              >
                save to gallery
              </button>
            </div>
          </div>
        )}

        {/* Saved confirmation */}
        {phase === "saved" && (
          <div className="text-center">
            <p className="text-2xl font-bold mb-4">saved ✓</p>
            <p className="text-[var(--color-text-on-dark-muted)] mb-8">
              your capture has been added to your gallery.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetake}
                className="px-5 py-2.5 rounded-full border border-white/10 text-sm hover:bg-white/5 transition-all"
              >
                capture another
              </button>
              <Link
                href="/gallery"
                className="px-5 py-2.5 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
              >
                view gallery →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
