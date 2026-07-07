"use client";

/**
 * Architecture map — a curated, living picture of the winded.vertigo estate:
 * how the twin repos (consulting arm ↔ product arm) are SEPARATE and what they
 * SHARE, with per-node tags for stack + data store.
 *
 * Dependency-free by design (the port has no graph library — see sparkline.tsx).
 * The estate is small and fixed, so a hand-curated, grouped layout reads far
 * better than an auto-laid-out force graph (which turns into a hairball past a
 * few dozen nodes — the Nx-graph lesson). Data lives in ARCH below; edit it as
 * the estate changes. Last verified 2026-07-07.
 *
 * One bit of interactivity: click a data store (or external service) to light
 * up every app it backs — the "blast radius" view.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

type NodeType = "app" | "package" | "resource" | "external";

interface ArchNode {
  id: string;
  label: string;
  type: NodeType;
  stack?: string[]; // runtime/framework tags
  uses?: string[]; // ids of resources/externals it depends on (blast-radius links)
  note?: string; // short qualifier (paying, personal, SSO…)
  tone?: "paying" | "personal" | "flagship" | "shared" | "collision";
}

/* ── the curated estate ─────────────────────────────────────────────────── */

const WV_APPS: ArchNode[] = [
  { id: "site", label: "site", type: "app", stack: ["Next.js", "CF Worker", "OpenNext"], uses: ["notion", "kv", "tokens"], note: "marketing + harbour landing" },
  { id: "port", label: "port", type: "app", stack: ["Next.js", "CF Worker", "OpenNext"], uses: ["port-pilot", "anthropic", "slack", "resend", "notion", "wv-auth", "tokens"], note: "CRM/PM + 4 agents", tone: "flagship" },
  { id: "ops", label: "ops (Opsy)", type: "app", stack: ["Next.js"], uses: ["port-pilot", "wv-auth", "tokens"], note: "ops intelligence" },
  { id: "ppcs", label: "ppcs-impact", type: "app", stack: ["Next.js", "CF", "D1"], uses: ["d1", "tokens"], note: "engagement dashboard" },
  { id: "nordic", label: "nordic-sqr-rct", type: "app", stack: ["Next.js", "CF Pages"], uses: ["nordic-db"], note: "research trial" },
];

const WV_PKGS: ArchNode[] = [
  { id: "wv-auth", label: "@wv/auth", type: "package", stack: ["157 LOC", "NextAuth"], note: "internal shim · port + ops", tone: "collision" },
  { id: "wv-tokens", label: "@wv/tokens", type: "package", stack: ["design tokens"], note: "← adopts harbour superset", tone: "shared" },
  { id: "wv-notion", label: "@wv/notion", type: "package", note: "CMS adapter" },
  { id: "wv-booking", label: "@wv/booking", type: "package", uses: ["booking-db"], note: "server-side booking" },
  { id: "wv-misc", label: "email-templates · job-queue · motion-kit", type: "package", note: "supporting libs" },
];

const HARBOUR_FLAGSHIP: ArchNode[] = [
  { id: "creaseworks", label: "creaseworks", type: "app", stack: ["Next.js", "CF Worker", "OpenNext"], uses: ["r2", "d1", "sso", "anthropic", "h-auth", "harbour-tokens"], note: "kid system-of-play", tone: "flagship" },
  { id: "vertigo-vault", label: "vertigo-vault", type: "app", stack: ["Next.js", "CF Worker"], uses: ["stripe", "sso", "h-auth", "harbour-tokens"], note: "subscriptions", tone: "paying" },
  { id: "depth-chart", label: "depth-chart", type: "app", stack: ["Next.js", "CF Worker"], uses: ["anthropic", "sso", "h-auth", "harbour-tokens"] },
  { id: "raft-house", label: "raft-house", type: "app", stack: ["Next.js", "CF Worker"], uses: ["sso", "h-auth", "harbour-tokens"] },
  { id: "harbour", label: "harbour (hub)", type: "app", stack: ["Next.js", "CF Worker"], uses: ["sso", "h-auth", "harbour-tokens"], note: "suite landing + nav" },
  { id: "values-auction", label: "values-auction", type: "app", stack: ["CF Pages"], uses: ["h-auth"], note: "CI auto-deploy" },
  { id: "read-the-room", label: "read-the-room", type: "app", stack: ["Next.js", "CF Worker"], uses: ["sso", "h-auth", "harbour-tokens"] },
];

