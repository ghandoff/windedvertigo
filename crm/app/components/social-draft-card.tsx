"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SocialDraft } from "@/lib/notion/types";

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700 border-blue-200",
  twitter: "bg-gray-100 text-gray-700 border-gray-200",
  bluesky: "bg-sky-100 text-sky-700 border-sky-200",
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  facebook: "bg-indigo-100 text-indigo-700 border-indigo-200",
  substack: "bg-orange-100 text-orange-700 border-orange-200",
};

const CHAR_LIMITS: Record<string, number> = {
  bluesky: 300,
  linkedin: 3000,
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  substack: Infinity,
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

/** Strip HTML for character counting. */
function plainTextLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&\w+;/g, " ")
    .trim()
    .length;
}

interface SocialDraftCardProps {
  draft: SocialDraft;
}

export function SocialDraftCard({ draft }: SocialDraftCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");

  const charLimit = CHAR_LIMITS[draft.platform] ?? Infinity;
  const charCount = plainTextLength(draft.content);
  const overLimit = charCount > charLimit;
  const isPosted = draft.status === "posted";

  async function handlePublish() {
    if (!draft.platform || overLimit) return;
    setPublishing(true);
    setError("");

    try {
      const res = await fetch("/crm/api/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: draft.platform,
          text: draft.content,
          imageUrls: draft.mediaUrls ? draft.mediaUrls.split(",").map((u) => u.trim()).filter(Boolean) : [],
          draftId: draft.id,
          // Substack-specific
          ...(draft.platform === "substack" ? {
            title: draft.content.split("\n")[0]?.slice(0, 100) || "untitled",
          } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPublishedUrl(data.url || "");
        startTransition(() => router.refresh());
      } else {
        setError(data.error || `failed (${res.status})`);
      }
    } catch {
      setError("network error");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("delete this draft?")) return;
    setDeleting(true);
    try {
      await fetch(`/crm/api/social/drafts/${draft.id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } catch {
      setError("delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className={`transition-shadow ${isPosted ? "opacity-75" : "hover:shadow-md"}`}>
      <CardContent className="p-3 space-y-2">
        {/* Content preview */}
        <p className="text-sm leading-snug line-clamp-4">{draft.content.replace(/<[^>]+>/g, "")}</p>

        {/* Platform + meta row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {draft.platform && (
            <Badge
              variant="outline"
              className={`text-[10px] ${PLATFORM_COLORS[draft.platform] ?? ""}`}
            >
              {draft.platform}
            </Badge>
          )}
          {draft.scheduledFor?.start && (
            <span className="text-[10px] text-muted-foreground">
              {formatDate(draft.scheduledFor.start)}
            </span>
          )}
          {charLimit < Infinity && (
            <span className={`text-[10px] ml-auto ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {charCount}/{charLimit}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}

        {/* Published URL */}
        {publishedUrl && (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            view post
          </a>
        )}

        {/* Actions */}
        {!isPosted && (
          <div className="flex items-center gap-1.5 pt-1 border-t">
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !draft.platform || overLimit}
              className="h-7 text-xs px-2.5 flex-1"
            >
              {publishing ? (
                "posting..."
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" />
                  publish to {draft.platform}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
