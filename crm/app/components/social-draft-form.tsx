"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "./rich-text-editor";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export function SocialDraftForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<string | null>("linkedin");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/social/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          platform: platform ?? "linkedin",
          status: "draft",
        }),
      });
      setContent("");
      setPlatform("linkedin");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        new draft
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetTitle>new social draft</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">platform</Label>
            <Select value={platform ?? "linkedin"} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="twitter">Twitter / X</SelectItem>
                <SelectItem value="bluesky">Bluesky</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="substack">Substack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">
              Content
              <span className="text-muted-foreground font-normal ml-2">
                {content.length} chars
              </span>
            </Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="write your post..."
              mode="social"
              minHeight={150}
            />
          </div>
          <Button onClick={handleSave} disabled={!content.trim() || saving} className="w-full">
            {saving ? "Saving..." : "save draft"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
