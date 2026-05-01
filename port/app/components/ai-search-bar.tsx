"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  filters: { explanation: string };
  results: {
    contacts: Array<{ id: string; name: string; contactWarmth?: string }>;
    organizations: Array<{ id: string; organization: string; priority?: string }>;
  };
}

export function AiSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/ai/nl-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  function navigateTo(path: string) {
    setOpen(false);
    setResult(null);
    setQuery("");
    router.push(path);
  }

  const totalResults =
    (result?.results.contacts.length ?? 0) + (result?.results.organizations.length ?? 0);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Sparkles className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="AI search: &quot;warm contacts at Tier 1 orgs&quot;"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() => result && setOpen(true)}
          className="pl-8 pr-8 text-sm h-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResult(null); setOpen(false); }}
            className="absolute right-2.5 top-2.5"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (loading || result) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-80 overflow-auto">
          {loading && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">searching...</div>
          )}

          {result && !loading && (
            <>
              <div className="px-3 py-2 border-b">
                <p className="text-xs text-muted-foreground">{result.filters.explanation}</p>
              </div>

              {result.results.contacts.length > 0 && (
                <div className="py-1">
                  <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    contacts ({result.results.contacts.length})
                  </p>
                  {result.results.contacts.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigateTo(`/contacts/${c.id}`)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span>{c.name}</span>
                      {c.contactWarmth && <Badge variant="outline" className="text-[10px]">{c.contactWarmth}</Badge>}
                    </button>
                  ))}
                </div>
              )}

              {result.results.organizations.length > 0 && (
                <div className="py-1">
                  <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    organisations ({result.results.organizations.length})
                  </p>
                  {result.results.organizations.slice(0, 5).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => navigateTo(`/organizations/${o.id}`)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span>{o.organization}</span>
                      {o.priority && <Badge variant="outline" className="text-[10px]">{String(o.priority).replace(/ – .+/, "")}</Badge>}
                    </button>
                  ))}
                </div>
              )}

              {totalResults === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">no results found</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
