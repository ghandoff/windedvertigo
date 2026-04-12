"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { deleteMediaAction, setThumbnailAction } from "./photo-actions";
import type { MediaItem } from "./photo-actions";

export function PhotoGallery({
  personId,
  initialPhotos,
  currentThumbnail,
}: {
  personId: string;
  initialPhotos: MediaItem[];
  currentThumbnail: string | null;
}) {
  const [photos, setPhotos] = useState<MediaItem[]>(initialPhotos);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [thumb, setThumb] = useState(currentThumbnail);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("personId", personId);
      const res = await fetch("/api/media", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "upload failed");
        return;
      }
      const { id, url } = await res.json();
      const item: MediaItem = {
        id,
        url,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      };
      setPhotos((prev) => [item, ...prev]);
      // auto-set thumbnail if none
      if (!thumb) setThumb(url);
    } finally {
      setUploading(false);
    }
  }, [personId, thumb]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) upload(file);
    }
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDelete = (photo: MediaItem) => {
    if (!confirm(`delete ${photo.filename}?`)) return;
    startTransition(async () => {
      await deleteMediaAction(photo.id, personId);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      if (thumb === photo.url) setThumb(null);
      setLightbox(null);
    });
  };

  const handleSetThumbnail = (photo: MediaItem) => {
    startTransition(async () => {
      await setThumbnailAction(personId, photo.url);
      setThumb(photo.url);
    });
  };

  return (
    <div className="space-y-3">
      {/* photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photo.url}
                alt={photo.filename}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {thumb === photo.url && (
                <span className="absolute top-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  thumbnail
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* upload zone */}
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-1p-ignore
          autoComplete="off"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        {uploading ? (
          <p className="text-xs text-muted-foreground animate-pulse">uploading...</p>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-xs text-muted-foreground">drag photos here or click to upload</p>
          </>
        )}
      </div>

      {/* lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] flex flex-col items-center gap-3">
            <img
              src={lightbox.url}
              alt={lightbox.filename}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
            <div className="flex items-center gap-2">
              {thumb !== lightbox.url && (
                <button
                  type="button"
                  className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors min-h-[28px]"
                  onClick={() => handleSetThumbnail(lightbox)}
                  disabled={isPending}
                  aria-label="set as thumbnail"
                >
                  {isPending ? "saving..." : "set as thumbnail"}
                </button>
              )}
              {thumb === lightbox.url && (
                <span className="rounded-md bg-primary/80 px-3 py-1.5 text-xs font-medium text-primary-foreground min-h-[28px] flex items-center">
                  current thumbnail
                </span>
              )}
              <button
                type="button"
                className="rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors min-h-[28px]"
                onClick={() => handleDelete(lightbox)}
                disabled={isPending}
                aria-label={`delete ${lightbox.filename}`}
              >
                {isPending ? "deleting..." : "delete"}
              </button>
              <button
                type="button"
                className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors min-h-[28px]"
                onClick={() => setLightbox(null)}
                aria-label="close lightbox"
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
