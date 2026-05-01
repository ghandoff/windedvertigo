"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ContactEnrichPhotoButtonProps {
  contactId: string;
  hasEmail: boolean;
  hasLinkedin: boolean;
  hasPhoto: boolean;
}

interface EnrichResponse {
  ok: boolean;
  photoUrl: string | null;
  photoSource: "proxycurl" | "gravatar" | null;
  email: string | null;
  emailSource: "proxycurl" | "hunter" | null;
  emailConfidence: number | null;
  emailUpdated: boolean;
  hasProxycurl: boolean;
  hasHunter: boolean;
  error?: string;
  note?: string;
}

function buildResultNote(data: EnrichResponse, hadEmailBefore: boolean): string {
  const parts: string[] = [];

  if (data.photoUrl) {
    parts.push(`photo via ${data.photoSource}`);
  } else {
    if (!data.hasProxycurl) {
      parts.push("add PROXYCURL_API_KEY for LinkedIn photos");
    } else {
      parts.push("no photo found");
    }
  }

  if (data.emailUpdated && data.email) {
    parts.push(`email via ${data.emailSource}${data.emailConfidence ? ` (${data.emailConfidence}% confidence)` : ""}`);
  } else if (!data.email) {
    if (!hadEmailBefore) {
      if (!data.hasProxycurl && !data.hasHunter) {
        parts.push("add PROXYCURL_API_KEY or HUNTER_API_KEY to find emails");
      } else {
        parts.push("email not found");
      }
    }
  }

  return parts.join(" · ");
}

export function ContactEnrichPhotoButton({
  contactId,
  hasEmail,
  hasLinkedin,
  hasPhoto,
}: ContactEnrichPhotoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; note: string } | null>(null);

  async function handleClick(forceEmail = false) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceEmail }),
      });
      const data: EnrichResponse = await res.json();

      const updated = data.photoUrl || data.emailUpdated;
      const note = data.error ?? buildResultNote(data, hasEmail);

      setResult({ ok: !!updated, note });
      if (updated) router.refresh();
    } catch {
      setResult({ ok: false, note: "error — check network" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleClick(false)}
          disabled={loading}
          title={
            hasLinkedin
              ? "Fetch photo + email from LinkedIn (requires PROXYCURL_API_KEY) or Gravatar / Hunter.io"
              : "Fetch email via Hunter.io (requires HUNTER_API_KEY) or Gravatar photo"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
          {loading ? "enriching…" : hasPhoto ? "re-enrich" : "enrich contact"}
        </button>

        {/* If contact already has an email, offer a "find new email" override */}
        {hasEmail && !loading && (
          <button
            onClick={() => handleClick(true)}
            disabled={loading}
            title="Find a new/updated email address even if one already exists (useful when contact changed orgs)"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            find new email
          </button>
        )}
      </div>

      {result && (
        <p className={`text-[10px] leading-snug max-w-[280px] flex items-start gap-1 ${result.ok ? "text-green-700" : "text-muted-foreground"}`}>
          {result.ok
            ? <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
            : <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />}
          {result.note}
        </p>
      )}
    </div>
  );
}
