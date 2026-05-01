"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PhoneIcon,
  MailIcon,
  UsersIcon,
  StickyNoteIcon,
  SendIcon,
  CheckCircle2Icon,
  LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { useContactsCache } from "@/lib/pwa/use-contacts-cache";
import { useCurrentUser } from "@/lib/pwa/use-current-user";
import { queueActivity } from "@/lib/pwa/offline-store";
import { syncQueue, requestBackgroundSync } from "@/lib/pwa/sync-manager";
import type { CachedContact } from "@/lib/pwa/offline-store";

const QUICK_TYPES = [
  { value: "call", label: "call", icon: PhoneIcon },
  { value: "email sent", label: "email", icon: MailIcon },
  { value: "meeting", label: "meeting", icon: UsersIcon },
  { value: "other", label: "note", icon: StickyNoteIcon },
] as const;

type QuickType = (typeof QUICK_TYPES)[number]["value"];

interface QuickAddActivityProps {
  /** Controlled open state — when provided, hides the FAB */
  externalOpen?: boolean;
  /** Controlled open handler — paired with externalOpen */
  onExternalOpenChange?: (open: boolean) => void;
}

export function QuickAddActivity({
  externalOpen,
  onExternalOpenChange,
}: QuickAddActivityProps = {}) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const currentUser = useCurrentUser();
  const { search: searchContacts } = useContactsCache();
  const [, startTransition] = useTransition();

  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = externalOpen !== undefined;
  const open = controlled ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlled) {
      onExternalOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [type, setType] = useState<QuickType>("call");
  const [activity, setActivity] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<CachedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<CachedContact | null>(null);
  const [showContactResults, setShowContactResults] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Contact search with debounce
  useEffect(() => {
    if (contactQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced search; reset when query too short
      setContactResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchContacts(contactQuery);
      setContactResults(results);
    }, 200);
    return () => clearTimeout(timeout);
  }, [contactQuery, searchContacts]);

  function resetForm() {
    setType("call");
    setActivity("");
    setContactQuery("");
    setContactResults([]);
    setSelectedContact(null);
    setShowContactResults(false);
    setNotes("");
    setSaving(false);
    setSaved(false);
  }

  async function handleSubmit() {
    if (!activity.trim()) return;
    setSaving(true);

    const id = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];

    const item = {
      id,
      activity: activity.trim(),
      type,
      contactId: selectedContact?.id,
      contactName: selectedContact?.name,
      orgName: undefined as string | undefined,
      organizationIds: selectedContact?.organizationIds ?? [],
      date: today,
      outcome: undefined,
      notes: notes.trim() || undefined,
      loggedBy: currentUser?.firstName || undefined,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    // Offline-first: always queue locally
    await queueActivity(item);

    // Sync if online
    if (isOnline) {
      try {
        await syncQueue();
      } catch {
        await requestBackgroundSync();
      }
    } else {
      await requestBackgroundSync();
    }

    setSaving(false);
    setSaved(true);

    // Flash success then close
    setTimeout(() => {
      setOpen(false);
      resetForm();
      startTransition(() => router.refresh());
    }, 1200);
  }

  return (
    <>
      {/* FAB — fixed above the feedback widget. Hidden when opened from TopBarTools. */}
      {!controlled && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-6 z-50 size-14 rounded-full shadow-lg shadow-primary/25"
          size="icon-lg"
          aria-label="quick add activity"
        >
          <PlusIcon className="size-6" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
        <DialogContent
          className="fixed bottom-0 left-0 right-0 top-auto translate-x-0 translate-y-0 max-w-full sm:max-w-full rounded-t-2xl rounded-b-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom"
          showCloseButton={false}
        >
          {saved ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2Icon className="size-10 text-green-500" />
              <p className="text-sm font-medium">
                logged{!isOnline ? " — will sync when online" : ""}
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>quick log</DialogTitle>
                <DialogDescription className="sr-only">
                  quickly log an activity
                </DialogDescription>
              </DialogHeader>

              {/* Type selector — icon pills */}
              <div className="flex gap-2">
                {QUICK_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="size-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Activity description */}
              <div>
                <Label className="mb-1.5 block text-xs">what happened?</Label>
                <Input
                  placeholder="quick coffee chat..."
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  autoFocus
                  className="text-base"
                />
              </div>

              {/* Contact (optional) */}
              <div className="relative">
                <Label className="mb-1.5 block text-xs">contact (optional)</Label>
                {selectedContact ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50 text-sm">
                    <span className="font-medium">{selectedContact.name}</span>
                    {selectedContact.role && (
                      <span className="text-muted-foreground text-xs">
                        ({selectedContact.role})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContact(null);
                        setContactQuery("");
                      }}
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
                      onChange={(e) => {
                        setContactQuery(e.target.value);
                        setShowContactResults(true);
                      }}
                      onFocus={() => setShowContactResults(true)}
                      className="text-sm"
                    />
                    {showContactResults && contactResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-36 overflow-auto">
                        {contactResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedContact(c);
                              setContactQuery("");
                              setShowContactResults(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.role && (
                              <span className="text-xs text-muted-foreground ml-1.5">
                                ({c.role})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label className="mb-1.5 block text-xs">notes</Label>
                <Textarea
                  placeholder="details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  cancel
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleSubmit}
                  disabled={!activity.trim() || saving}
                >
                  {saving ? (
                    <>
                      <LoaderIcon className="size-3.5 animate-spin" />
                      saving...
                    </>
                  ) : (
                    <>
                      <SendIcon className="size-3.5" />
                      log it
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
