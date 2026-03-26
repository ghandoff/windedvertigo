"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const VARIABLES = ["{{orgName}}", "{{contactName}}", "{{senderName}}", "{{orgEmail}}", "{{orgWebsite}}"];

export function TemplateForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string | null>("outreach");
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/crm/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject,
          body,
          category: category ?? "other",
        }),
      });
      setName("");
      setSubject("");
      setBody("");
      setCategory("outreach");
      setOpen(false);
      startTransition(() => router.refresh());
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
          organizationId: "template", // signal this is a template generation
          additionalContext: `Generate a reusable ${category || "outreach"} email template for a learning design consultancy. Template name: "${name || "untitled"}". Use {{orgName}}, {{contactName}}, {{senderName}} variables where appropriate. Make it a template, not a specific email.`,
          tone: "professional",
          purpose: category === "follow-up" ? "follow-up" : "intro",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject);
        setBody(data.body);
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        new template
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px]">
        <SheetTitle>new email template</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., conference follow-up"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">category</Label>
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
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">subject</Label>
              <div className="flex gap-1">
                {VARIABLES.slice(0, 2).map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v, "subject")}
                    className="text-[9px] text-accent hover:underline"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="subject line with {{orgName}}"
              className="text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">body</Label>
              <div className="flex gap-1">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v, "body")}
                    className="text-[9px] text-accent hover:underline"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="email body with {{variables}}"
              mode="email"
              minHeight={200}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleAiGenerate}
              disabled={aiGenerating}
              className="flex-1"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {aiGenerating ? "generating..." : "AI generate"}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1">
              {saving ? "saving..." : "save template"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
