"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  display: string;
  given_names: string | null;
  surname: string | null;
  sex: string | null;
  is_living: boolean;
};

const SEX_ICONS: Record<string, string> = {
  M: "\u2642",
  F: "\u2640",
  X: "\u26A7",
  U: "\u00B7",
};

const RECENT_KEY = "ancestry-recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): { id: string; name: string }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(id: string, name: string) {
  const recent = getRecentSearches().filter((r) => r.id !== id);
  recent.unshift({ id, name });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function SearchOverlay({
  treeId,
  open,
  onClose,
}: {
  treeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<{ id: string; name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // load recent searches when opening
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      // focus input after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // debounced search
  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/persons?q=${encodeURIComponent(q)}&treeId=${encodeURIComponent(treeId)}`,
          );
          if (res.ok) {
            const data = await res.json();
            setResults((data as SearchResult[]).slice(0, 10));
          }
        } catch {
          // silently fail
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [treeId],
  );

  useEffect(() => {
    doSearch(query);
    setSelectedIndex(0);
  }, [query, doSearch]);

  // cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const navigateTo = useCallback(
    (id: string, name: string) => {
      addRecentSearch(id, name);
      onClose();
      router.push(`/person/${id}`);
    },
    [router, onClose],
  );

  const displayItems = query.trim()
    ? results
    : recentSearches.length > 0
      ? null // show recent searches instead
      : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    const items = query.trim() ? results : recentSearches;
    const maxIndex = items.length - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, maxIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items.length > 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) {
        const name = "display" in item ? (item as SearchResult).display : item.name;
        navigateTo(item.id, name ?? "unknown");
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* modal */}
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="search people..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* results */}
        <div className="max-h-[320px] overflow-y-auto">
          {query.trim() ? (
            results.length > 0 ? (
              <ul className="py-1">
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => navigateTo(r.id, r.display ?? "unknown")}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {SEX_ICONS[r.sex ?? "U"] ?? "\u00B7"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {r.display ?? [r.given_names, r.surname].filter(Boolean).join(" ")}
                        </div>
                        {r.is_living && (
                          <span className="text-[10px] text-muted-foreground">living</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : !loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                no results found
              </div>
            ) : null
          ) : recentSearches.length > 0 ? (
            <div>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                recent
              </div>
              <ul className="py-1">
                {recentSearches.map((r, i) => (
                  <li key={r.id}>
                    <button
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => navigateTo(r.id, r.name)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-muted-foreground"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M12 7v5l4 2" />
                      </svg>
                      <span className="truncate text-sm">{r.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              type to search people in your tree
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
