"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, X, Plus, Search, ChevronDown, ChevronUp, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AudienceFilter, Organization, Contact } from "@/lib/notion/types";

interface RecipientPanelProps {
  campaignId: string;
  audienceFilters: AudienceFilter;
  recipients: Organization[];
  /** Resolved contacts per org — drives the fan-out list display. */
  contactsByOrgId: Record<string, Contact[]>;
  /** Directly-added contacts (from addedContactIds in audience filters). */
  addedContacts: Contact[];
}

/** Effective email count: org fan-out (minus removed contacts) + direct contacts. */
function countEffectiveRecipients(
  recipients: Organization[],
  contactsByOrgId: Record<string, Contact[]>,
  removedContactSet: Set<string>,
  addedContacts: Contact[],
): number {
  const fromOrgs = recipients.reduce((sum, org) => {
    const contacts = contactsByOrgId[org.id]?.filter((c) => c.email && !removedContactSet.has(c.id)) ?? [];
    return sum + (contacts.length > 0 ? contacts.length : org.email ? 1 : 0);
  }, 0);
  const fromDirect = addedContacts.filter((c) => c.email).length;
  return fromOrgs + fromDirect;
}

export function RecipientPanel({
  campaignId,
  audienceFilters,
  recipients: initialRecipients,
  contactsByOrgId: initialContactsByOrgId,
  addedContacts: initialAddedContacts,
}: RecipientPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [recipients, setRecipients] = useState<Organization[]>(initialRecipients);
  const [contactsByOrgId] = useState<Record<string, Contact[]>>(initialContactsByOrgId);
  const [addedContacts, setAddedContacts] = useState<Contact[]>(initialAddedContacts);
  const [filters, setFilters] = useState<AudienceFilter>(audienceFilters);

  // Derive the removed-contact set from filters for display/counting
  const removedContactSet = new Set(filters.removedContactIds ?? []);

  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Org search
  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<Organization[]>([]);
  const [orgSearchOpen, setOrgSearchOpen] = useState(false);
  const [orgSearching, setOrgSearching] = useState(false);
  const orgSearchRef = useRef<HTMLDivElement>(null);

  // Contact search
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearching, setContactSearching] = useState(false);
  const contactSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orgSearchRef.current && !orgSearchRef.current.contains(e.target as Node)) setOrgSearchOpen(false);
      if (contactSearchRef.current && !contactSearchRef.current.contains(e.target as Node)) setContactSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function patchFilters(newFilters: AudienceFilter) {
    setSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceFilters: newFilters }),
      });
      setFilters(newFilters);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  // ── Org add/remove ─────────────────────────────────────

  function removeRecipient(org: Organization) {
    const addedOrgIds = filters.addedOrgIds ?? [];
    const removedOrgIds = filters.removedOrgIds ?? [];
    const newFilters: AudienceFilter = addedOrgIds.includes(org.id)
      ? { ...filters, addedOrgIds: addedOrgIds.filter((id) => id !== org.id) }
      : { ...filters, removedOrgIds: [...removedOrgIds, org.id] };
    setRecipients((prev) => prev.filter((r) => r.id !== org.id));
    patchFilters(newFilters);
  }

  function addRecipient(org: Organization) {
    const addedOrgIds = filters.addedOrgIds ?? [];
    const removedOrgIds = filters.removedOrgIds ?? [];
    const newFilters: AudienceFilter = removedOrgIds.includes(org.id)
      ? { ...filters, removedOrgIds: removedOrgIds.filter((id) => id !== org.id) }
      : { ...filters, addedOrgIds: [...addedOrgIds, org.id] };
    setRecipients((prev) => prev.find((r) => r.id === org.id) ? prev : [...prev, org]);
    setOrgQuery("");
    setOrgSearchOpen(false);
    patchFilters(newFilters);
  }

  async function handleOrgSearch(query: string) {
    setOrgQuery(query);
    if (!query.trim()) { setOrgResults([]); setOrgSearchOpen(false); return; }
    setOrgSearching(true);
    setOrgSearchOpen(true);
    try {
      const res = await fetch(`/api/organizations?search=${encodeURIComponent(query)}&pageSize=8`);
      const data = await res.json();
      const existing = new Set(recipients.map((r) => r.id));
      setOrgResults((data.data ?? []).filter((o: Organization) => !existing.has(o.id)));
    } catch {
      setOrgResults([]);
    } finally {
      setOrgSearching(false);
    }
  }

  // ── Per-contact remove (org fan-out) ──────────────────

  function removeContact(contact: Contact) {
    const removedContactIds = filters.removedContactIds ?? [];
    const newFilters: AudienceFilter = { ...filters, removedContactIds: [...removedContactIds, contact.id] };
    patchFilters(newFilters);
  }

  // ── Direct contact add/remove ─────────────────────────

  function removeDirectContact(contact: Contact) {
    const addedContactIds = filters.addedContactIds ?? [];
    const newFilters: AudienceFilter = { ...filters, addedContactIds: addedContactIds.filter((id) => id !== contact.id) };
    setAddedContacts((prev) => prev.filter((c) => c.id !== contact.id));
    patchFilters(newFilters);
  }

  function addDirectContact(contact: Contact) {
    const addedContactIds = filters.addedContactIds ?? [];
    if (addedContactIds.includes(contact.id)) return;
    const newFilters: AudienceFilter = { ...filters, addedContactIds: [...addedContactIds, contact.id] };
    setAddedContacts((prev) => prev.find((c) => c.id === contact.id) ? prev : [...prev, contact]);
    setContactQuery("");
    setContactSearchOpen(false);
    patchFilters(newFilters);
  }

  async function handleContactSearch(query: string) {
    setContactQuery(query);
    if (!query.trim()) { setContactResults([]); setContactSearchOpen(false); return; }
    setContactSearching(true);
    setContactSearchOpen(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&pageSize=8`);
      const data = await res.json();
      const existingDirect = new Set(addedContacts.map((c) => c.id));
      setContactResults((data.data ?? []).filter((c: Contact) => c.email && !existingDirect.has(c.id)));
    } catch {
      setContactResults([]);
    } finally {
      setContactSearching(false);
    }
  }

  const effectiveCount = countEffectiveRecipients(recipients, contactsByOrgId, removedContactSet, addedContacts);
  const orgCount = recipients.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">recipients</CardTitle>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-muted-foreground">saving...</span>}
            <Badge variant="secondary">
              {effectiveCount !== orgCount
                ? `${effectiveCount} emails · ${orgCount} orgs`
                : `${orgCount} orgs`}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Expandable recipient list */}
        <div>
          <button
            onClick={() => setListOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span>{listOpen ? "hide list" : "show all recipients"}</span>
            {listOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {listOpen && (
            <div className="mt-2 max-h-80 overflow-y-auto rounded-md border divide-y">
              {recipients.length === 0 && addedContacts.length === 0 && (
                <div className="py-6 text-center">
                  <Users className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">no recipients</p>
                </div>
              )}

              {/* Org rows with fan-out contacts */}
              {recipients.map((org) => {
                const allContacts = contactsByOrgId[org.id]?.filter((c) => c.email) ?? [];
                const visibleContacts = allContacts.filter((c) => !removedContactSet.has(c.id));
                const removedCount = allContacts.length - visibleContacts.length;
                const hasContacts = visibleContacts.length > 0;

                return (
                  <div key={org.id} className="group">
                    {/* Org row */}
                    <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{org.organization}</p>
                        {!hasContacts && org.email && (
                          <p className="text-[10px] text-muted-foreground truncate">{org.email}</p>
                        )}
                        {hasContacts && (
                          <p className="text-[10px] text-muted-foreground">
                            {visibleContacts.length} contact{visibleContacts.length !== 1 ? "s" : ""}
                            {removedCount > 0 && ` · ${removedCount} removed`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeRecipient(org)}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove org from campaign"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Contact rows — indented, each with a remove button */}
                    {visibleContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="group/contact flex items-center gap-2 pl-6 pr-3 py-1.5 bg-muted/20 border-t border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <User className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate">{contact.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                        </div>
                        <button
                          onClick={() => removeContact(contact)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/contact:opacity-100"
                          title="Remove this contact from campaign"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Directly-added contacts section */}
              {addedContacts.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-muted/30">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">direct contacts</p>
                  </div>
                  {addedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="group/dc flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <User className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium truncate">{contact.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                      </div>
                      <button
                        onClick={() => removeDirectContact(contact)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/dc:opacity-100"
                        title="Remove contact from campaign"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Add org search */}
        <div ref={orgSearchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={orgQuery}
              onChange={(e) => handleOrgSearch(e.target.value)}
              onFocus={() => orgQuery && setOrgSearchOpen(true)}
              placeholder="add organisation..."
              className="pl-7 h-8 text-xs"
            />
          </div>

          {orgSearchOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              {orgSearching && <p className="px-3 py-2 text-xs text-muted-foreground">searching...</p>}
              {!orgSearching && orgResults.length === 0 && orgQuery.trim() && (
                <p className="px-3 py-2 text-xs text-muted-foreground">no results</p>
              )}
              {orgResults.map((org) => (
                <button
                  key={org.id}
                  onClick={() => addRecipient(org)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
                >
                  <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{org.organization}</p>
                    {org.email && <p className="text-[10px] text-muted-foreground truncate">{org.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add contact search */}
        <div ref={contactSearchRef} className="relative">
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={contactQuery}
              onChange={(e) => handleContactSearch(e.target.value)}
              onFocus={() => contactQuery && setContactSearchOpen(true)}
              placeholder="add contact directly..."
              className="pl-7 h-8 text-xs"
            />
          </div>

          {contactSearchOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              {contactSearching && <p className="px-3 py-2 text-xs text-muted-foreground">searching...</p>}
              {!contactSearching && contactResults.length === 0 && contactQuery.trim() && (
                <p className="px-3 py-2 text-xs text-muted-foreground">no results with email</p>
              )}
              {contactResults.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => addDirectContact(contact)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
                >
                  <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    {contact.email && <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
