"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CameraCapture } from "./camera-capture";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { useContactsCache } from "@/lib/pwa/use-contacts-cache";
import { queueActivity } from "@/lib/pwa/offline-store";
import { syncQueue, requestBackgroundSync } from "@/lib/pwa/sync-manager";
import type { CachedContact } from "@/lib/pwa/offline-store";
import { useMembers } from "@/lib/pwa/use-members";
import { useCurrentUser } from "@/lib/pwa/use-current-user";

const ACTIVITY_TYPES = [
  "conference encounter", "meeting", "call", "intro made",
  "email sent", "email received", "linkedin message",
  "proposal shared", "other",
] as const;

// Team members loaded dynamically from Notion members DB

const OUTCOMES = ["positive", "neutral", "no response", "declined"] as const;

export function QuickLogForm() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const members = useMembers();
  const currentUser = useCurrentUser();
  const { search: searchContacts } = useContactsCache();
  const [, startTransition] = useTransition();

  // Form state
  const [activity, setActivity] = useState("");
  const [type, setType] = useState<string | null>("conference encounter");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<CachedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<CachedContact | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loggedBy, setLoggedBy] = useState("");

  // Auto-fill logged by from authenticated user
  useEffect(() => {
    if (currentUser?.firstName && !loggedBy) {
      setLoggedBy(currentUser.firstName);
    }
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showContactResults, setShowContactResults] = useState(false);

  // Contact search
  useEffect(() => {
    if (contactQuery.length < 2) {
      setContactResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchContacts(contactQuery);
      setContactResults(results);
    }, 200);
    return () => clearTimeout(timeout);
  }, [contactQuery, searchContacts]);

  async function handleSave() {
    if (!activity.trim()) return;
    setSaving(true);

    const id = crypto.randomUUID();
    const item = {
      id,
      activity: activity.trim(),
      type: type ?? "other",
      contactId: selectedContact?.id,
      contactName: selectedContact?.name,
      orgName: undefined as string | undefined,
      organizationIds: selectedContact?.organizationIds ?? [],
      date,
      outcome: outcome ?? undefined,
      notes: notes.trim() || undefined,
      loggedBy: loggedBy.trim() || undefined,
      photoBlob: photoBlob ?? undefined,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    // Always queue locally first (offline-first)
    await queueActivity(item);

    // If online, try to sync immediately
    if (isOnline) {
      try {
        await syncQueue();
      } catch {
        // Will sync later via background sync
        await requestBackgroundSync();
      }
    } else {
      await requestBackgroundSync();
    }

    // Reset form
    setActivity("");
    setType("conference encounter");
    setOutcome(null);
    setContactQuery("");
    setSelectedContact(null);
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setPhotoBlob(null);
    setSaving(false);
    setSaved(true);

    // Flash success, then reset
    setTimeout(() => {
      setSaved(false);
      startTransition(() => router.refresh());
    }, 2000);
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-sm font-medium">activity logged{!isOnline ? " (will sync when online)" : ""}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Activity description */}
      <div>
        <Label className="mb-1.5 block text-xs">what happened?</Label>
        <Input
          placeholder="coffee at BETT 2026..."
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          autoFocus
          className="text-base" // larger on mobile
        />
      </div>

      {/* Type + Outcome side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs">type</Label>
          <Select value={type ?? "conference encounter"} onValueChange={setType}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">outcome</Label>
          <Select value={outcome ?? ""} onValueChange={setOutcome}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="select..." />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contact search */}
      <div className="relative">
        <Label className="mb-1.5 block text-xs">contact</Label>
        {selectedContact ? (
          <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50 text-sm">
            <span className="font-medium">{selectedContact.name}</span>
            {selectedContact.role && (
              <span className="text-muted-foreground text-xs">({selectedContact.role})</span>
            )}
            <button
              onClick={() => { setSelectedContact(null); setContactQuery(""); }}
              className="ml-auto text-xs text-muted-foreground"
            >
              change
            </button>
          </div>
        ) : (
          <>
            <Input
              placeholder="search contacts..."
              value={contactQuery}
              onChange={(e) => { setContactQuery(e.target.value); setShowContactResults(true); }}
              onFocus={() => setShowContactResults(true)}
              className="text-sm"
            />
            {showContactResults && contactResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {contactResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedContact(c);
                      setContactQuery("");
                      setShowContactResults(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.role && <span className="text-xs text-muted-foreground ml-1.5">({c.role})</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Date */}
      <div>
        <Label className="mb-1.5 block text-xs">date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Camera */}
      <CameraCapture
        onCapture={(blob) => setPhotoBlob(blob)}
        onClear={() => setPhotoBlob(null)}
      />

      {/* Notes */}
      <div>
        <Label className="mb-1.5 block text-xs">notes</Label>
        <Textarea
          placeholder="details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Logged by */}
      <div>
        <Label className="mb-1.5 block text-xs">logged by</Label>
        <Select value={loggedBy || ""} onValueChange={(v) => setLoggedBy(v ?? "")}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="who are you?" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.firstName} className="text-sm">{m.firstName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={!activity.trim() || saving}
        className="w-full h-12 text-base"
      >
        {saving ? "saving..." : "save activity"}
      </Button>
    </div>
  );
}
