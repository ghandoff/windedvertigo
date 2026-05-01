"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Search, Building2, CheckCircle2, AlertCircle, Sparkles, X, UserPlus,
} from "lucide-react";
import { TemplatePickerDialog } from "./template-picker-dialog";
import { EmailPreviewModal } from "./email-preview-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SaveAsTemplate } from "./save-as-template";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Organization, Contact } from "@/lib/notion/types";

interface Recipient {
  email: string;
  name: string;
  contactId?: string;
}

interface EmailComposerProps {
  preselectedOrgId?: string;
}

export function EmailComposer({ preselectedOrgId }: EmailComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Org search + selection
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showOrgResults, setShowOrgResults] = useState(false);

  // Contact / recipient state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [showContactResults, setShowContactResults] = useState(false);
  const [loadingOrgContacts, setLoadingOrgContacts] = useState(false);

  // Email fields
  const [subject, setSubject] = useState("From winded.vertigo");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");

  // AI draft state
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiCost, setAiCost] = useState<number | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiTone, setAiTone] = useState<string>("warm");
  const [aiPurpose, setAiPurpose] = useState<string>("intro");

  // Ref to focus org search from the sidebar empty-state card
  const orgSearchRef = useRef<HTMLInputElement>(null);

  // Send state
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendMessage, setSendMessage] = useState("");

  // Load preselected org
  useEffect(() => {
    if (preselectedOrgId) {
      fetch(`/api/organizations/${preselectedOrgId}`)
        .then((res) => res.json())
        .then((org) => { if (org.id) selectOrg(org); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedOrgId]);

  // Search orgs
  useEffect(() => {
    if (orgSearch.length < 2) { setOrgResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/organizations?search=${encodeURIComponent(orgSearch)}`)
        .then((r) => r.json())
        .then((d) => setOrgResults(d.data ?? []))
        .catch(() => setOrgResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [orgSearch]);

  // Search contacts
  useEffect(() => {
    if (contactSearch.length < 2) { setContactResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/contacts?search=${encodeURIComponent(contactSearch)}`)
        .then((r) => r.json())
        .then((d) => setContactResults((d.data ?? []).filter((c: Contact) => c.email)))
        .catch(() => setContactResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  async function selectOrg(org: Organization) {
    setSelectedOrg(org);
    setSubject(org.subject || "From winded.vertigo");
    // Do NOT auto-fill body — user composes their own email.
    // Bespoke copy is available via the {{bespokeEmailCopy}} merge tag.
    setOrgSearch("");
    setShowOrgResults(false);

    // Auto-load contacts linked to this org
    if (org.contactIds?.length) {
      setLoadingOrgContacts(true);
      try {
        const fetched = await Promise.all(
          org.contactIds.map((cid) =>
            fetch(`/api/contacts/${cid}`).then((r) => r.json()).catch(() => null)
          )
        );
        const withEmail: Recipient[] = fetched
          .filter((c) => c?.id && c.email)
          .map((c) => ({ email: c.email, name: c.name, contactId: c.id }));
        // Merge: keep any manually-added recipients, add org contacts that aren't already there
        setRecipients((prev) => {
          const existing = new Set(prev.map((r) => r.email));
          return [...prev, ...withEmail.filter((r) => !existing.has(r.email))];
        });
      } catch {
        // non-critical
      } finally {
        setLoadingOrgContacts(false);
      }
    }
  }

  function addContact(contact: Contact) {
    if (!contact.email) return;
    setRecipients((prev) => {
      if (prev.some((r) => r.email === contact.email)) return prev;
      return [...prev, { email: contact.email, name: contact.name, contactId: contact.id }];
    });
    setContactSearch("");
    setContactResults([]);
    setShowContactResults(false);
  }

  const removeRecipient = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }, []);

  async function handleAiDraft() {
    if (!selectedOrg) return;
    if (body.trim() && body !== selectedOrg.bespokeEmailCopy) {
      if (!window.confirm("This will replace your current email body. Continue?")) return;
    }
    setAiDrafting(true);
    setAiCost(null);
    setAiError("");
    try {
      const res = await fetch("/api/ai/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          tone: aiTone,
          purpose: aiPurpose,
          senderName: senderName || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject);
        setBody(data.body);
        setAiCost(data.usage.costUsd);
      } else {
        const data = await res.json().catch(() => ({ error: "AI draft failed" }));
        setAiError(data.error || `Failed (${res.status})`);
      }
    } catch {
      setAiError("Network error — try again");
    } finally {
      setAiDrafting(false);
    }
  }

  async function handleSend() {
    const toList = recipients.map((r) => r.email).filter(Boolean);
    if (!body || toList.length === 0) return;
    setSendStatus("sending");
    setSendMessage("");

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrg?.id,
          to: toList,
          subject,
          body,
          senderName: senderName || undefined,
          // Pass primary recipient's name for {{firstName}} / {{contactName}} resolution
          contactName: recipients[0]?.name || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendStatus("sent");
        setSendMessage(`sent to ${toList.length} recipient${toList.length !== 1 ? "s" : ""}`);
        startTransition(() => router.refresh());
      } else {
        setSendStatus("error");
        setSendMessage(data.error || "Send failed");
      }
    } catch {
      setSendStatus("error");
      setSendMessage("Network error");
    }
  }

  const toList = recipients.map((r) => r.email).filter(Boolean);
  const canSend = toList.length > 0 && !!body && sendStatus !== "sending";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main — compose area */}
      <div className="lg:col-span-2 space-y-4">

        {/* Org selector (optional — for merge tags + auto-load contacts) */}
        <div className="relative">
          <Label className="mb-1.5 block">
            organization
            <span className="text-muted-foreground font-normal ml-2 text-xs">
              (optional — sets merge tags and loads linked contacts)
            </span>
          </Label>
          {selectedOrg ? (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm">{selectedOrg.organization}</span>
              {loadingOrgContacts && (
                <span className="text-xs text-muted-foreground ml-1">loading contacts…</span>
              )}
              <button
                onClick={() => { setSelectedOrg(null); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={orgSearchRef}
                placeholder="search organizations..."
                value={orgSearch}
                onChange={(e) => { setOrgSearch(e.target.value); setShowOrgResults(true); }}
                onFocus={() => setShowOrgResults(true)}
                className="pl-8"
              />
              {showOrgResults && orgResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {orgResults.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => selectOrg(org)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span className="font-medium">{org.organization}</span>
                      {org.priority && (
                        <Badge variant="outline" className="text-[10px] ml-2">
                          {org.priority.replace(/ – .+/, "")}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recipients */}
        <div>
          <Label className="mb-1.5 block">
            recipients
            {recipients.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2 text-xs">
                {recipients.length} selected
              </span>
            )}
          </Label>

          {/* Recipient list */}
          {recipients.length > 0 && (
            <div className="mb-2 border rounded-md divide-y bg-muted/10">
              {recipients.map((r) => (
                <div key={r.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs truncate">{r.email}</span>
                  </div>
                  <button
                    onClick={() => removeRecipient(r.email)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="remove recipient"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Contact search to add more */}
          <div className="relative">
            <UserPlus className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="search contacts to add..."
              value={contactSearch}
              onChange={(e) => { setContactSearch(e.target.value); setShowContactResults(true); }}
              onFocus={() => setShowContactResults(true)}
              onBlur={() => setTimeout(() => setShowContactResults(false), 150)}
              className="pl-8"
            />
            {showContactResults && contactResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {contactResults.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => addContact(c)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        <div>
          <Label className="mb-1.5 block">subject</Label>
          <Input
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Sender name */}
        <div>
          <Label className="mb-1.5 block">sender name (optional)</Label>
          <Input
            placeholder="e.g. Garrett"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
          />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>body</Label>
            <div className="flex items-center gap-2">
              <TemplatePickerDialog
                orgName={selectedOrg?.organization}
                contactName={recipients[0]?.name}
                onSelect={(s, b) => { setSubject(s); setBody(b); }}
              />
              {aiError && <span className="text-xs text-destructive">{aiError}</span>}
              {aiCost !== null && (
                <span className="text-xs text-muted-foreground">AI cost: ${aiCost.toFixed(4)}</span>
              )}
              <Select value={aiTone} onValueChange={(v) => v && setAiTone(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm" className="text-xs">warm</SelectItem>
                  <SelectItem value="professional" className="text-xs">professional</SelectItem>
                  <SelectItem value="casual" className="text-xs">casual</SelectItem>
                  <SelectItem value="formal" className="text-xs">formal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={aiPurpose} onValueChange={(v) => v && setAiPurpose(v)}>
                <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro" className="text-xs">intro</SelectItem>
                  <SelectItem value="follow-up" className="text-xs">follow-up</SelectItem>
                  <SelectItem value="proposal" className="text-xs">proposal</SelectItem>
                  <SelectItem value="check-in" className="text-xs">check-in</SelectItem>
                  <SelectItem value="event-invite" className="text-xs">event invite</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiDraft}
                disabled={!selectedOrg || aiDrafting}
              >
                {aiDrafting ? "drafting..." : <><Sparkles className="h-3.5 w-3.5 mr-1" />AI draft</>}
              </Button>
            </div>
          </div>
          <RichTextEditor
            content={body}
            onChange={setBody}
            placeholder="start writing your email..."
            mode="email"
            minHeight={250}
          />
        </div>

        {/* Send button + preview + save as template */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSend} disabled={!canSend} size="lg">
            {sendStatus === "sending" ? (
              "sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-1.5" />
                send to {toList.length} recipient{toList.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
          {body && <EmailPreviewModal subject={subject} body={body} />}
          {body && <SaveAsTemplate subject={subject} body={body} channel="email" />}
          {sendStatus === "sent" && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {sendMessage}
            </span>
          )}
          {sendStatus === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {sendMessage}
            </span>
          )}
        </div>
      </div>

      {/* Sidebar — org context */}
      <div className="space-y-4">
        {selectedOrg ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selectedOrg.organization}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">{selectedOrg.relationship}</Badge>
                <Badge variant="outline" className="text-[10px]">{selectedOrg.derivedPriority}</Badge>
              </div>
              {selectedOrg.outreachSuggestion && (
                <div>
                  <span className="text-muted-foreground">outreach suggestion</span>
                  <p className="font-medium">{selectedOrg.outreachSuggestion}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => { orgSearchRef.current?.focus(); orgSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
          >
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">click to select an organization — loads contacts and sets merge tags</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
