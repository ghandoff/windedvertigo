"use client";

import { useState, useEffect } from "react";
import { X, Plus, Search, Users, User, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Organization, Contact, AudienceFilter } from "@/lib/notion/types";

interface AudienceListProps {
  filters: AudienceFilter;
  /** manually added org IDs (not from filters) */
  addedIds: string[];
  /** manually removed org IDs (excluded from filter results) */
  removedIds: string[];
  onAddedChange: (ids: string[]) => void;
  onRemovedChange: (ids: string[]) => void;
  /** manually added individual contact IDs */
  addedContactIds?: string[];
  onAddedContactsChange?: (ids: string[]) => void;
  /** callback with live counts for parent display */
  onCountChange?: (orgCount: number, contactCount: number) => void;
}

export function AudienceList({
  filters,
  addedIds,
  removedIds,
  onAddedChange,
  onRemovedChange,
  addedContactIds = [],
  onAddedContactsChange,
  onCountChange,
}: AudienceListProps) {
  const [filterOrgs, setFilterOrgs] = useState<Organization[]>([]);
  const [addedOrgs, setAddedOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Org search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Contact section
  const [contactsExpanded, setContactsExpanded] = useState(true);
  const [addedContacts, setAddedContacts] = useState<Contact[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([]);
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Fetch orgs matching filters
  useEffect(() => {
    const hasFilters = Object.keys(filters).some((k) => {
      const v = filters[k as keyof AudienceFilter];
      return v && (Array.isArray(v) ? v.length > 0 : true);
    });
    if (!hasFilters) {
      setFilterOrgs([]);
      return;
    }
    setLoading(true);
    fetch("/api/audience/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filters),
    })
      .then((r) => r.json())
      .then((d) => {
        // Get full list, not just preview
        if (d.count > 10) {
          // Fetch all by resolving audience
          fetch("/api/audience/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...filters, _limit: 500 }),
          })
            .then((r) => r.json())
            .then((full) => setFilterOrgs(full.preview ?? d.preview ?? []))
            .catch(() => setFilterOrgs(d.preview ?? []));
        } else {
          setFilterOrgs(d.preview ?? []);
        }
      })
      .catch(() => setFilterOrgs([]))
      .finally(() => setLoading(false));
  }, [filters]);

  // Fetch manually added orgs
  useEffect(() => {
    if (addedIds.length === 0) {
      setAddedOrgs([]);
      return;
    }
    Promise.all(
      addedIds.map((id) =>
        fetch(`/api/organizations/${id}`).then((r) => r.json()).catch(() => null),
      ),
    ).then((orgs) => setAddedOrgs(orgs.filter(Boolean)));
  }, [addedIds]);

  // Search for orgs to add
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/organizations?search=${encodeURIComponent(searchQuery)}&pageSize=10`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.data ?? []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Fetch manually added contacts
  useEffect(() => {
    if (addedContactIds.length === 0) { setAddedContacts([]); return; }
    Promise.all(
      addedContactIds.map((id) =>
        fetch(`/api/contacts/${id}`).then((r) => r.json()).catch(() => null),
      ),
    ).then((contacts) => setAddedContacts(contacts.filter(Boolean)));
  }, [addedContactIds]);

  // Search for contacts to add
  useEffect(() => {
    if (contactSearchQuery.length < 2) { setContactSearchResults([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/contacts?search=${encodeURIComponent(contactSearchQuery)}&pageSize=10`)
        .then((r) => r.json())
        .then((d) => setContactSearchResults(d.data ?? []))
        .catch(() => setContactSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [contactSearchQuery]);

  // Combine: filter orgs (minus removed) + manually added
  const allFilterOrgIds = new Set(filterOrgs.map((o) => o.id));
  const removedSet = new Set(removedIds);
  const addedSet = new Set(addedIds);
  const addedContactSet = new Set(addedContactIds);

  const activeFilterOrgs = filterOrgs.filter((o) => !removedSet.has(o.id));
  const manualOrgs = addedOrgs.filter((o) => !allFilterOrgIds.has(o.id));
  const totalOrgCount = activeFilterOrgs.length + manualOrgs.length;

  // Derive contact count: unique contacts across all filter-matched orgs
  const filterContactIds = new Set(activeFilterOrgs.flatMap((o) => (o as Organization & { contactIds?: string[] }).contactIds ?? []));
  const totalContactCount = filterContactIds.size + addedContactIds.length;

  // Bubble counts to parent
  useEffect(() => {
    onCountChange?.(totalOrgCount, totalContactCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOrgCount, totalContactCount]);

  function removeOrg(orgId: string) {
    if (addedSet.has(orgId)) {
      onAddedChange(addedIds.filter((id) => id !== orgId));
    } else {
      onRemovedChange([...removedIds, orgId]);
    }
  }

  function restoreOrg(orgId: string) {
    onRemovedChange(removedIds.filter((id) => id !== orgId));
  }

  function addOrg(org: Organization) {
    if (!addedSet.has(org.id) && !allFilterOrgIds.has(org.id)) {
      onAddedChange([...addedIds, org.id]);
    }
    setSearchQuery("");
    setShowSearch(false);
  }

  function addContact(contact: Contact) {
    if (!addedContactSet.has(contact.id)) {
      onAddedContactsChange?.([...addedContactIds, contact.id]);
    }
    setContactSearchQuery("");
    setShowContactSearch(false);
  }

  function removeContact(contactId: string) {
    onAddedContactsChange?.(addedContactIds.filter((id) => id !== contactId));
  }

  return (
    <div className="space-y-4">
      {/* ── Organizations ─────────────────────────── */}
      <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Users className="h-4 w-4" />
          {totalOrgCount} organizations
          {totalContactCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">· {totalContactCount} contacts</span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          add org
        </Button>
      </div>

      {/* Search to add individual orgs */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="search to add an organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searchResults
                .filter((o) => !allFilterOrgIds.has(o.id) && !addedSet.has(o.id))
                .map((org) => (
                  <button
                    key={org.id}
                    onClick={() => addOrg(org)}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted flex items-center justify-between"
                  >
                    <span className="font-medium">{org.organization}</span>
                    <Plus className="h-3 w-3 text-accent" />
                  </button>
                ))}
              {searchResults.filter((o) => !allFilterOrgIds.has(o.id) && !addedSet.has(o.id)).length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">all results already in audience</p>
              )}
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-xs text-muted-foreground">loading audience...</p>}

      {expanded && !loading && (
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          {/* Filter-matched orgs */}
          {activeFilterOrgs.map((org) => (
            <div key={org.id} className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">{org.organization}</span>
                {org.priority && (
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {org.priority.replace(/ – .+/, "")}
                  </Badge>
                )}
              </div>
              <button
                onClick={() => removeOrg(org.id)}
                className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                title="remove from audience"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Manually added orgs */}
          {manualOrgs.map((org) => (
            <div key={org.id} className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/50 bg-accent/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">{org.organization}</span>
                <Badge variant="secondary" className="text-[9px]">manually added</Badge>
              </div>
              <button
                onClick={() => removeOrg(org.id)}
                className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {totalOrgCount === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              no organizations in audience. use filters above or add manually.
            </p>
          )}
        </div>
      )}

      {/* Excluded orgs (can restore) */}
      {removedIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span>{removedIds.length} excluded</span>
          <button
            onClick={() => onRemovedChange([])}
            className="ml-2 text-accent hover:underline"
          >
            restore all
          </button>
        </div>
      )}
      </div>

      {/* ── Individual Contacts ───────────────────── */}
      {onAddedContactsChange && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setContactsExpanded(!contactsExpanded)}
              className="flex items-center gap-1.5 text-sm font-medium"
            >
              <User className="h-4 w-4" />
              {addedContactIds.length} individual contacts
              {contactsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContactSearch(!showContactSearch)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              add contact
            </Button>
          </div>

          {showContactSearch && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="search contacts by name..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
              {contactSearchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {contactSearchResults
                    .filter((c) => !addedContactSet.has(c.id))
                    .map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => addContact(contact)}
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium">{contact.name}</span>
                          {contact.email && (
                            <span className="text-muted-foreground ml-1.5">{contact.email}</span>
                          )}
                        </div>
                        <Plus className="h-3 w-3 text-accent shrink-0" />
                      </button>
                    ))}
                  {contactSearchResults.filter((c) => !addedContactSet.has(c.id)).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">all results already added</p>
                  )}
                </div>
              )}
            </div>
          )}

          {contactsExpanded && addedContactIds.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {addedContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/50 bg-accent/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate">{contact.name}</span>
                    {contact.email && (
                      <span className="text-[10px] text-muted-foreground truncate">{contact.email}</span>
                    )}
                    <Badge variant="secondary" className="text-[9px] shrink-0">individual</Badge>
                  </div>
                  <button
                    onClick={() => removeContact(contact.id)}
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                    title="remove contact"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {contactsExpanded && addedContactIds.length === 0 && (
            <p className="text-xs text-muted-foreground">
              add individual contacts to target specific people regardless of org filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
