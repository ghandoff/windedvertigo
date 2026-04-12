"use client";

import { useState } from "react";
import Link from "next/link";
import type { Person } from "@/lib/types";

// US federal census years (1890 mostly destroyed by fire)
const CENSUS_YEARS = [1790, 1800, 1810, 1820, 1830, 1840, 1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950];

function extractYear(person: Person, eventType: string): number | null {
  const evt = person.events.find((e) => e.event_type === eventType);
  if (!evt?.sort_date) return null;
  const y = parseInt(evt.sort_date.slice(0, 4), 10);
  return isNaN(y) ? null : y;
}

function getDisplayName(person: Person): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
}

function hasCensusRecord(person: Person, year: number): boolean {
  return person.events.some(
    (e) =>
      e.event_type === "census" &&
      e.sort_date &&
      parseInt(e.sort_date.slice(0, 4), 10) === year,
  );
}

type CellStatus = "found" | "missing" | "not_alive" | "unknown";

function getCellStatus(person: Person, year: number): CellStatus {
  const birthYear = extractYear(person, "birth");
  const deathYear = extractYear(person, "death");

  // can't determine if alive without birth year
  if (!birthYear) {
    return hasCensusRecord(person, year) ? "found" : "unknown";
  }

  // not yet born
  if (year < birthYear) return "not_alive";

  // deceased before census (with some margin — census taken mid-year)
  if (deathYear && year > deathYear) return "not_alive";

  // alive during this census — check if we have a record
  return hasCensusRecord(person, year) ? "found" : "missing";
}

const STATUS_STYLES: Record<CellStatus, string> = {
  found: "bg-green-500/20 text-green-600 border-green-500/30",
  missing: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  not_alive: "bg-muted/30 text-muted-foreground/30 border-transparent",
  unknown: "bg-muted/50 text-muted-foreground/50 border-border/50",
};

const STATUS_SYMBOLS: Record<CellStatus, string> = {
  found: "✓",
  missing: "?",
  not_alive: "",
  unknown: "·",
};

export function CensusTimeline({ persons }: { persons: Person[] }) {
  const [sortBy, setSortBy] = useState<"name" | "coverage">("name");
  const [filterText, setFilterText] = useState("");

  // only show persons with birth year so timeline is meaningful
  const relevantPersons = persons.filter((p) => {
    const birthYear = extractYear(p, "birth");
    const deathYear = extractYear(p, "death");
    // show if they could appear in any census (born before 1950, died after 1790 or still living)
    if (!birthYear) return true; // include unknowns
    if (birthYear > 1950) return false;
    if (deathYear && deathYear < 1790) return false;
    return true;
  });

  // relevant census years — trim to what our data covers
  const birthYears = relevantPersons.map((p) => extractYear(p, "birth")).filter(Boolean) as number[];
  const minBirth = birthYears.length > 0 ? Math.min(...birthYears) : 1790;
  const visibleYears = CENSUS_YEARS.filter((y) => y >= Math.floor(minBirth / 10) * 10 - 10);

  // compute coverage stats
  const personStats = relevantPersons.map((p) => {
    const cells = visibleYears.map((y) => getCellStatus(p, y));
    const alive = cells.filter((c) => c === "found" || c === "missing").length;
    const found = cells.filter((c) => c === "found").length;
    return {
      person: p,
      name: getDisplayName(p),
      cells,
      coverage: alive > 0 ? found / alive : 0,
      missing: cells.filter((c) => c === "missing").length,
    };
  });

  // filter
  const filtered = filterText
    ? personStats.filter((s) => s.name.toLowerCase().includes(filterText.toLowerCase()))
    : personStats;

  // sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "coverage") return a.coverage - b.coverage; // lowest coverage first
    return a.name.localeCompare(b.name);
  });

  // overall stats
  const totalMissing = sorted.reduce((s, p) => s + p.missing, 0);
  const totalFound = sorted.reduce((s, p) => s + p.cells.filter((c) => c === "found").length, 0);
  const totalAlive = sorted.reduce(
    (s, p) => s + p.cells.filter((c) => c === "found" || c === "missing").length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="rounded-md border border-border px-3 py-2">
          <span className="text-lg font-semibold text-foreground">{totalFound}</span>
          <span className="text-xs text-muted-foreground ml-1">records found</span>
        </div>
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
          <span className="text-lg font-semibold text-yellow-600">{totalMissing}</span>
          <span className="text-xs text-muted-foreground ml-1">missing</span>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <span className="text-lg font-semibold text-foreground">
            {totalAlive > 0 ? Math.round((totalFound / totalAlive) * 100) : 0}%
          </span>
          <span className="text-xs text-muted-foreground ml-1">coverage</span>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="filter by name..."
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-48"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "coverage")}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="name">sort by name</option>
          <option value="coverage">sort by coverage (lowest first)</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          no persons match the census date range (1790-1950)
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[140px]">
                  person
                </th>
                {visibleYears.map((y) => (
                  <th
                    key={y}
                    className="px-1.5 py-2 font-medium text-muted-foreground text-center min-w-[36px]"
                  >
                    {String(y).slice(2)}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-muted-foreground text-right min-w-[50px]">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.person.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 sticky left-0 bg-background">
                    <Link
                      href={`/person/${row.person.id}`}
                      className="text-foreground hover:text-primary transition-colors font-medium"
                    >
                      {row.name}
                    </Link>
                  </td>
                  {row.cells.map((status, i) => (
                    <td key={visibleYears[i]} className="px-1 py-1.5 text-center">
                      {status !== "not_alive" && (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-medium border ${STATUS_STYLES[status]}`}
                          title={`${visibleYears[i]}: ${status}`}
                        >
                          {STATUS_SYMBOLS[status]}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium">
                    <span
                      className={
                        row.coverage >= 0.8
                          ? "text-green-600"
                          : row.coverage >= 0.4
                            ? "text-yellow-600"
                            : "text-red-500"
                      }
                    >
                      {Math.round(row.coverage * 100)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={`inline-block w-4 h-3 rounded ${STATUS_STYLES.found}`} /> record found
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block w-4 h-3 rounded ${STATUS_STYLES.missing}`} /> missing
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block w-4 h-3 rounded ${STATUS_STYLES.unknown}`} /> unknown dates
        </span>
        <span className="text-muted-foreground/50">
          note: 1890 census excluded (destroyed by fire)
        </span>
      </div>
    </div>
  );
}