const HARBOUR_GROUPED: ArchNode[] = [
  { id: "threshold", label: "threshold-concept apps ×15", type: "app", stack: ["Next.js", "CF Worker"], uses: ["sso", "h-auth", "harbour-tokens"], note: "bias-lens, code-weave, tidal-pool, time-prism, …" },
  { id: "tools", label: "tools & experiments ×8", type: "app", stack: ["CF Worker"], uses: ["h-auth"], note: "rubric-co-builder, role-dice, feel-cards, harbour-nav-cdn, …" },
];

const HARBOUR_PKGS: ArchNode[] = [
  { id: "h-auth", label: "@wv/auth (harbour)", type: "package", stack: ["1801 LOC", "SSO + nav"], note: "CollectiveDrawer · ~20 apps", tone: "collision" },
  { id: "harbour-tokens", label: "@wv/tokens (harbour)", type: "package", stack: ["design tokens"], note: "canonical superset →", tone: "shared" },
  { id: "h-misc", label: "characters · feedback · security · stripe · notion-adapter · sync-images", type: "package", note: "product libs" },
];

const HOBBIES: ArchNode[] = [
  { id: "ancestry", label: "ancestry", type: "app", stack: ["Next.js", "CF Worker", "OpenNext"], uses: ["port-pilot", "ancestry-sso", "anthropic", "r2"], note: "genealogy · own repo", tone: "personal" },
  { id: "amy-messages", label: "amy-messages", type: "app", stack: ["CF Worker"], note: "personal · standalone", tone: "personal" },
];

const RESOURCES: ArchNode[] = [
  { id: "port-pilot", label: "Supabase · wv-port-pilot", type: "resource", note: "port + ancestry (pooler host)" },
  { id: "booking-db", label: "Supabase · wv-booking", type: "resource", note: "booking PII · RLS locked" },
  { id: "nordic-db", label: "Supabase · wv-nordic", type: "resource", note: "research pool" },
  { id: "d1", label: "Cloudflare D1", type: "resource", note: "creaseworks-eval / mini · ppcs" },
  { id: "r2", label: "Cloudflare R2", type: "resource", note: "creaseworks-evidence · port-assets" },
  { id: "kv", label: "Cloudflare KV", type: "resource", note: "ISR incremental cache" },
];

const EXTERNAL: ArchNode[] = [
  { id: "sso", label: "Google SSO (shared)", type: "external", note: '"creaseworks" client · most apps' },
  { id: "ancestry-sso", label: "Google SSO (ancestry)", type: "external", note: "own client · decoupled" },
  { id: "notion", label: "Notion", type: "external", note: "CMS" },
  { id: "resend", label: "Resend", type: "external", note: "email" },
  { id: "anthropic", label: "Anthropic", type: "external", note: "per-app keys" },
  { id: "slack", label: "Slack", type: "external", note: "agents" },
  { id: "stripe", label: "Stripe", type: "external", note: "vault payments" },
];

/* ── styling helpers ────────────────────────────────────────────────────── */

const TONE_RING: Record<NonNullable<ArchNode["tone"]>, string> = {
  paying: "ring-1 ring-emerald-500/40",
  personal: "ring-1 ring-violet-500/40",
  flagship: "ring-1 ring-sky-500/40",
  shared: "ring-1 ring-amber-500/50",
  collision: "ring-1 ring-rose-500/40",
};

const TONE_DOT: Record<NonNullable<ArchNode["tone"]>, string> = {
  paying: "bg-emerald-500",
  personal: "bg-violet-500",
  flagship: "bg-sky-500",
  shared: "bg-amber-500",
  collision: "bg-rose-500",
};

