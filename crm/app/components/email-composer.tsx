"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Search, Building2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { SaveAsTemplate } from "./save-as-template";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Organization } from "@/lib/notion/types";

interface EmailComposerProps {
  preselectedOrgId?: string;
}

export function EmailComposer({ preselectedOrgId }: EmailComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Org search + selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Email fields
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("From winded.vertigo");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");

  // AI draft state
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiCost, setAiCost] = useState<number | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiTone, setAiTone] = useState<string>("warm");
  const [aiPurpose, setAiPurpose] = useState<string>("intro");

  // Send state
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendMessage, setSendMessage] = useState("");

  // Load preselected org
  useEffect(() => {
    if (preselectedOrgId) {
      fetch(`/api/organizations/${preselectedOrgId}`)
        .then((res) => res.json())
        .then((org) => {
          if (org.id) selectOrg(org);
        })
        .catch(() => {});
    }
  }, [preselectedOrgId]);

  // Search orgs
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/organizations?search=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => setSearchResults(data.data ?? []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function selectOrg(org: Organization) {
    setSelectedOrg(org);
    setTo(org.email || "");
    setSubject(org.subject || "From winded.vertigo");
    setBody(org.bespokeEmailCopy || "");
    setSearchQuery("");
    setShowResults(false);
  }

  async function handleAiDraft() {
    if (!selectedOrg) return;
    // Confirm if user has already written content
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
    if (!selectedOrg || !to || !body) return;
    setSendStatus("sending");
    setSendMessage("");

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          to,
          subject,
          body,
          senderName: senderName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendStatus("sent");
        setSendMessage(`sent to ${to}`);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main — compose area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Org search */}
        <div className="relative">
          <Label className="mb-1.5 block">organization</Label>
          {selectedOrg ? (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{selectedOrg.organization}</span>
              <button
                onClick={() => { setSelectedOrg(null); setTo(""); setBody(""); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="search organizations..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="pl-8"
              />
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((org) => (
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

        {/* To */}
        <div>
          <Label className="mb-1.5 block">to</Label>
          <Input
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
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
            <Label>
              body
              {selectedOrg?.bespokeEmailCopy && (
                <span className="text-muted-foreground font-normal ml-2">
                  (pre-filled from bespoke copy)
                </span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              {aiError && (
                <span className="text-xs text-destructive">{aiError}</span>
              )}
              {aiCost !== null && (
                <span className="text-xs text-muted-foreground">
                  AI cost: ${aiCost.toFixed(4)}
                </span>
              )}
              <Select value={aiTone} onValueChange={(v) => v && setAiTone(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm" className="text-xs">warm</SelectItem>
                  <SelectItem value="professional" className="text-xs">professional</SelectItem>
                  <SelectItem value="casual" className="text-xs">casual</SelectItem>
                  <SelectItem value="formal" className="text-xs">formal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={aiPurpose} onValueChange={(v) => v && setAiPurpose(v)}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
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
                {aiDrafting ? (
                  "drafting..."
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    AI draft
                  </>
                )}
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

        {/* Send button + save as template */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSend}
            disabled={!selectedOrg || !to || !body || sendStatus === "sending"}
            size="lg"
          >
            {sendStatus === "sending" ? (
              "sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-1.5" />
                send email
              </>
            )}
          </Button>
          {body && (
            <SaveAsTemplate subject={subject} body={body} channel="email" />
          )}
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
                <StatusBadge value={selectedOrg.connection} type="connection" />
                <StatusBadge value={selectedOrg.outreachStatus} type="outreach" />
              </div>
              {selectedOrg.email && (
                <div>
                  <span className="text-muted-foreground">email</span>
                  <p className="font-medium">{selectedOrg.email}</p>
                </div>
              )}
              {selectedOrg.friendship && (
                <div>
                  <span className="text-muted-foreground">friendship</span>
                  <p className="font-medium">{selectedOrg.friendship}</p>
                </div>
              )}
              {selectedOrg.priority && (
                <div>
                  <span className="text-muted-foreground">priority</span>
                  <p className="font-medium">{selectedOrg.priority}</p>
                </div>
              )}
              {selectedOrg.outreachSuggestion && (
                <div>
                  <span className="text-muted-foreground">outreach suggestion</span>
                  <p className="font-medium">{selectedOrg.outreachSuggestion}</p>
                </div>
              )}
              {selectedOrg.outreachTarget && (
                <div>
                  <span className="text-muted-foreground">outreach target</span>
                  <p className="font-medium">{selectedOrg.outreachTarget}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">select an organization to see context and pre-fill email copy</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
