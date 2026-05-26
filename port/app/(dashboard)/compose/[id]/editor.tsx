"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2, Send, CheckCircle2, AlertTriangle, ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import {
  CHANNEL_CHAR_LIMITS,
  CHANNEL_LABELS,
  type ComposeDraft,
} from "@/lib/supabase/compose-drafts";

export interface ComposeEditorProps {
  initial: ComposeDraft;
}

export function ComposeEditor({ initial }: ComposeEditorProps) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [contentText, setContentText] = useState(initial.contentText);
  const [savedAt, setSavedAt] = useState<Date | null>(new Date(initial.updatedAt));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [publishState, setPublishState] = useState<
    | { kind: "idle" }
    | { kind: "publishing" }
    | { kind: "published"; url?: string }
    | { kind: "failed"; message: string }
  >(
    initial.status === "published"
      ? { kind: "published" }
      : initial.status === "failed" && initial.lastError
        ? { kind: "failed", message: initial.lastError }
        : { kind: "idle" },
  );
  const router = useRouter();

  // Auto-save on a debounce — 2 seconds after the last edit. Cheap UX win:
  // drafts persist as you type without a save button click.
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    // Skip the very first render (no edits yet).
    if (
      title === (initial.title ?? "") &&
      contentText === initial.contentText
    ) {
      return;
    }
    debounceTimer.current = setTimeout(() => {
      save({ silent: true });
    }, 2000);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [title, contentText]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (opts: { silent?: boolean } = {}) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/compose/drafts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          contentText,
        }),
      });
      if (res.ok) {
        setSavedAt(new Date());
      } else {
        if (!opts.silent) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `HTTP ${res.status}`);
        }
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("delete this draft? this can't be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/compose/drafts/${initial.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/compose");
      } else {
        setError(`delete failed: HTTP ${res.status}`);
      }
    });
  };

  const handlePublish = () => {
    // Save current edits first to avoid publishing stale content
    if (!confirm(`publish to ${CHANNEL_LABELS[initial.channel]}? this will post live and can't be undone here.`)) return;
    setPublishState({ kind: "publishing" });
    startTransition(async () => {
      // Save first
      await fetch(`/api/compose/drafts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || null, contentText }),
      });
      // Then publish
      const res = await fetch(`/api/compose/drafts/${initial.id}/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok) {
        setPublishState({ kind: "published", url: (data as { result?: { url?: string } }).result?.url });
        router.refresh();
      } else {
        setPublishState({
          kind: "failed",
          message:
            ((data as { message?: string }).message) ??
            ((data as { error?: string }).error) ??
            `HTTP ${res.status}`,
        });
      }
    });
  };

  const limit = CHANNEL_CHAR_LIMITS[initial.channel];
  const overLimit = limit !== null && contentText.length > limit;
  const usesTitle = initial.channel === "email" || initial.channel === "substack";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Editor column (2/3) */}
      <div className="lg:col-span-2 space-y-4">
        {usesTitle && (
          <Card>
            <CardContent className="py-3">
              <Label htmlFor="title" className="text-[10px]">
                {initial.channel === "email" ? "subject" : "title"}
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">content</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={18}
              placeholder={`write your ${CHANNEL_LABELS[initial.channel]} post here…`}
              className="w-full text-sm p-3 rounded border border-border bg-background"
            />
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              {limit !== null ? (
                <span className={overLimit ? "text-[#b15043]" : ""}>
                  {contentText.length} / {limit} chars
                  {overLimit && " — over limit"}
                </span>
              ) : (
                <span>{contentText.length} chars · no platform limit</span>
              )}
              <span>
                {savedAt
                  ? `saved ${formatRelative(savedAt)}`
                  : "not yet saved"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar (1/3) */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">channel</CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs">
            <p className="flex items-center gap-2">
              {initial.channel === "linkedin" && <Send className="h-3.5 w-3.5 text-[#5872cb]" />}
              <span className="text-[#273248]">{CHANNEL_LABELS[initial.channel]}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              channel can&apos;t change after creation. delete + recreate to switch.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => save()}
              disabled={isPending}
              variant="outline"
              className="w-full"
            >
              {isPending && publishState.kind !== "publishing" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              save now
            </Button>

            {/* Publish — LinkedIn / Bluesky / Substack live. Others show a hint */}
            {(initial.channel === "linkedin" ||
              initial.channel === "bluesky" ||
              initial.channel === "substack") &&
            publishState.kind !== "published" ? (
              <Button
                onClick={handlePublish}
                disabled={isPending || overLimit || !contentText.trim()}
                className="w-full"
              >
                {publishState.kind === "publishing" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {initial.channel === "substack"
                  ? "send to Substack as draft"
                  : `publish to ${CHANNEL_LABELS[initial.channel]}`}
              </Button>
            ) : null}

            {publishState.kind === "published" && (
              <div className="rounded border border-[#43b187]/40 bg-[#43b187]/5 p-2 text-xs">
                <p className="text-[#43b187] inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  published
                </p>
                {publishState.url && (
                  <a
                    href={publishState.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#5872cb] hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    view on LinkedIn
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {publishState.kind === "failed" && (
              <div className="rounded border border-[#b15043]/40 bg-[#b15043]/5 p-2 text-xs">
                <p className="text-[#b15043] inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  publish failed
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 break-words">
                  {publishState.message}
                </p>
              </div>
            )}

            <Button
              onClick={handleDelete}
              disabled={isPending}
              variant="ghost"
              className="w-full text-[#b15043] hover:bg-[#b15043]/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              delete
            </Button>
            {error && <p className="text-[11px] text-[#b15043]">{error}</p>}
          </CardContent>
        </Card>

        {initial.channel !== "linkedin" &&
          initial.channel !== "bluesky" &&
          initial.channel !== "substack" && (
            <Card className="bg-muted/20">
              <CardContent className="py-3 text-[11px] text-muted-foreground space-y-1">
                <p><strong className="text-[#273248]">Publishing</strong> for {CHANNEL_LABELS[initial.channel]} ships in a follow-up. LinkedIn, Bluesky, and Substack are live today.</p>
                <p>For now: drafts persist + are visible to the team.</p>
              </CardContent>
            </Card>
          )}

        <AiAssistPanel
          channel={initial.channel}
          currentText={contentText}
          onApply={(text) => {
            setContentText(text);
            // Trigger an immediate save since the user explicitly accepted.
            setTimeout(() => save({ silent: true }), 0);
          }}
        />
      </div>
    </div>
  );
}

/**
 * AI-assist panel — calls /api/compose/draft-with-ai with a free-form prompt
 * + the current draft text (for revise-flow). On result, shows the drafted
 * text in a preview the user can apply (replace content) or discard.
 */
function AiAssistPanel({
  channel,
  currentText,
  onApply,
}: {
  channel: ComposeEditorProps["initial"]["channel"];
  currentText: string;
  onApply: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ charCount: number; overLimit: boolean; costUsd?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = () => {
    if (!prompt.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/compose/draft-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, prompt, currentText }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok) {
        const d = data as { text?: string; charCount?: number; overLimit?: boolean; usage?: { costUsd?: number } };
        setDraft(d.text ?? "");
        setMeta({
          charCount: d.charCount ?? 0,
          overLimit: !!d.overLimit,
          costUsd: d.usage?.costUsd,
        });
      } else {
        const msg = (data as { message?: string; error?: string }).message
          ?? (data as { error?: string }).error
          ?? `HTTP ${res.status}`;
        setError(msg);
      }
    });
  };

  return (
    <Card className="border-[#43b187]/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#43b187]" />
          AI assist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            currentText.trim()
              ? "e.g., revise to lead with the PEDAL milestone, more specifics"
              : "e.g., post announcing the May whirlpool — invite school leaders"
          }
          rows={3}
          className="w-full text-xs p-2 rounded border border-border bg-background"
        />
        <Button
          onClick={run}
          disabled={isPending || !prompt.trim()}
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1.5" />
          )}
          {currentText.trim() ? "revise with AI" : "draft with AI"}
        </Button>
        {error && <p className="text-[11px] text-[#b15043]">{error}</p>}

        {draft !== null && (
          <div className="space-y-2 pt-2 border-t border-border/30">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>draft preview</span>
              <span className="tabular-nums">
                {meta?.charCount}{" "}
                {meta?.overLimit && <span className="text-[#b15043]">· over limit</span>}
                {meta?.costUsd !== undefined && (
                  <span className="ml-1 opacity-70">· ${meta.costUsd.toFixed(4)}</span>
                )}
              </span>
            </div>
            <div className="text-xs p-2 rounded border border-border bg-muted/20 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {draft}
            </div>
            <div className="flex gap-1.5">
              <Button
                onClick={() => {
                  onApply(draft);
                  setDraft(null);
                  setPrompt("");
                }}
                size="sm"
                variant="default"
                className="flex-1 h-7 text-[11px]"
              >
                use this
              </Button>
              <Button
                onClick={run}
                disabled={isPending}
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-[11px]"
                title="run again with same prompt"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                regenerate
              </Button>
              <Button
                onClick={() => setDraft(null)}
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-muted-foreground"
              >
                discard
              </Button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground pt-1">
          uses brand voice from <code className="text-[10px]">readStrategyDoc</code>. drafts cost ~$0.01-0.03 per attempt.
        </p>
      </CardContent>
    </Card>
  );
}

function formatRelative(date: Date): string {
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
