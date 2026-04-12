"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  name: string;
  givenName: string;
  surname: string;
  sex: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  lifespan: string | null;
  score: number | null;
};

type ImportState = "idle" | "importing" | "done" | "error";

export function FamilySearchSearch() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({});
  const [importMessages, setImportMessages] = useState<Record<string, string>>({});

  async function handleSearch(formData: FormData) {
    setSearching(true);
    setError(null);
    setResults([]);
    setImportStates({});
    setImportMessages({});

    const params = new URLSearchParams();
    const givenName = formData.get("givenName") as string;
    const surname = formData.get("surname") as string;
    const birthYear = formData.get("birthYear") as string;
    const birthPlace = formData.get("birthPlace") as string;

    if (givenName) params.set("givenName", givenName);
    if (surname) params.set("surname", surname);
    if (birthYear) params.set("birthYear", birthYear);
    if (birthPlace) params.set("birthPlace", birthPlace);

    try {
      const res = await fetch(`/api/familysearch?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.configured === false) {
          setNotConfigured(true);
        } else {
          setError(data.error ?? "search failed");
        }
        return;
      }

      setResults(data.results ?? []);
      if (data.results?.length === 0) {
        setError("no results found — try adjusting your search");
      }
    } catch {
      setError("failed to connect to familysearch");
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(personId: string, includeFamily: boolean) {
    setImportStates((prev) => ({ ...prev, [personId]: "importing" }));

    try {
      const res = await fetch("/api/familysearch/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, includeFamily }),
      });

      const data = await res.json();

      if (!res.ok) {
        setImportStates((prev) => ({ ...prev, [personId]: "error" }));
        setImportMessages((prev) => ({ ...prev, [personId]: data.error ?? "import failed" }));
        return;
      }

      setImportStates((prev) => ({ ...prev, [personId]: "done" }));
      setImportMessages((prev) => ({
        ...prev,
        [personId]: `imported ${data.imported} ${data.imported === 1 ? "person" : "people"}`,
      }));
      router.refresh();
    } catch {
      setImportStates((prev) => ({ ...prev, [personId]: "error" }));
      setImportMessages((prev) => ({ ...prev, [personId]: "import failed" }));
    }
  }

  if (notConfigured) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          familysearch
        </h3>
        <p className="text-xs text-muted-foreground">
          connect a familysearch account to search and import ancestors directly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
      >
        {expanded ? "close familysearch" : "search familysearch"}
      </button>

      {expanded && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <form action={handleSearch} className="space-y-3" data-1p-ignore autoComplete="off">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">given name</span>
                <input
                  name="givenName"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  placeholder="e.g. john"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">surname</span>
                <input
                  name="surname"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  placeholder="e.g. smith"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">birth year (approx)</span>
                <input
                  name="birthYear"
                  type="number"
                  min="1000"
                  max="2030"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  placeholder="e.g. 1850"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">birth place</span>
                <input
                  name="birthPlace"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  placeholder="e.g. ohio"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={searching}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {searching ? "searching..." : "search"}
            </button>
          </form>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </h4>
              <ul className="space-y-2">
                {results.map((r) => (
                  <li key={r.id} className="rounded-md border border-border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[r.lifespan, r.birthPlace].filter(Boolean).join(" \u00b7 ")}
                        </p>
                        {r.score != null && (
                          <p className="text-xs text-muted-foreground/60">
                            confidence: {Math.round(r.score * 100)}%
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {r.id}
                      </span>
                    </div>

                    {importStates[r.id] === "done" || importStates[r.id] === "error" ? (
                      <p className={`text-xs ${importStates[r.id] === "done" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {importMessages[r.id]}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleImport(r.id, false)}
                          disabled={importStates[r.id] === "importing"}
                          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
                        >
                          {importStates[r.id] === "importing" ? "importing..." : "import"}
                        </button>
                        <button
                          onClick={() => handleImport(r.id, true)}
                          disabled={importStates[r.id] === "importing"}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {importStates[r.id] === "importing" ? "..." : "import with family"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
