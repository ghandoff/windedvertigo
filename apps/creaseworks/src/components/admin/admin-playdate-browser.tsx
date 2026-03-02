"use client";

/**
 * Admin Playdate Browser — content review with pack filter toggles.
 *
 * Shows every ready playdate in a scannable list grouped by release channel.
 * Each card displays content completeness badges (find/fold/unfold/body/illustration).
 * Expanding a card lazy-loads the full content preview via the admin API,
 * cached in React state to avoid re-fetching.
 *
 * Design decisions:
 *   – List layout (not grid) for content review scanning.
 *   – Completeness dots give at-a-glance coverage without loading HTML.
 *   – Detail fetch is deferred until admin actually needs it.
 *   – SafeHtml component used for all Notion HTML rendering (trusted source).
 */

import { useState, useCallback } from "react";
import SafeHtml from "@/components/ui/safe-html";
import { apiUrl } from "@/lib/api-url";

/* ── types ──────────────────────────────────────────────────────── */

interface Playdate {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  release_channel: string | null;
  status: string;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  tinkering_tier: string | null;
  cover_url?: string | null;
  age_range?: string | null;
  energy_level?: string | null;
  campaign_tags?: string[] | null;
  notion_id?: string | null;
  has_find: boolean;
  has_fold: boolean;
  has_unfold: boolean;
  has_body: boolean;
  has_illustration: boolean;
  has_find_again: boolean;
  run_count: number;
  material_count: number;
}

interface PlaydateDetail {
  id: string;
  title: string;
  headline: string | null;
  headline_html: string | null;
  find: string | null;
  find_html: string | null;
  fold: string | null;
  fold_html: string | null;
  unfold: string | null;
  unfold_html: string | null;
  find_again_mode: string | null;
  find_again_prompt: string | null;
  find_again_prompt_html: string | null;
  slots_optional: boolean | null;
  slots_notes: string | null;
  substitutions_notes: string | null;
  substitutions_notes_html: string | null;
  body_html: string | null;
  illustration_url: string | null;
  cover_url: string | null;
  design_rationale: string | null;
  developmental_notes: string | null;
  author_notes: string | null;
  notion_id: string | null;
  notion_last_edited: string | null;
  synced_at: string | null;
  materials: Array<{
    id: string;
    title: string;
    form_primary: string | null;
    functions: string[] | null;
    context_tags: string[] | null;
    emoji: string | null;
  }>;
}

interface PackMapping {
  id: string;
  slug: string;
  title: string;
  playdate_ids: string[];
}

interface AdminPlaydateBrowserProps {
  playdates: Playdate[];
  packMappings: PackMapping[];
}

/* ── main component ─────────────────────────────────────────────── */

