"use client";

/**
 * AssetPicker — popover that surfaces BD assets (case studies, decks,
 * portfolio links) inside the campaign wizard's rich-text editor, so
 * anyone composing a step can drop in an asset link in one click.
 *
 * Tabs:
 *   "library" — searches /api/bd-assets, inserts <a href="{url}">{name}</a>
 *   "upload"  — uploads a file via /api/assets/upload, inserts a link
 *
 * Usage:
 *   <AssetPicker
 *     onInsertHtml={(html) => editor.chain().focus().insertContent(html).run()}
 *     onClose={() => setOpen(false)}
 *   />
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Upload, FolderOpen, ExternalLink } from "lucide-react";
import type { BdAsset } from "@/lib/notion/types";

interface AssetPickerProps {
  onInsertHtml: (html: string) => void;
  onClose: () => void;
}

type Tab = "library" | "upload";

export function AssetPicker({ onInsertHtml, onClose }: AssetPickerProps) {
  const [tab, setTab] = useState<Tab>("library");
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<BdAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  // Fetch (debounced) when query changes and tab is "library"
  useEffect(() => {
    if (tab !== "library") return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = query.trim()
          ? `/api/bd-assets?search=${encodeURIComponent(query.trim())}&pageSize=20`
          : `/api/bd-assets?pageSize=20`;
        const res = await fetch(url);
        const data = await res.json();
        setAssets(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, tab]);

  function insertAsset(asset: BdAsset) {
    const href = asset.url?.trim();
    if (!href) return;
    const label = escapeHtml(asset.asset || asset.url);
    // Use target=_blank so assets open in a new tab in the final rendered email
    onInsertHtml(
      `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    );
    onClose();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setUploadError(data?.error || "upload failed");
        return;
      }
      const label = escapeHtml(file.name);
      onInsertHtml(
        `<a href="${escapeAttr(data.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      );
      onClose();
    } catch {
      setUploadError("upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg w-80 text-sm overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b bg-muted/30">
        <TabButton active={tab === "library"} onClick={() => setTab("library")}>
          <FolderOpen className="h-3.5 w-3.5" />
          from library
        </TabButton>
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          <Upload className="h-3.5 w-3.5" />
          upload file
        </TabButton>
      </div>

      {/* Library tab */}
      {tab === "library" && (
        <div>
          <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search assets..."
              className="w-full bg-transparent text-xs focus:outline-none"
            />
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!loading && assets.length === 0 && (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                {query.trim() ? "no assets match that search" : "no assets yet"}
              </div>
            )}
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => insertAsset(asset)}
                disabled={!asset.url}
                className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors flex items-start gap-2 border-b last:border-b-0 disabled:opacity-40 disabled:cursor-not-allowed"
                title={asset.url ? asset.url : "this asset has no URL"}
              >
                {asset.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnailUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted shrink-0 flex items-center justify-center text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{asset.asset}</div>
                  <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                    {asset.assetType && <span>{asset.assetType}</span>}
                    {asset.url && (
                      <>
                        {asset.assetType && <span>·</span>}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            upload a file (png, jpg, pdf, svg) — it'll be stored and a link will be inserted into the email.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="block w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accent/10 file:text-accent hover:file:bg-accent/20 file:cursor-pointer"
          />
          {uploading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              uploading...
            </div>
          )}
          {uploadError && (
            <div className="text-xs text-destructive">{uploadError}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-background text-foreground border-b-2 border-accent -mb-[2px]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ── tiny HTML escape helpers (avoid bringing in a dep) ─────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
