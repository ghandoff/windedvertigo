"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentChannel, ContentStatus } from "@/lib/notion/content";

const CHANNELS: { value: ContentChannel; label: string }[] = [
  { value: "linkedin", label: "linkedin" },
  { value: "bluesky", label: "bluesky" },
  { value: "twitter", label: "twitter/x" },
  { value: "newsletter", label: "newsletter" },
  { value: "blog", label: "blog" },
  { value: "website", label: "website" },
];

const AUTHORS = ["garrett", "payton", "lamis", "collective"];

const CHAR_LIMITS: Partial<Record<ContentChannel, number>> = {
  linkedin: 3000,
  bluesky: 300,
  twitter: 280,
};

interface ContentFormProps {
  onSaved: () => void;
  dbMissing?: boolean;
}

export function ContentForm({ onSaved, dbMissing }: ContentFormProps) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<ContentChannel>("linkedin");
  const [body, setBody] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [author, setAuthor] = useState("garrett");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = CHAR_LIMITS[channel];
  const overLimit = limit !== undefined && body.length > limit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), channel, body: body.trim() || undefined,
          scheduledDate: scheduledDate || undefined, status, author }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "save failed");
        return;
      }
      setTitle(""); setBody(""); setScheduledDate("");
      onSaved();
    } catch {
      setError("network error — try again");
    } finally {
      setSaving(false);
    }
  }

  if (dbMissing) {
    return (
      <div className="rounded-lg border border-amber-200/30 bg-amber-50/5 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-amber-400 mb-1">content calendar not configured</p>
        <p>ask cowork to create the notion content calendar DB and set <code className="text-xs bg-muted px-1 rounded">NOTION_CONTENT_CALENDAR_DB_ID</code> on the port vercel project.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* brand voice reminder */}
      <div className="rounded-md bg-sidebar/40 border border-sidebar-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/70">voice: </span>
        lowercase · british spelling · playful · human · dynamic · no exclamation marks
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">title / hook</Label>
          <Input id="title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="what's the angle?" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>channel</Label>
            <Select value={channel} onValueChange={v => { if (v) setChannel(v as ContentChannel); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>status</Label>
            <Select value={status} onValueChange={v => { if (v) setStatus(v as ContentStatus); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["idea","draft","review","approved","scheduled"] as ContentStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">body</Label>
          {limit && (
            <span className={`text-xs tabular-nums ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {body.length} / {limit}
            </span>
          )}
        </div>
        <Textarea id="body" value={body} onChange={e => setBody(e.target.value)}
          placeholder="draft the content here…" rows={5}
          className={overLimit ? "border-destructive" : ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="scheduled-date">scheduled date</Label>
          <Input id="scheduled-date" type="date" value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>author</Label>
          <Select value={author} onValueChange={v => { if (v) setAuthor(v); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUTHORS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving || !title.trim() || overLimit}>
        {saving ? "saving…" : "save to notion"}
      </Button>
    </form>
  );
}
