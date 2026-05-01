"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Search, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { resolveTemplateVars } from "@/lib/campaign/template-vars";
import type { EmailTemplate } from "@/lib/notion/types";

// ── category badge colours (matches templates page) ──────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  outreach: "bg-blue-100 text-blue-700 border-blue-200",
  "follow-up": "bg-green-100 text-green-700 border-green-200",
  "event invite": "bg-purple-100 text-purple-700 border-purple-200",
  newsletter: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

// ── props ─────────────────────────────────────────────────────────────────────

export interface TemplatePickerDialogProps {
  orgName?: string;
  contactName?: string;
  onSelect: (subject: string, body: string) => void;
}

// ── component ─────────────────────────────────────────────────────────────────

export function TemplatePickerDialog({
  orgName,
  contactName,
  onSelect,
}: TemplatePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<string | null>(null);

  // Fetch email templates when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError("");
    fetch("/api/email-templates?channel=email")
      .then((r) => r.json())
      .then((d) => setTemplates(d.data ?? []))
      .catch(() => setFetchError("couldn't load templates — try again"))
      .finally(() => setLoading(false));
  }, [open]);

  // Client-side filter by name or category
  const filtered = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.category ?? "").toLowerCase().includes(q) ||
      (t.subject ?? "").toLowerCase().includes(q)
    );
  });

  const handleSelect = useCallback(
    async (template: EmailTemplate) => {
      setApplying(template.id);
      try {
        const vars = {
          orgName: orgName ?? "the organization",
          contactName: contactName ?? "there",
          senderName: "Garrett",
        };
        const resolvedSubject = resolveTemplateVars(template.subject ?? "", vars);
        const resolvedBody = resolveTemplateVars(template.body ?? "", vars);

        onSelect(resolvedSubject, resolvedBody);

        // Increment timesUsed counter — fire and forget
        fetch(`/api/email-templates/${template.id}/use`, { method: "POST" }).catch(() => {});

        setOpen(false);
        setSearch("");
      } finally {
        setApplying(null);
      }
    },
    [orgName, contactName, onSelect],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <DialogTrigger
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        title="load from template library"
      >
        <Bookmark className="h-3.5 w-3.5" />
        templates
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <div className="p-4 pb-3 border-b">
          <DialogHeader>
            <DialogTitle>template library</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">
            select a template to fill in the subject and body — merge tags will be resolved
          </p>
          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Template list */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading && (
            <p className="text-center text-sm text-muted-foreground py-8">loading templates…</p>
          )}
          {fetchError && (
            <p className="text-center text-sm text-destructive py-8">{fetchError}</p>
          )}
          {!loading && !fetchError && filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Mail className="h-6 w-6 mx-auto mb-2 opacity-30" />
              {search ? "no templates match that search" : "no email templates yet"}
            </div>
          )}
          {!loading && !fetchError && filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              disabled={applying === t.id}
              className="w-full text-left rounded-lg border border-transparent hover:border-border hover:bg-muted/50 px-3 py-2.5 mb-1 transition-all disabled:opacity-50 group"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-snug">{t.name}</span>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {t.category && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CATEGORY_COLORS[t.category] ?? ""}`}
                    >
                      {t.category}
                    </Badge>
                  )}
                  {(t.timesUsed ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                      {t.timesUsed}x
                    </Badge>
                  )}
                </div>
              </div>
              {t.subject && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  <span className="opacity-60">subject:</span> {t.subject}
                </p>
              )}
              {t.body && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{t.body}</p>
              )}
              {applying === t.id && (
                <p className="text-xs text-accent mt-1">applying…</p>
              )}
            </button>
          ))}
        </div>

        {/* Footer count */}
        {!loading && !fetchError && templates.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
