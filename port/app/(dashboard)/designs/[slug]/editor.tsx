"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, Save, ExternalLink } from "lucide-react";
import type { DesignDoc } from "@/lib/supabase/design-docs";

export interface DesignEditorProps {
  initial: DesignDoc;
}

export function DesignEditor({ initial }: DesignEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [contentMarkdown, setContentMarkdown] = useState(initial.contentMarkdown);
  const [frontmatterJson, setFrontmatterJson] = useState(
    JSON.stringify(initial.frontmatter, null, 2),
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setStatus("idle");
    setErrorMessage(null);
    let frontmatter: Record<string, unknown> = {};
    try {
      frontmatter = JSON.parse(frontmatterJson || "{}");
    } catch {
      setStatus("error");
      setErrorMessage("frontmatter is not valid JSON");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug:            initial.slug,
          title,
          template:        initial.template,
          contentMarkdown,
          frontmatter,
        }),
      });
      if (res.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        const body = await res.json().catch(() => ({}));
        setErrorMessage(body.error ?? `HTTP ${res.status}`);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: editor (2/3) */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">title + frontmatter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-[10px]">title (shows in PDF cover)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="frontmatter" className="text-[10px]">
                frontmatter JSON (client / preparedBy / version / date / eyebrow)
              </Label>
              <textarea
                id="frontmatter"
                value={frontmatterJson}
                onChange={(e) => setFrontmatterJson(e.target.value)}
                rows={6}
                className="mt-1 w-full font-mono text-[11px] p-2 rounded border border-border bg-background"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">content (markdown)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              rows={28}
              className="w-full font-mono text-xs p-3 rounded border border-border bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              supports # ## ### · - lists · &gt; callouts · **bold** *italic* (rendered as plain text in v1).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Right: actions (1/3) */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="w-full"
              variant="outline"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              save
            </Button>
            <a
              href={`/api/designs/${initial.slug}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Button variant="default" className="w-full">
                <FileDown className="h-4 w-4 mr-2" />
                view PDF
                <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
              </Button>
            </a>
            <a
              href={`/api/designs/${initial.slug}/pdf?download=1`}
              className="block"
            >
              <Button variant="ghost" className="w-full text-xs">
                <FileDown className="h-3 w-3 mr-1" />
                download
              </Button>
            </a>

            {status === "saved" && (
              <p className="text-[11px] text-[#43b187] text-center">saved · refresh PDF to see changes</p>
            )}
            {status === "error" && (
              <p className="text-[11px] text-[#b15043]">error: {errorMessage}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248]">workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              this surface is for <span className="text-[#273248]">designed</span> outputs
              (proposals, reports). for human-collaborative free-form drafts,
              keep using Google Docs.
            </p>
            <p>
              AI assist: ask wv-claw or cowork to revise specific sections,
              paste the markdown back here, save, re-render. block-level
              edits don&apos;t clobber other sections.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
