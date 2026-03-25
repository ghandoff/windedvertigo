"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VARIABLES = [
  { key: "{{orgName}}", label: "org name" },
  { key: "{{contactName}}", label: "contact" },
  { key: "{{senderName}}", label: "sender" },
  { key: "{{orgEmail}}", label: "org email" },
  { key: "{{orgWebsite}}", label: "website" },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string | null>("outreach");
  const [channel, setChannel] = useState<string | null>("email");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/crm/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject,
          body,
          category: category ?? "other",
          channel: channel ?? "email",
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "save failed" }));
        setError(data.error || `failed (${res.status})`);
        return;
      }
      startTransition(() => router.push("/campaigns/templates"));
    } catch {
      setError("network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleAiGenerate() {
    if (!name.trim() && !category) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/crm/api/ai/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: "template",
          additionalContext: `generate a reusable ${category || "outreach"} ${channel || "email"} template for a learning design consultancy. template name: "${name || "untitled"}". use {{orgName}}, {{contactName}}, {{senderName}} variables where appropriate. make it a template, not a specific email.`,
          tone: "professional",
          purpose: category === "follow-up" ? "follow-up" : "intro",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
      }
    } catch {} finally {
      setAiGenerating(false);
    }
  }

  function insertVariable(v: string, field: "subject" | "body") {
    if (field === "subject") setSubject((prev) => prev + v);
    else setBody((prev) => prev + v);
  }

  return (
    <>
      <Link
        href="/campaigns/templates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to templates
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">new template</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1.5 block">template name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., conference intro follow-up"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">category</Label>
                <Select value={category ?? "outreach"} onValueChange={setCategory}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outreach">outreach</SelectItem>
                    <SelectItem value="follow-up">follow-up</SelectItem>
                    <SelectItem value="event invite">event invite</SelectItem>
                    <SelectItem value="newsletter">newsletter</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">channel</Label>
                <Select value={channel ?? "email"} onValueChange={setChannel}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">email</SelectItem>
                    <SelectItem value="linkedin">linkedin</SelectItem>
                    <SelectItem value="twitter">twitter</SelectItem>
                    <SelectItem value="bluesky">bluesky</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">subject</Label>
              <div className="flex gap-1.5">
                {VARIABLES.slice(0, 3).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key, "subject")}
                    className="text-[9px] text-accent hover:underline"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="subject line with {{orgName}}"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">body</Label>
              <div className="flex gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key, "body")}
                    className="text-[9px] text-accent hover:underline"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="email body with {{variables}}"
              rows={14}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">notes (internal — not sent)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., use 5-7 days after initial outreach"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              <Bookmark className="h-4 w-4 mr-1.5" />
              {saving ? "saving..." : "save template"}
            </Button>
            <Button
              variant="outline"
              onClick={handleAiGenerate}
              disabled={aiGenerating || (!name.trim() && !category)}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {aiGenerating ? "generating..." : "AI generate"}
            </Button>
          </div>
        </div>

        {/* Preview sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {category && (
                  <Badge variant="outline" className="text-[10px]">{category}</Badge>
                )}
                {channel && (
                  <Badge variant="secondary" className="text-[10px]">{channel}</Badge>
                )}
              </div>
              {subject && (
                <div>
                  <span className="text-[10px] text-muted-foreground">subject</span>
                  <p className="font-medium text-xs">{subject}</p>
                </div>
              )}
              {body ? (
                <div>
                  <span className="text-[10px] text-muted-foreground">body</span>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{body}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  start typing to see a preview
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
