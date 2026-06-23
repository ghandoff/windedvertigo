/**
 * Custom (non-HTTP-probe) health checkers for tiers 2-4, keyed by service id.
 *
 * Contract: a checker returns green/amber/red with timing + details, or
 * status "skipped" (missing credential / not in a workers context). Skipped
 * results are reported in the run summary but NOT stored and never open
 * incidents. Checkers must not throw — wrap everything.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { supabase } from "@/lib/supabase/client";
import "@/lib/cf-env";

export interface CustomCheckResult {
  status: "green" | "amber" | "red" | "skipped";
  response_time_ms: number | null;
  /** human-readable problem description, used as incident symptoms */
  symptoms?: string;
  details: Record<string, unknown>;
}

type Checker = () => Promise<CustomCheckResult>;

const R2_EVIDENCE_PUBLIC_URL = "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev";

function skipped(reason: string): CustomCheckResult {
  return { status: "skipped", response_time_ms: null, details: { reason } };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const started = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - started, value };
  } catch (err) {
    return { ms: Date.now() - started, error: err instanceof Error ? err.message : "unknown error" };
  }
}

// ── tier 2: data layer ────────────────────────────────────────────────────────

/** wv-port-pilot: timed trivial query through the existing service client. */
async function checkSupabasePilot(): Promise<CustomCheckResult> {
  const r = await timed(async () => {
    const { error } = await supabase.from("opsy_memory").select("key").limit(1);
    if (error) throw new Error(error.message);
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `supabase wv-port-pilot query failed: ${r.error}`, details: { error: r.error } };
  }
  // 1500ms threshold: the wv-port-pilot pooler routinely grazes 1000-1400ms on
  // cold/pooled connections and self-recovers, which was firing ~daily noise
  // incidents (#27 in 90 days). 1500ms still catches genuine degradation. If
  // these recur above 1500ms, surface NEON_API_KEY to monitor neon-pools and
  // confirm whether it's connection-pool saturation.
  if (r.ms > 1500) {
    return { status: "amber", response_time_ms: r.ms, symptoms: `supabase wv-port-pilot slow: ${r.ms}ms query (threshold 1500ms)`, details: {} };
  }
  return { status: "green", response_time_ms: r.ms, details: {} };
}

/** port-assets R2 bucket via the native binding (a get of a missing key is a healthy round-trip). */
async function checkR2PortAssets(): Promise<CustomCheckResult> {
  let bucket: { get(k: string): Promise<unknown> } | undefined;
  try {
    const { env } = getCloudflareContext();
    bucket = (env as unknown as { PORT_ASSETS?: { get(k: string): Promise<unknown> } }).PORT_ASSETS;
  } catch {
    return skipped("not in a CF workers context (local dev)");
  }
  if (!bucket?.get) return skipped("PORT_ASSETS binding not present");

  const r = await timed(() => bucket!.get("opsy-probe"));
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `R2 port-assets binding error: ${r.error}`, details: { error: r.error } };
  }
  return { status: "green", response_time_ms: r.ms, details: {} };
}

/** creaseworks-evidence bucket via its public r2.dev URL — any HTTP answer < 500 means the bucket is serving. */
async function checkR2EvidencePublic(): Promise<CustomCheckResult> {
  const r = await timed(async () => {
    const res = await fetch(R2_EVIDENCE_PUBLIC_URL, { method: "GET", signal: AbortSignal.timeout(10_000) });
    await res.arrayBuffer().catch(() => undefined);
    return res.status;
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `creaseworks-evidence R2 public URL unreachable: ${r.error}`, details: { error: r.error } };
  }
  if ((r.value ?? 0) >= 500) {
    return { status: "red", response_time_ms: r.ms, symptoms: `creaseworks-evidence R2 public URL returning HTTP ${r.value}`, details: { status_code: r.value } };
  }
  return { status: "green", response_time_ms: r.ms, details: { status_code: r.value } };
}

// ── tier 3: external services ─────────────────────────────────────────────────

/** Notion API: timed users/me. Rate-limit proximity isn't exposed in headers, so latency + status only. */
async function checkNotionApi(): Promise<CustomCheckResult> {
  if (!process.env.NOTION_TOKEN) return skipped("awaiting credential: NOTION_TOKEN");
  const r = await timed(async () => {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
      signal: AbortSignal.timeout(10_000),
    });
    await res.arrayBuffer().catch(() => undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `Notion API check failed: ${r.error}`, details: { error: r.error } };
  }
  if (r.ms > 2000) {
    return { status: "amber", response_time_ms: r.ms, symptoms: `Notion API slow: ${r.ms}ms (threshold 2000ms)`, details: {} };
  }
  return { status: "green", response_time_ms: r.ms, details: {} };
}

