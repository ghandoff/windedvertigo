"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

interface SaveAsTemplateProps {
  /** Pre-fill subject from current content */
  subject?: string;
  /** Pre-fill body from current content */
  body?: string;
  /** Pre-fill channel */
  channel?: string;
  /** Compact trigger (icon only) */
  compact?: boolean;
}

export function SaveAsTemplate({ subject: initialSubject, body: initialBody, channel: initialChannel, compact }: SaveAsTemplateProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>("outreach");
  const [channel, setChannel] = useState<string | null>(initialChannel ?? "email");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: initialSubject ?? "",
          body: initialBody ?? "",
          category: category ?? "other",
          channel: channel ?? "email",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "save failed" }));
        setError(data.error || `failed (${res.status})`);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setName("");
      }, 1200);
    } catch {
      setError("network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSaved(false); setError(""); } }}>
      <SheetTrigger
        className={compact
          ? "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-accent hover:bg-muted transition-colors"
          : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        }
        title="save as reusable template"
      >
        <Bookmark className="h-3.5 w-3.5" />
        {!compact && "save as template"}
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetTitle>save as template</SheetTitle>
        <p className="text-xs text-muted-foreground mt-1">
          save this content as a reusable template for future campaigns and emails
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs mb-1 block">template name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., conference intro follow-up"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">category</Label>
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
            <Label className="text-xs mb-1 block">channel</Label>
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
          <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1">
            {initialSubject && (
              <div>
                <span className="text-muted-foreground">subject:</span> {initialSubject}
              </div>
            )}
            {initialBody && (
              <p className="text-muted-foreground line-clamp-4">{initialBody}</p>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={!name.trim() || saving || saved} className="w-full">
            {saved ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                saved!
              </>
            ) : saving ? (
              "saving..."
            ) : (
              <>
                <Bookmark className="h-4 w-4 mr-1.5" />
                save template
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
