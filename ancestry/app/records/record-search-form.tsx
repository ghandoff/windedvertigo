"use client";

import { useState, useTransition } from "react";
import type { RecordResult } from "../api/records/search/route";

type Props = {
  defaults: {
    givenName: string;
    surname: string;
    birthYear: string;
    deathYear: string;
    place: string;
    recordType: string;
  };
  persons: { id: string; displayName: string }[];
  treeId: string;
  preselectedPersonId?: string;
};

export function RecordSearchForm({ defaults, persons, treeId, preselectedPersonId }: Props) {
  const [results, setResults] = useState<RecordResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [searching, startSearch] = useTransition();
  const [attaching, startAttach] = useTransition();
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());
  const [attachPersonId, setAttachPersonId] = useState(preselectedPersonId ?? "");

  function handleSearch(formData: FormData) {
    startSearch(async () => {
      const params = new URLSearchParams();
      for (const key of ["givenName", "surname", "birthYear", "deathYear", "place", "recordType"]) {
        const val = formData.get(key) as string;
        if (val?.trim()) params.set(key, val.trim());
      }

      const res = await fetch(`/api/records/search?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setErrors([data.error ?? "search failed"]);
        setResults([]);
        return;
      }

      setResults(data.results ?? []);
      setErrors(data.errors ?? []);
    });
  }

  function handleAttach(result: RecordResult) {
    if (!attachPersonId) return;
    startAttach(async () => {
      const res = await fetch("/api/records/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId,
          personId: attachPersonId,
          title: result.title,
          sourceType: result.recordType,
          url: result.url,
          snippet: result.snippet,
          source: result.source,
        }),
      });

      if (res.ok) {
        setAttachedIds((prev) => new Set(prev).add(result.id));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* search form */}
      <form action={handleSearch} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">given name</label>
            <input
              name="givenName"
              defaultValue={defaults.givenName}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. John"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">surname</label>
            <input
              name="surname"
              defaultValue={defaults.surname}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">birth year</label>
            <input
              name="birthYear"
              defaultValue={defaults.birthYear}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 1850"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">death year</label>
            <input
              name="deathYear"
              defaultValue={defaults.deathYear}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 1920"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">place</label>
            <input
              name="place"
              defaultValue={defaults.place}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Ohio, USA"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">record type</label>
            <select
              name="recordType"
              defaultValue={defaults.recordType}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">all records</option>
              <option value="birth">birth</option>
              <option value="death">death</option>
              <option value="marriage">marriage</option>
              <option value="census">census</option>
              <option value="military">military</option>
              <option value="immigration">immigration</option>
              <option value="land">land / deeds</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={searching}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {searching ? "searching..." : "search records"}
        </button>
      </form>

      {/* errors */}
      {errors.length > 0 && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-yellow-600">{e}</p>
          ))}
        </div>
      )}

      {/* attach-to-person selector */}
      {results.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">attach to:</label>
          <select
            value={attachPersonId}
            onChange={(e) => setAttachPersonId(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">select a person...</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>
      )}

      {/* results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} results found</p>
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border p-4 space-y-2 hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      r.source === "familysearch" ? "bg-green-500/10 text-green-600"
                        : r.source === "nara" ? "bg-purple-500/10 text-purple-600"
                        : r.source === "dpla" ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600"
                    }`}>
                      {r.source === "familysearch" ? "familysearch"
                        : r.source === "nara" ? "national archives"
                        : r.source === "dpla" ? "digital public library"
                        : "newspaper"}
                    </span>
                    {r.recordType && (
                      <span className="text-[10px] text-muted-foreground uppercase">{r.recordType}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-foreground mt-1 truncate">{r.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {r.personName && <span>{r.personName}</span>}
                    {r.date && <span>{r.date}</span>}
                    {r.place && <span>{r.place}</span>}
                  </div>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">{r.snippet}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-center"
                  >
                    view
                  </a>
                  {attachedIds.has(r.id) ? (
                    <span className="rounded bg-green-500/10 px-2 py-1 text-xs text-green-600 text-center">
                      attached
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAttach(r)}
                      disabled={!attachPersonId || attaching}
                      className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
                    >
                      attach
                    </button>
                  )}
                </div>
              </div>
              {r.thumbnailUrl && (
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="rounded border border-border max-h-24 object-contain"
                  loading="lazy"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* empty state */}
      {!searching && results.length === 0 && errors.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          enter search criteria above to find historical records
        </div>
      )}
    </div>
  );
}
