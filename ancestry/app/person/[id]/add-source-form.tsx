"use client";

import { useTransition, useState } from "react";
import type { PersonEvent } from "@/lib/types";
import { addSourceAction, deleteCitationAction } from "./actions";

const SOURCE_TYPES = [
  { value: "", label: "select type..." },
  { value: "census", label: "census" },
  { value: "vital_record", label: "vital record" },
  { value: "church", label: "church record" },
  { value: "military", label: "military record" },
  { value: "newspaper", label: "newspaper" },
  { value: "book", label: "book" },
  { value: "online", label: "online source" },
  { value: "photo", label: "photo / image" },
  { value: "interview", label: "interview" },
  { value: "other", label: "other" },
];

const CONFIDENCE_OPTIONS = [
  { value: "", label: "not specified" },
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "questionable", label: "questionable" },
  { value: "unreliable", label: "unreliable" },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  primary: "bg-green-100 text-green-800",
  secondary: "bg-blue-100 text-blue-800",
  questionable: "bg-yellow-100 text-yellow-800",
  unreliable: "bg-red-100 text-red-800",
};

type PersonSourceRow = {
  source_id: string;
  title: string;
  author: string | null;
  source_type: string | null;
  url: string | null;
  citation_id: string;
  page: string | null;
  confidence: string | null;
  extract: string | null;
  citation_notes: string | null;
  event_type: string | null;
  event_id: string | null;
};

export function SourcesSection({
  personId,
  events,
  sources,
}: {
  personId: string;
  events: PersonEvent[];
  sources: PersonSourceRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  // group citations by source
  const grouped = new Map<string, { title: string; author: string | null; sourceType: string | null; url: string | null; citations: PersonSourceRow[] }>();
  for (const row of sources) {
    if (!grouped.has(row.source_id)) {
      grouped.set(row.source_id, {
        title: row.title,
        author: row.author,
        sourceType: row.source_type,
        url: row.url,
        citations: [],
      });
    }
    grouped.get(row.source_id)!.citations.push(row);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          sources
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-primary hover:underline"
        >
          {showForm ? "cancel" : "+ add source"}
        </button>
      </div>

      {showForm && (
        <form
          action={(formData) => {
            startTransition(async () => {
              await addSourceAction(personId, formData);
              setShowForm(false);
            });
          }}
          className="space-y-4 border-b border-border pb-4"
        >
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              source details
            </h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">title *</label>
              <input
                name="title"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                placeholder="e.g. 1920 us federal census"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">author</label>
                <input
                  name="author"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">publisher</label>
                <input
                  name="publisher"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">source type</label>
                <select
                  name="sourceType"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">url</label>
                <input
                  name="url"
                  type="url"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">source notes</label>
              <input
                name="sourceNotes"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                placeholder="optional notes about the source"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              link to event (optional)
            </h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">event</label>
              <select
                name="eventId"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">no specific event</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.event_type}
                    {evt.date ? ` — ${evt.date.display}` : ""}
                    {evt.description ? ` — ${evt.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">page / location</label>
                <input
                  name="page"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="e.g. page 23, line 14"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">confidence</label>
                <select
                  name="confidence"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {CONFIDENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">extract (quoted text)</label>
              <textarea
                name="extract"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                placeholder="exact text from the source..."
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">citation notes</label>
              <input
                name="citationNotes"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "adding..." : "add source"}
          </button>
        </form>
      )}

      {sources.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">
          no sources recorded — add sources to document where facts come from
        </p>
      )}

      {grouped.size > 0 && (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([sourceId, group]) => (
            <div key={sourceId} className="rounded-md border border-border/50 bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{group.title}</div>
                  {group.author && (
                    <div className="text-xs text-muted-foreground">by {group.author}</div>
                  )}
                  {group.sourceType && (
                    <span className="inline-block mt-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {group.sourceType.replace("_", " ")}
                    </span>
                  )}
                </div>
                {group.url && (
                  <a
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    link
                  </a>
                )}
              </div>

              <ul className="space-y-1.5 ml-0.5">
                {group.citations.map((cit) => (
                  <li key={cit.citation_id} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 text-muted-foreground mt-0.5">·</span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {cit.event_type && (
                        <span className="font-medium text-foreground">{cit.event_type}</span>
                      )}
                      {cit.page && (
                        <span className="text-muted-foreground ml-1">p. {cit.page}</span>
                      )}
                      {cit.confidence && (
                        <span className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLORS[cit.confidence] ?? "bg-muted text-muted-foreground"}`}>
                          {cit.confidence}
                        </span>
                      )}
                      {cit.extract && (
                        <div className="text-muted-foreground italic">&ldquo;{cit.extract}&rdquo;</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          await deleteCitationAction(cit.citation_id, personId);
                        });
                      }}
                      disabled={isPending}
                      className="shrink-0 text-destructive hover:underline disabled:opacity-50"
                      title="remove citation"
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
