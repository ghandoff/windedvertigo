"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

interface CollectionExportButtonProps {
  collectionSlug: string;
  collectionTitle: string;
}

export default function CollectionExportButton({
  collectionSlug,
  collectionTitle,
}: CollectionExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/collections/${encodeURIComponent(collectionSlug)}/pdf`));

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "failed to generate pdf");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${collectionTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-booklet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-cadet px-4 py-2 text-sm text-champagne font-medium hover:bg-cadet/90 transition-colors disabled:opacity-50"
      >
        <span>{loading ? "generating pdf…" : "⬇ download collection"}</span>
      </button>

      {error && (
        <p className="mt-2 text-xs text-redwood">{error}</p>
      )}
    </div>
  );
}
