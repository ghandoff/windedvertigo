"use client";

import { useState } from "react";

export function GedcomExport() {
  const [downloading, setDownloading] = useState(false);
  const [redactLiving, setRedactLiving] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);

    try {
      const privacy = redactLiving ? "redact" : "full";
      const res = await fetch(`/api/export?format=gedcom&privacy=${privacy}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "download failed" }));
        setError(data.error ?? "download failed");
        return;
      }

      // trigger file download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "family-tree.ged";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        export tree
      </h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            disabled
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option>GEDCOM 5.5.1</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={redactLiving}
            onChange={(e) => setRedactLiving(e.target.checked)}
            className="rounded border-border"
          />
          redact living persons
        </label>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {downloading ? "downloading..." : "download"}
        </button>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
