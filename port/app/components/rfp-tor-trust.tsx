"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, ImageIcon, RefreshCw } from "lucide-react";

interface RfpTorTrustProps {
  rfpId: string;
  docUrl: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  torVerifiedAt: string | null;
  torVerifiedBy: string | null;
}

/**
 * TOR trust panel — visual confirmation (thumbnail) + human verification.
 * A screenshot lets you see at a glance whether a real TOR document is attached
 * or the "TOR" is just a website; the verify button flips the brief's provenance
 * to "verified-tor" (which also rebuilds the brief from the real TOR server-side).
 */
export function RfpTorTrust({
  rfpId,
  docUrl,
  sourceUrl,
  thumbnailUrl,
  torVerifiedAt,
  torVerifiedBy,
}: RfpTorTrustProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "verify" | "thumb">(null);
  const [err, setErr] = useState<string | null>(null);

  const hasTarget = !!(docUrl || sourceUrl);

  async function post(path: string, label: "verify" | "thumb") {
    setErr(null);
    setBusy(label);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/${path}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {/* thumbnail — visual confirmation */}
      {thumbnailUrl ? (
        <a href={docUrl ?? sourceUrl ?? thumbnailUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt="TOR first page"
            className="w-full max-h-64 object-cover object-top rounded border bg-muted"
          />
        </a>
      ) : hasTarget ? (
        <div className="flex items-center justify-center h-24 rounded border border-dashed text-muted-foreground text-xs gap-1.5">
          <ImageIcon className="h-4 w-4" /> no thumbnail yet
        </div>
      ) : null}

      {/* verification state + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {torVerifiedAt ? (
          <Badge variant="outline" className="text-[10px] gap-1 bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3" /> TOR verified{torVerifiedBy ? ` · ${torVerifiedBy.split("@")[0]}` : ""}
          </Badge>
        ) : docUrl ? (
          <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3" /> TOR not verified
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="h-3 w-3" /> no TOR document
          </Badge>
        )}

        {docUrl && !torVerifiedAt && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={busy !== null || isPending}
            onClick={() => post("verify-tor", "verify")}
          >
            {busy === "verify" ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓ this is the correct TOR"}
          </Button>
        )}

        {hasTarget && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] px-2 gap-1"
            disabled={busy !== null || isPending}
            onClick={() => post("thumbnail", "thumb")}
            title="screenshot the TOR / source to confirm what it is"
          >
            {busy === "thumb" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {thumbnailUrl ? "refresh" : "generate"} thumbnail
          </Button>
        )}
      </div>

      {err && <p className="text-[11px] text-destructive">{err}</p>}
    </div>
  );
}