export default function AdminPlaydateBrowser({
  playdates,
  packMappings,
}: AdminPlaydateBrowserProps) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, PlaydateDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const filtered = selectedPack
    ? playdates.filter((p) => {
        const mapping = packMappings.find((m) => m.id === selectedPack);
        return mapping?.playdate_ids.includes(p.id);
      })
    : playdates;

  // Group by release channel
  const sampler = filtered.filter((p) => p.release_channel === "sampler");
  const campaign = filtered.filter(
    (p) =>
      p.release_channel !== "sampler" &&
      p.release_channel !== "internal-only" &&
      p.release_channel != null,
  );
  const internal = filtered.filter(
    (p) => p.release_channel === "internal-only" || p.release_channel == null,
  );

  // Stats
  const totalComplete = filtered.filter(
    (p) => p.has_find && p.has_fold && p.has_unfold,
  ).length;
  const missingContent = filtered.filter(
    (p) => !p.has_find || !p.has_fold || !p.has_unfold,
  ).length;

  const selectedPackTitle = selectedPack
    ? packMappings.find((m) => m.id === selectedPack)?.title
    : null;

  const fetchDetail = useCallback(
    async (id: string) => {
      if (detailCache[id]) return;
      setLoadingDetail(id);
      try {
        const res = await fetch(apiUrl(`/api/admin/playdates/${id}`));
        if (res.ok) {
          const data = await res.json();
          setDetailCache((prev) => ({ ...prev, [id]: data }));
        }
      } catch {
        // silently fail — admin can retry by collapsing and re-expanding
      } finally {
        setLoadingDetail(null);
      }
    },
    [detailCache],
  );

  const toggleExpand = useCallback(
    (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
      } else {
        setExpandedId(id);
        fetchDetail(id);
      }
    },
    [expandedId, fetchDetail],
  );

  return (
    <div>
      {/* ── pack filter bar ────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedPack(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            selectedPack === null
              ? "bg-cadet text-white"
              : "bg-cadet/5 text-cadet/60 hover:bg-cadet/10"
          }`}
        >
          all ({playdates.length})
        </button>
        {packMappings.map((pack) => (
          <button
            key={pack.id}
            onClick={() =>
              setSelectedPack(pack.id === selectedPack ? null : pack.id)
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              selectedPack === pack.id
                ? "bg-sienna text-white"
                : "bg-sienna/5 text-sienna/70 hover:bg-sienna/10"
            }`}
          >
            {pack.title} ({pack.playdate_ids.length})
          </button>
        ))}
      </div>

      {/* ── stats summary ──────────────────────────────────────── */}
      <div className="mb-6 flex gap-6 text-xs text-cadet/50">
        <span>
          <strong className="text-cadet/70">{filtered.length}</strong> playdates
        </span>
        <span>
          <strong className="text-emerald-600">{totalComplete}</strong> content
          complete
        </span>
        {missingContent > 0 && (
          <span>
            <strong className="text-amber-600">{missingContent}</strong> missing
            content
          </span>
        )}
      </div>

      {/* ── selected pack banner ───────────────────────────────── */}
      {selectedPackTitle && (
        <div className="mb-6 rounded-lg border border-sienna/20 bg-sienna/5 px-4 py-2 text-sm text-sienna">
          previewing <strong>{selectedPackTitle}</strong> — this is what
          entitled users see when they open this pack.
        </div>
      )}

      {/* ── grouped playdate lists ─────────────────────────────── */}
      {sampler.length > 0 && (
        <PlaydateGroup
          label="sampler"
          description="visible to everyone at /sampler"
          playdates={sampler}
          expandedId={expandedId}
          detailCache={detailCache}
          loadingDetail={loadingDetail}
          onToggle={toggleExpand}
        />
      )}

      {campaign.length > 0 && (
        <PlaydateGroup
          label="campaign"
          description="visible via campaign links only"
          playdates={campaign}
          expandedId={expandedId}
          detailCache={detailCache}
          loadingDetail={loadingDetail}
          onToggle={toggleExpand}
        />
      )}

      {internal.length > 0 && (
        <PlaydateGroup
          label="internal-only"
          description="pack-gated or hidden — only visible to entitled users"
          playdates={internal}
          expandedId={expandedId}
          detailCache={detailCache}
          loadingDetail={loadingDetail}
          onToggle={toggleExpand}
        />
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no playdates match the current filter.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── PlaydateGroup ──────────────────────────────────────────────── */

function PlaydateGroup({
  label,
  description,
  playdates,
  expandedId,
  detailCache,
  loadingDetail,
  onToggle,
}: {
  label: string;
  description: string;
  playdates: Playdate[];
  expandedId: string | null;
  detailCache: Record<string, PlaydateDetail>;
  loadingDetail: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-1">
        {label}
        <span className="text-sm font-normal text-cadet/50 ml-2">
          ({playdates.length} — {description})
        </span>
      </h2>
      <div className="space-y-2 mt-3">
        {playdates.map((p) => (
          <AdminPlaydateCard
            key={p.id}
            playdate={p}
            isExpanded={expandedId === p.id}
            detail={detailCache[p.id] ?? null}
            isLoading={loadingDetail === p.id}
            onToggle={() => onToggle(p.id)}
          />
        ))}
      </div>
    </section>
  );
}

/* ── AdminPlaydateCard ──────────────────────────────────────────── */

function AdminPlaydateCard({
  playdate: p,
  isExpanded,
  detail,
  isLoading,
  onToggle,
}: {
  playdate: Playdate;
  isExpanded: boolean;
  detail: PlaydateDetail | null;
  isLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-lg border transition-colors"
      style={{
        borderColor: isExpanded ? "var(--wv-sienna)" : "var(--cw-border, #e5e7eb)",
        backgroundColor: isExpanded ? "var(--cw-card-bg, #fafaf9)" : "transparent",
      }}
    >
      {/* ── card header (always visible) ─────────────────────── */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        {/* cover thumbnail */}
        {p.cover_url ? (
          <img
            src={p.cover_url}
            alt=""
            className="w-10 h-10 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-cadet/5 flex-shrink-0" />
        )}

        {/* title + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{p.title}</span>
            {p.tinkering_tier && (
              <span className="text-[10px] text-cadet/40 bg-cadet/5 rounded px-1.5 py-0.5 flex-shrink-0">
                {p.tinkering_tier}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-cadet/40">
            {p.primary_function && <span>{p.primary_function}</span>}
            {p.run_count > 0 && (
              <span>{p.run_count} run{p.run_count !== 1 ? "s" : ""}</span>
            )}
            {p.material_count > 0 && (
              <span>
                {p.material_count} material{p.material_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* completeness dots */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Dot ok={p.has_find} label="find" />
          <Dot ok={p.has_fold} label="fold" />
          <Dot ok={p.has_unfold} label="unfold" />
          <Dot ok={p.has_body} label="body" />
          <Dot ok={p.has_illustration} label="illustration" />
        </div>

        {/* expand chevron */}
        <span
          className="text-cadet/30 text-sm flex-shrink-0 transition-transform duration-200"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▸
        </span>
      </button>

      {/* ── expanded detail panel ─────────────────────────────── */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--cw-border, #e5e7eb)" }}>
          {isLoading && !detail && (
            <div className="py-6 text-center text-xs text-cadet/40">
              loading content preview…
            </div>
          )}

          {detail && <PlaydateDetailPanel detail={detail} />}

          {!isLoading && !detail && (
            <div className="py-6 text-center text-xs text-cadet/40">
              failed to load detail — try collapsing and re-expanding.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Dot (completeness indicator) ───────────────────────────────── */

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${ok ? "present" : "missing"}`}
      className="inline-block w-2 h-2 rounded-full"
      style={{
        backgroundColor: ok ? "#16a34a" : "#d1d5db",
      }}
    />
  );
}

/* ── PlaydateDetailPanel ────────────────────────────────────────── */

function PlaydateDetailPanel({ detail: d }: { detail: PlaydateDetail }) {
  return (
    <div className="space-y-5 pt-4 text-sm">
      {/* ── admin metadata row ───────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-[11px] text-cadet/40">
        {d.notion_id && (
          <a
            href={`https://notion.so/${d.notion_id.replace(/-/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-cadet/60"
          >
            open in notion
          </a>
        )}
        {d.synced_at && (
          <span>synced {new Date(d.synced_at).toLocaleDateString()}</span>
        )}
        {d.notion_last_edited && (
          <span>
            edited in notion{" "}
            {new Date(d.notion_last_edited).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* ── illustration ─────────────────────────────────────── */}
      {d.illustration_url && (
        <ContentSection label="illustration">
          <img
            src={d.illustration_url}
            alt="playdate illustration"
            className="max-w-xs rounded-lg border border-cadet/10"
          />
        </ContentSection>
      )}

      {/* ── find / fold / unfold ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ContentSection label="find">
          {d.find_html ? (
            <SafeHtml
              html={d.find_html}
              fallback={d.find || "—"}
              as="div"
              className="cms-body text-xs"
            />
          ) : (
            <Empty />
          )}
        </ContentSection>
        <ContentSection label="fold">
          {d.fold_html ? (
            <SafeHtml
              html={d.fold_html}
              fallback={d.fold || "—"}
              as="div"
              className="cms-body text-xs"
            />
          ) : (
            <Empty />
          )}
        </ContentSection>
        <ContentSection label="unfold">
          {d.unfold_html ? (
            <SafeHtml
              html={d.unfold_html}
              fallback={d.unfold || "—"}
              as="div"
              className="cms-body text-xs"
            />
          ) : (
            <Empty />
          )}
        </ContentSection>
      </div>

      {/* ── find-again ───────────────────────────────────────── */}
      {d.find_again_mode && (
        <ContentSection label={`find-again (${d.find_again_mode})`}>
          {d.find_again_prompt_html ? (
            <SafeHtml
              html={d.find_again_prompt_html}
              fallback={d.find_again_prompt || "—"}
              as="div"
              className="cms-body text-xs"
            />
          ) : (
            <span className="text-xs text-cadet/40">
              {d.find_again_prompt || "no prompt text"}
            </span>
          )}
        </ContentSection>
      )}

      {/* ── substitutions ────────────────────────────────────── */}
      {(d.substitutions_notes || d.substitutions_notes_html) && (
        <ContentSection label="substitutions">
          <SafeHtml
            html={d.substitutions_notes_html}
            fallback={d.substitutions_notes || "—"}
            as="div"
            className="cms-body text-xs"
          />
        </ContentSection>
      )}

      {/* ── body ─────────────────────────────────────────────── */}
      {d.body_html && (
        <ContentSection label="body (from notion blocks)">
          <SafeHtml
            html={d.body_html}
            fallback="—"
            as="div"
            className="cms-body text-xs max-h-64 overflow-y-auto"
          />
        </ContentSection>
      )}

      {/* ── materials ────────────────────────────────────────── */}
      {d.materials.length > 0 && (
        <ContentSection label={`materials (${d.materials.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {d.materials.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full bg-cadet/5 px-2.5 py-1 text-xs text-cadet/70"
              >
                {m.emoji && <span>{m.emoji}</span>}
                {m.title}
                {m.form_primary && (
                  <span className="text-cadet/30">({m.form_primary})</span>
                )}
              </span>
            ))}
          </div>
        </ContentSection>
      )}

      {/* ── design notes (collective-tier metadata) ──────────── */}
      {(d.design_rationale || d.developmental_notes || d.author_notes) && (
        <ContentSection label="design notes">
          <div className="space-y-2">
            {d.design_rationale && (
              <NoteBlock heading="design rationale" text={d.design_rationale} />
            )}
            {d.developmental_notes && (
              <NoteBlock heading="developmental notes" text={d.developmental_notes} />
            )}
            {d.author_notes && (
              <NoteBlock heading="author notes" text={d.author_notes} />
            )}
          </div>
        </ContentSection>
      )}
    </div>
  );
}

/* ── helper components ──────────────────────────────────────────── */

function ContentSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-cadet/40 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <span className="text-xs italic text-cadet/30">not set</span>
  );
}

function NoteBlock({ heading, text }: { heading: string; text: string }) {
  return (
    <div className="rounded bg-cadet/5 px-3 py-2">
      <p className="text-[10px] font-medium text-cadet/40 mb-0.5">{heading}</p>
      <p className="text-xs text-cadet/60 whitespace-pre-wrap">{text}</p>
    </div>
  );
}
