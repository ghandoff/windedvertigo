"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  rfpId: string;
  currentUrl: string | null;
}

export function RfpDocumentUpload({ rfpId, currentUrl }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Core submit — shared between click-to-pick and drag-drop paths.
  async function handleFileSubmit(file: File) {
    setUploadState("uploading");
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/document`, {
        method: "POST",
        body: form,
      });
      // Parse response JSON regardless of status — 2xx has extraction details,
      // 4xx/5xx has an error field. Failing to parse is itself an error.
      const data: { error?: string; ok?: boolean; notionUpdated?: boolean } = await res
        .json()
        .catch(() => ({ error: "server returned invalid response" }));

      if (res.ok) {
        setUploadState("done");
        router.refresh();
        setTimeout(() => setUploadState("idle"), 2000);
      } else {
        setUploadState("idle");
        setUploadError(data.error ?? `upload failed (${res.status})`);
      }
    } catch (err) {
      setUploadState("idle");
      setUploadError(err instanceof Error ? err.message : "upload failed — network error");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileSubmit(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileSubmit(file);
  }

  if (currentUrl) {
    return (
      <div
        className={`space-y-3 rounded-md p-3 transition-colors ${
          isDragging ? "bg-accent/10 ring-2 ring-accent ring-offset-1 ring-dashed" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1"
          >
            document attached <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {isDragging && (
          <p className="text-xs text-accent-foreground font-medium">drop to replace document</p>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2"
            disabled={uploadState === "uploading"}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadState === "uploading" ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> replacing…</>
            ) : (
              "replace document (or drag a file here)"
            )}
          </Button>
        </div>
        {uploadError && (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-md border-2 border-dashed p-4 transition-colors ${
        isDragging
          ? "border-accent bg-accent/10"
          : "border-border hover:border-border/80"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="text-xs text-muted-foreground">
        {isDragging
          ? "drop the file to attach"
          : "upload or drag the RFP document to auto-extract requirements, due date, value, and parse questions for the question bank."}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={uploadState !== "idle"}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploadState === "uploading" ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> uploading…</>
        ) : uploadState === "done" ? (
          <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> uploaded!</>
        ) : (
          <><Upload className="h-3.5 w-3.5" /> upload PDF or TXT</>
        )}
      </Button>
      {uploadError && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
}
