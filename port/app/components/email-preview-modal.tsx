"use client";

/**
 * EmailPreviewModal — renders a campaign step email with live variable substitution.
 *
 * Search for any org or contact in the port to see exactly what that
 * recipient will receive. Variables auto-populate from real data.
 * Falls back to manual entry if needed.
 */

import { useState, useEffect, useRef } from "react";
import { Eye, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveTemplateVars, type TemplateContext } from "@/lib/campaign/template-vars";

interface Props {
  subject: string;
  body: string;
}

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "org" | "contact";
}

const DEFAULTS: TemplateContext = {
  orgName: "ACME Learning",
  contactName: "Alex Chen",
  firstName: "Alex",
  senderName: "Garrett",
  bespokeEmailCopy: "your work on evidence-based learning design",
  outreachSuggestion: "",
  orgEmail: "",
  orgWebsite: "",
};

export function EmailPreviewModal({ subject, body }: Props) {
  const [ctx, setCtx] = useState<TemplateContext>(DEFAULTS);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search across orgs + contacts
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [orgsRes, contactsRes] = await Promise.all([
          fetch(`/api/organizations?search=${encodeURIComponent(search)}&pageSize=8`),
          fetch(`/api/contacts?search=${encodeURIComponent(search)}&pageSize=8`),
        ]);
        const [orgsData, contactsData] = await Promise.all([orgsRes.json(), contactsRes.json()]);

        const orgResults: SearchResult[] = (orgsData.data ?? []).map((o: { id: string; organization: string }) => ({
          id: o.id,
          label: o.organization,
          type: "org" as const,
        }));
        const contactResults: SearchResult[] = (contactsData.data ?? []).map((c: { id: string; name: string; organizationIds?: string[] }) => ({
          id: c.id,
          label: c.name,
          sublabel: "contact",
          type: "contact" as const,
        }));

        setResults([...contactResults, ...orgResults]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [search]);

  async function selectResult(r: SearchResult) {
    setSearch("");
    setResults([]);
    setSelectedLabel(r.label);

    if (r.type === "org") {
      const res = await fetch(`/api/organizations/${r.id}`);
      const org = await res.json();
      setCtx((prev) => ({
        ...prev,
        orgName: org.organization ?? prev.orgName,
        orgEmail: org.email ?? prev.orgEmail,
        orgWebsite: org.website ?? prev.orgWebsite,
        bespokeEmailCopy: org.bespokeEmailCopy ?? prev.bespokeEmailCopy,
        outreachSuggestion: org.outreachSuggestion ?? prev.outreachSuggestion,
        firstName: org.organization?.split(" ")[0] ?? prev.firstName,
      }));
    } else {
      const res = await fetch(`/api/contacts/${r.id}`);
      const contact = await res.json();
      const firstName = contact.name?.split(" ")[0] ?? "";
      setCtx((prev) => ({
        ...prev,
        contactName: contact.name ?? prev.contactName,
        firstName,
        orgEmail: contact.email ?? prev.orgEmail,
      }));
      // If contact has a linked org, load that too
      if (contact.organizationIds?.[0]) {
        const orgRes = await fetch(`/api/organizations/${contact.organizationIds[0]}`);
        const org = await orgRes.json();
        setCtx((prev) => ({
          ...prev,
          orgName: org.organization ?? prev.orgName,
          orgWebsite: org.website ?? prev.orgWebsite,
          bespokeEmailCopy: org.bespokeEmailCopy ?? prev.bespokeEmailCopy,
          outreachSuggestion: org.outreachSuggestion ?? prev.outreachSuggestion,
        }));
      }
    }
  }

  const set = (key: keyof TemplateContext) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCtx((prev) => {
      const next = { ...prev, [key]: val };
      // Keep firstName in sync when contactName changes manually
      if (key === "contactName") next.firstName = val.split(" ")[0] ?? "";
      return next;
    });
  };

  const resolvedSubject = resolveTemplateVars(subject, ctx);
  const resolvedBody = resolveTemplateVars(body, ctx);
  const isHtml = resolvedBody.trimStart().startsWith("<");

  return (
    <Dialog>
      <DialogTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors" title="Preview email with real recipient data">
        <Eye className="h-3 w-3" />
        preview as
      </DialogTrigger>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-[90vw] xl:max-w-7xl w-full h-[90vh] flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-5 pt-4 pb-3 border-b flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm">preview as</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* ── left panel: recipient picker + variable overrides ── */}
          <div className="w-64 flex-shrink-0 border-r flex flex-col overflow-hidden">
            {/* search */}
            <div className="p-3 border-b relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search org or contact…"
                  className="h-8 text-xs pl-8"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setResults([]); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* dropdown results */}
              {results.length > 0 && (
                <div className="absolute top-full left-3 right-3 z-50 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => selectResult(r)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-baseline justify-between gap-2"
                    >
                      <span className="truncate">{r.label}</span>
                      {r.sublabel && <span className="text-[10px] text-muted-foreground flex-shrink-0">{r.sublabel}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">searching…</p>
              )}
            </div>

            {/* selected label */}
            {selectedLabel && (
              <div className="px-3 py-2 border-b bg-green-50">
                <p className="text-[10px] text-green-700 font-medium truncate">▸ {selectedLabel}</p>
              </div>
            )}

            {/* variable overrides */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">variables</p>

              {(
                [
                  ["orgName", "orgName"],
                  ["contactName", "contactName"],
                  ["firstName", "firstName"],
                  ["senderName", "senderName"],
                ] as [keyof TemplateContext, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-[10px] text-muted-foreground">{`{{${label}}}`}</Label>
                  <Input value={(ctx[key] as string) ?? ""} onChange={set(key)} className="h-7 text-xs mt-0.5" />
                </div>
              ))}

              <div>
                <Label className="text-[10px] text-muted-foreground">{"{{bespokeEmailCopy}}"}</Label>
                <Textarea value={ctx.bespokeEmailCopy ?? ""} onChange={set("bespokeEmailCopy")} rows={3} className="text-xs mt-0.5" />
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground">{"{{outreachSuggestion}}"}</Label>
                <Textarea value={ctx.outreachSuggestion ?? ""} onChange={set("outreachSuggestion")} rows={2} className="text-xs mt-0.5" />
              </div>
            </div>
          </div>

          {/* ── right panel: rendered preview ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* subject bar */}
            <div className="flex-shrink-0 px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0">subject:</span>
              <span className="text-xs truncate">{resolvedSubject || <em className="text-muted-foreground">no subject</em>}</span>
            </div>

            {/* body */}
            <div className="flex-1 overflow-hidden bg-white">
              {isHtml ? (
                <iframe
                  srcDoc={resolvedBody}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  title="email preview"
                />
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <p className="text-sm whitespace-pre-wrap">{resolvedBody}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
