"use client";

import { useState, useEffect } from "react";
import { Search, Building2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface OrgResult {
  id: string;
  organization: string;
  type?: string;
}

interface OrgSearchFieldProps {
  /** Currently selected org IDs */
  value: string[];
  /** Callback when selection changes */
  onChange: (orgIds: string[]) => void;
  /** Allow multiple selections */
  multiple?: boolean;
}

export function OrgSearchField({ value, onChange, multiple = true }: OrgSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrgResult[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<OrgResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Load selected org names on mount
  useEffect(() => {
    if (value.length === 0) return;
    Promise.all(
      value.map((id) =>
        fetch(`/api/organizations/${id}`)
          .then((r) => r.json())
          .then((o) => ({ id: o.id, organization: o.organization, type: o.type }))
          .catch(() => ({ id, organization: id.slice(0, 8) + "...", type: undefined }))
      )
    ).then(setSelectedOrgs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced search; reset when query too short
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/organizations?search=${encodeURIComponent(query)}&pageSize=10`)
        .then((r) => r.json())
        .then((d) =>
          setResults(
            (d.data ?? [])
              .filter((o: OrgResult) => !value.includes(o.id))
              .map((o: OrgResult) => ({ id: o.id, organization: o.organization, type: o.type }))
          )
        )
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, value]);

  function addOrg(org: OrgResult) {
    const newSelected = multiple ? [...selectedOrgs, org] : [org];
    setSelectedOrgs(newSelected);
    onChange(newSelected.map((o) => o.id));
    setQuery("");
    setShowResults(false);
  }

  function removeOrg(orgId: string) {
    const newSelected = selectedOrgs.filter((o) => o.id !== orgId);
    setSelectedOrgs(newSelected);
    onChange(newSelected.map((o) => o.id));
  }

  return (
    <div>
      {/* Selected orgs */}
      {selectedOrgs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedOrgs.map((org) => (
            <Badge key={org.id} variant="secondary" className="text-xs gap-1 pr-1">
              <Building2 className="h-3 w-3" />
              {org.organization}
              <button onClick={() => removeOrg(org.id)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      {(multiple || selectedOrgs.length === 0) && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search organizations..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="pl-8 text-sm"
          />
          {showResults && results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
              {results.map((org) => (
                <button
                  key={org.id}
                  onClick={() => addOrg(org)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{org.organization}</span>
                  {org.type && (
                    <span className="text-xs text-muted-foreground ml-auto">{org.type}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