/** Resend: GET /domains; amber if any sending domain isn't verified. */
async function checkResend(): Promise<CustomCheckResult> {
  if (!process.env.RESEND_API_KEY) return skipped("awaiting credential: RESEND_API_KEY");
  const r = await timed(async () => {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    return data.data ?? [];
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `Resend API check failed: ${r.error}`, details: { error: r.error } };
  }
  const unverified = (r.value ?? []).filter((d) => d.status !== "verified");
  if (unverified.length) {
    return {
      status: "amber",
      response_time_ms: r.ms,
      symptoms: `Resend domain auth not verified: ${unverified.map((d) => `${d.name} (${d.status})`).join(", ")}`,
      details: { unverified },
    };
  }
  return { status: "green", response_time_ms: r.ms, details: { domains: (r.value ?? []).length } };
}

// ── tier 4: security & compliance ─────────────────────────────────────────────

async function dohTxt(name: string): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  const data = (await res.json()) as { Answer?: Array<{ data: string }> };
  return (data.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
}

/** SPF + DMARC presence for windedvertigo.com via DNS-over-HTTPS. (DKIM selector unknown — not checked yet.) */
async function checkDnsRecords(): Promise<CustomCheckResult> {
  const r = await timed(async () => {
    const [root, dmarc] = await Promise.all([
      dohTxt("windedvertigo.com"),
      dohTxt("_dmarc.windedvertigo.com"),
    ]);
    return {
      spf: root.some((t) => t.startsWith("v=spf1")),
      dmarc: dmarc.some((t) => t.toUpperCase().startsWith("V=DMARC1")),
    };
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `DNS health check failed: ${r.error}`, details: { error: r.error } };
  }
  const missing = [!r.value!.spf && "SPF", !r.value!.dmarc && "DMARC"].filter(Boolean);
  if (missing.length) {
    return {
      status: "red",
      response_time_ms: r.ms,
      symptoms: `email auth DNS records missing for windedvertigo.com: ${missing.join(", ")}`,
      details: r.value as Record<string, unknown>,
    };
  }
  return { status: "green", response_time_ms: r.ms, details: r.value as Record<string, unknown> };
}

/** Every public table in wv-port-pilot must have RLS enabled (opsy_rls_report RPC, service-role only). */
async function checkSupabaseRls(): Promise<CustomCheckResult> {
  const r = await timed(async () => {
    const { data, error } = await supabase.rpc("opsy_rls_report");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ table_name: string; rls_enabled: boolean }>;
  });
  if (r.error) {
    return { status: "red", response_time_ms: r.ms, symptoms: `RLS audit failed to run: ${r.error}`, details: { error: r.error } };
  }
  const disabled = (r.value ?? []).filter((t) => !t.rls_enabled).map((t) => t.table_name);
  if (disabled.length) {
    const shown = disabled.slice(0, 10).join(", ");
    return {
      status: "red",
      response_time_ms: r.ms,
      symptoms: `RLS disabled on ${disabled.length} public table(s) in wv-port-pilot: ${shown}${disabled.length > 10 ? ", …" : ""}`,
      details: { disabled },
    };
  }
  return { status: "green", response_time_ms: r.ms, details: { tables_audited: (r.value ?? []).length } };
}

// ── presence-gated stubs (implementations land when credentials exist) ────────

function stub(envVars: string[]): Checker {
  return async () => {
    const missing = envVars.filter((v) => !process.env[v]);
    if (missing.length) return skipped(`awaiting credential: ${missing.join(", ")}`);
    return skipped("credential present — checker implementation pending (phase 2.5)");
  };
}

export const CHECKERS: Record<string, Checker> = {
  "supabase-pilot": checkSupabasePilot,
  "r2-port-assets": checkR2PortAssets,
  "r2-evidence-public": checkR2EvidencePublic,
  "notion-api": checkNotionApi,
  resend: checkResend,
  "dns-records": checkDnsRecords,
  "supabase-rls": checkSupabaseRls,
  // unlock list — add the secret to the worker and the check activates a slot
  "supabase-nordic": stub(["SUPABASE_NORDIC_URL", "SUPABASE_NORDIC_SECRET_KEY"]),
  "neon-pools": stub(["NEON_API_KEY"]),
  "vercel-deployments": stub(["VERCEL_API_TOKEN"]),
  "github-actions": stub(["GITHUB_TOKEN"]),
  "cf-worker-analytics": stub(["CLOUDFLARE_API_TOKEN"]),
  "stripe-webhooks": stub(["STRIPE_SECRET_KEY"]),
};
