"use client";

/**
 * Photo upload component for evidence capture.
 *
 * Supports:
 * - Drag-and-drop
 * - Click to select file
 * - Camera capture on mobile (via accept="image/*" + capture)
 * - Up to 5 photos per reflection
 * - Shows thumbnails with remove button
 * - Handles presigned URL upload to R2
 *
 * Phase B — evidence capture (practitioner tier).
 */

import { useState, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/api-url";

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);

export interface PhotoItem {
  /** Local ID for keying before server round-trip */
  localId: string;
  /** Preview data URL for the thumbnail */
  previewUrl: string;
  /** File object for upload */
  file: File;
  /** Set once upload completes */
  storageKey?: string;
  /** Set once upload completes */
  thumbnailKey?: string;
  /** Upload state */
  status: "pending" | "uploading" | "done" | "error";
  /** Error message if status is error */
  errorMsg?: string;
}

let nextLocalId = 0;
function genLocalId() {
  return `photo-${Date.now()}-${nextLocalId++}`;
}

export default function EvidencePhotoUpload({
  runId,
  photos,
  onChange,
}: {
  /** Reflection ID (needed for upload URL generation). Null if reflection not yet created. */
  runId: string | null;
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return;

      const newPhotos: PhotoItem[] = [];

      for (const file of Array.from(files).slice(0, remaining)) {
        // Validate type
        if (!ACCEPTED_MIME.has(file.type)) continue;
        // Validate size
        if (file.size > MAX_FILE_SIZE) continue;

        const previewUrl = URL.createObjectURL(file);
        newPhotos.push({
          localId: genLocalId(),
          previewUrl,
          file,
          status: "pending",
        });
      }

      if (newPhotos.length > 0) {
        onChange([...photos, ...newPhotos]);
      }
    },
    [photos, onChange],
  );

  const removePhoto = useCallback(
    (localId: string) => {
      const updated = photos.filter((p) => p.localId !== localId);
      onChange(updated);
    },
    [photos, onChange],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-cadet/60 font-medium">
          photos ({photos.length}/{MAX_PHOTOS})
        </label>
        {photos.length > 0 && (
          <span className="text-[10px] text-cadet/40">
            drag to reorder · click × to remove
          </span>
        )}
      </div>

      {/* thumbnail grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div
              key={photo.localId}
              className="relative group rounded-lg overflow-hidden border border-cadet/10"
              style={{ width: 80, height: 80 }}
            >
              <img
                src={photo.previewUrl}
                alt="evidence photo"
                className="w-full h-full object-cover"
              />

              {/* upload status overlay */}
              {photo.status === "uploading" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <div
                    className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: "var(--wv-sienna)",
                      borderTopColor: "transparent",
                    }}
                  />
                </div>
              )}
              {photo.status === "error" && (
                <div className="absolute inset-0 bg-red-50/80 flex items-center justify-center">
                  <span className="text-[10px] text-redwood font-medium px-1 text-center">
                    {photo.errorMsg || "upload failed"}
                  </span>
                </div>
              )}
              {photo.status === "done" && (
                <div className="absolute top-1 left-1">
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px]"
                    style={{ backgroundColor: "var(--color-success-vivid, #2a9d50)" }}
                  >
                    ✓
                  </span>
                </div>
              )}

              {/* remove button */}
              <button
                type="button"
                onClick={() => removePhoto(photo.localId)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-cadet/60
                           flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
                           transition-opacity hover:bg-white hover:text-redwood"
                aria-label="remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* drop zone / add button */}
      {!atLimit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver
              ? "var(--wv-sienna)"
              : "rgba(39, 50, 72, 0.12)",
            backgroundColor: dragOver
              ? "rgba(203, 120, 88, 0.06)"
              : "transparent",
          }}
        >
          <p className="text-xs text-cadet/50">
            {photos.length === 0
              ? "tap to add photos, or drag them here"
              : `add more (${MAX_PHOTOS - photos.length} remaining)`}
          </p>
          <p className="text-[10px] text-cadet/30 mt-1">
            jpeg, png, webp · up to 5 MB each
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = ""; // reset so same file can be re-selected
        }}
      />
    </div>
  );
}

/**
 * Upload a single photo to R2 via presigned URL.
 * Called after the reflection is saved and we have a runId + evidenceId.
 */
export async function uploadPhotoToR2(
  photo: PhotoItem,
  runId: string,
  evidenceId: string,
): Promise<{ storageKey: string; thumbnailKey: string }> {
  // 1. Get presigned URL from our API
  const urlRes = await fetch(apiUrl("/api/evidence/upload-url"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId,
      evidenceId,
      contentType: photo.file.type || "image/jpeg",
    }),
  });

  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error(err.error || "failed to get upload URL");
  }

  const { uploadUrl, storageKey, thumbnailKey } = await urlRes.json();

  // 2. Upload directly to R2
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": photo.file.type || "image/jpeg" },
    body: photo.file,
  });

  if (!putRes.ok) {
    throw new Error("failed to upload photo to storage");
  }

  return { storageKey, thumbnailKey };
}
