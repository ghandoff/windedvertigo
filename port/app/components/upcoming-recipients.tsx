"use client";

/**
 * Upcoming recipients panel — full list of organisations in the campaign
 * audience that haven't been emailed yet, with inline add/remove controls.
 *
 * Replaces the static, 100-row-capped server-rendered table on the
 * recipients page with an interactive client component that persists
 * changes to the campaign's audienceFilters via PATCH /api/campaigns/[id].
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Plus, Search, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { AudienceFilter } from "@/lib/notion/types";

const RELATIONSHIP_COLORS: Record<string, string> = {
  stranger: "bg-gray-100 text-gray-700",
  aware: "bg-blue-100 text-blue-700",
  contacted: "bg-indigo-100 text-indigo-700",
  "in conversation": "bg-purple-100 text-purple-700",
  collaborating: "bg-green-100 text-green-700",
  "active partner": "bg-emerald-100 text-emerald-700",
  champion: "bg-amber-100 text-amber-700",
};

const FIT_LABELS: Record<string, string> = {
  "🔥 Perfect fit": "🔥",
  "✅ Strong fit": "✅",
  "🟡 Moderate fit": "🟡",
  "🟠 Weak fit": "🟠",
  "❌ No fit": "❌",
};

interface OrgRow {
  id: string;
  organization: string;
  relationship: string;
  fitRating: string;
  email: string;
}

interface UpcomingRecipientsProps {
  campaignId: string;
  audienceFilters: AudienceFilter;
  orgs: OrgRow[];
}

export function UpcomingRecipients({ campaignId, audienceFilters, orgs }: UpcomingRecipientsProps) {
  const [visibleOrgs, setVisibleOrgs] = useState(orgs);
  const [removedThisSession, setRemovedThisSession] = useState<Map<string, OrgRow>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search state for adding orgs
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OrgRow[]>([]);

  // Debounced org search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/organizations?search=${encodeURIComponent(searchQuery)}&pageSize=10`)
        .then((r) => r.json())
        .then((d) => {
          const results = (d.data ?? []).map((o: Record<string, string>) => ({
            id: o.id,
            organization: o.organization,
            relationship: o.relationship ?? "",
            fitRating: o.fitRating ?? "",
            email: o.email ?? "",
          }));
          setSearchResults(results);
        })
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const existingIds = new Set(visibleOrgs.map((o) => o.id));

  async function patchAudience(updatedFilters: AudienceFilter) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceFilters: updatedFilters }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeOrg(org: OrgRow) {
    // Optimistic: remove from visible list
    setVisibleOrgs((prev) => prev.filter((o) => o.id !== org.id));
    setRemovedThisSession((prev) => new Map(prev).set(org.id, org));

    // Persist: add to removedOrgIds
    const currentRemoved = audienceFilters.removedOrgIds ?? [];
    if (!currentRemoved.includes(org.id)) {
      const updated = { ...audienceFilters, removedOrgIds: [...currentRemoved, org.id] };
      await patchAudience(updated);
      // Update our reference so subsequent removes stack correctly
      audienceFilters.removedOrgIds = updated.removedOrgIds;
    }
  }

  async function restoreOrg(orgId: string) {
    const org = removedThisSession.get(orgId);
    if (!org) return;

    // Optimistic: add back to visible list, remove from session removals
    setVisibleOrgs((prev) => [...prev, org].sort((a, b) => a.organization.localeCompare(b.organization)));
    setRemovedThisSession((prev) => {
      const next = new Map(prev);
      next.delete(orgId);
      return next;
    });

    // Persist: remove from removedOrgIds
    const currentRemoved = audienceFilters.removedOrgIds ?? [];
    const updated = { ...audienceFilters, removedOrgIds: currentRemoved.filter((id) => id !== orgId) };
    await patchAudience(updated);
    audienceFilters.removedOrgIds = updated.removedOrgIds;
  }

  async function addOrg(org: OrgRow) {
    if (existingIds.has(org.id)) return;

    // Optimistic: add to visible list
    setVisibleOrgs((prev) => [...prev, org].sort((a, b) => a.organization.localeCompare(b.organization)));
    setSearchQuery("");
    setShowSearch(false);

    // Persist: add to addedOrgIds
    const currentAdded = audienceFilters.addedOrgIds ?? [];
    if (!currentAdded.includes(org.id)) {
      const updated = { ...audienceFilters, addedOrgIds: [...currentAdded, org.id] };
      await patchAudience(updated);
      audienceFilters.addedOrgIds = updated.addedOrgIds;
    }
  }

  const sorted = [...visibleOrgs].sort((a, b) => a.organization.localeCompare(b.organization));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          not yet contacted
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {visibleOrgs.length} orgs in current audience without an email
          </span>
          {saving && (
            <span className="text-[10px] text-muted-foreground ml-2 animate-pulse">saving...</span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {removedThisSession.size > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {removedThisSession.size} removed
            </span>
          )}
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
      </CardHeader>

      <CardContent>
        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        {/* Search to add orgs */}
        {showSearch && (
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="search to add an organisation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults
                  .filter((o) => !existingIds.has(o.id))
                  .map((org) => (
                    <button
                      key={org.id}
                      onClick={() => addOrg(org)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{org.organization}</span>
                        {org.relationship && (
                          <Badge variant="outline" className={`text-[9px] ${RELATIONSHIP_COLORS[org.relationship] ?? ""}`}>
                            {org.relationship}
                          </Badge>
                        )}
                      </div>
                      <Plus className="h-3 w-3 text-accent shrink-0" />
                    </button>
                  ))}
                {searchResults.filter((o) => !existingIds.has(o.id)).length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">all results already in audience</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Removed this session — can restore */}
        {removedThisSession.size > 0 && (
          <div className="mb-4 border border-dashed border-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground font-medium mb-2">removed this session</p>
            <div className="flex flex-wrap gap-1.5">
              {[...removedThisSession.values()].map((org) => (
                <button
                  key={org.id}
                  onClick={() => restoreOrg(org.id)}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-dashed bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  {org.organization}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full recipients table — no cap */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>organisation</TableHead>
              <TableHead>relationship</TableHead>
              <TableHead>fit</TableHead>
              <TableHead>email</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((org, i) => (
              <TableRow key={org.id} className="group">
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium text-sm">
                  <Link href={`/organizations/${org.id}`} className="hover:underline">
                    {org.organization}
                  </Link>
                </TableCell>
                <TableCell>
                  {org.relationship && (
                    <Badge variant="outline" className={`text-[10px] ${RELATIONSHIP_COLORS[org.relationship] ?? ""}`}>
                      {org.relationship}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {FIT_LABELS[org.fitRating] ?? ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {org.email || <span className="italic">no email</span>}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => removeOrg(org)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="remove from audience"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {visibleOrgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                  all orgs in this audience have been contacted.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