function Chip({ children, kind }: { children: React.ReactNode; kind: "stack" | "note" }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] leading-tight",
        kind === "stack" ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ── the map ────────────────────────────────────────────────────────────── */

export function ArchitectureMap() {
  const [lit, setLit] = useState<string | null>(null);

  function NodeCard({ n }: { n: ArchNode }) {
    const isLit = lit != null && (n.id === lit || (n.uses ?? []).includes(lit));
    const dim = lit != null && !isLit;
    const clickable = n.type === "resource" || n.type === "external";
    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && setLit(lit === n.id ? null : n.id)}
        className={cn(
          "w-full rounded-md border border-border bg-card px-2.5 py-2 text-left transition-all",
          n.tone && TONE_RING[n.tone],
          isLit && "ring-2 ring-primary shadow-sm",
          dim && "opacity-40",
          clickable && "cursor-pointer hover:border-primary/50",
        )}
      >
        <div className="flex items-center gap-1.5">
          {n.tone && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[n.tone])} />}
          <span className="text-xs font-medium">{n.label}</span>
        </div>
        {(n.stack?.length || n.note) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {n.stack?.map((s) => (
              <Chip key={s} kind="stack">
                {s}
              </Chip>
            ))}
            {n.note && <Chip kind="note">{n.note}</Chip>}
          </div>
        )}
      </button>
    );
  }

  const Group = ({ title, nodes, cols = 1 }: { title: string; nodes: ArchNode[]; cols?: number }) => (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className={cn("grid gap-1.5", cols === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
        {nodes.map((n) => (
          <NodeCard key={n.id} n={n} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* header + legend */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">estate map — twin repos: what&apos;s separate, what&apos;s shared</h2>
          <span className="text-[11px] text-muted-foreground">curated · last verified 2026-07-07</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Legend dot="bg-sky-500" label="flagship" />
          <Legend dot="bg-emerald-500" label="paying" />
          <Legend dot="bg-violet-500" label="personal" />
          <Legend dot="bg-amber-500" label="shared concern" />
          <Legend dot="bg-rose-500" label="name collision" />
          <span className="text-muted-foreground/70">tip: click a data store or service to light up what it backs</span>
        </div>
      </div>

      {/* the two arms + the shared bridge */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* consulting arm */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">windedvertigo</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">consulting arm · monorepo</span>
          </div>
          <div className="space-y-3">
            <Group title="apps" nodes={WV_APPS} />
            <Group title="packages" nodes={WV_PKGS} />
          </div>
        </div>

        {/* shared bridge */}
        <div className="flex flex-col items-center justify-center gap-2 lg:w-36">
          <div className="w-full rounded-lg border border-amber-500/40 bg-amber-500/5 px-2 py-3 text-center">
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">SHARED</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">@wv/tokens</span>
              <br />
              design system — harbour is canonical superset; wv adopts it
            </div>
          </div>
          <div className="w-full rounded-lg border border-rose-500/40 bg-rose-500/5 px-2 py-3 text-center">
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">NAME COLLISION</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              both ship <span className="font-medium text-foreground">@wv/auth</span> — different code, latent clash. Fix: rename harbour&apos;s → <span className="font-medium text-foreground">@wv/harbour-auth</span>
            </div>
          </div>
        </div>

        {/* product arm */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">harbour-apps</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">product arm · authoritative source</span>
          </div>
          <div className="space-y-3">
            <Group title="flagship + core apps" nodes={HARBOUR_FLAGSHIP} cols={2} />
            <Group title="app families" nodes={HARBOUR_GROUPED} />
            <Group title="packages" nodes={HARBOUR_PKGS} />
          </div>
        </div>
      </div>

      {/* hobbies */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold">hobbies/</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">personal · standalone repos</span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {HOBBIES.map((n) => (
            <NodeCard key={n.id} n={n} />
          ))}
        </div>
      </div>

      {/* data layer + external */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">data layer</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RESOURCES.map((n) => (
              <NodeCard key={n.id} n={n} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">external services</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {EXTERNAL.map((n) => (
              <NodeCard key={n.id} n={n} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
