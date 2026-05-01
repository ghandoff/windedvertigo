/**
 * Pure probe logic — Workers-native, no Node-only APIs.
 * Mirrors the evaluation logic in `scripts/launch-smoke.mjs` so the CLI
 * and the scheduled Worker make the same green/red calls.
 *
 * Imported by `index.ts` (the Worker entry) and `probes.test.ts` (vitest).
 */

export type ExpectStatus = number | number[] | "ok-status";

export type Target = readonly [
  label: string,
  url: string,
  expect: ExpectStatus,
];

export interface ProbeResult {
  ok: boolean;
  status: number;
  elapsed: number;
  reason?: string;
  headers: Record<string, string>;
  bodySample: string;
}

export interface Evaluation {
  label: string;
  url: string;
  status: number;
  elapsed: number;
  red: boolean;
  slow: boolean;
  reasons: string[];
}

/* ── tunables ─────────────────────────────────────────────────────────── */

export const RETRY_COUNT = 3;
export const RETRY_DELAY_MS = 10_000;
export const TIMEOUT_MS = 15_000;
export const SLOW_THRESHOLD_MS = 2_000;

/* ── target inventory ─────────────────────────────────────────────────── */

const HARBOUR_APPS = [
  "creaseworks",
  "vertigo-vault",
  "deep-deck",
  "depth-chart",
  "raft-house",
  "tidal-pool",
  "paper-trail",
  "mirror-log",
  "orbit-lab",
  "proof-garden",
  "bias-lens",
  "scale-shift",
  "pattern-weave",
  "market-mind",
  "rhythm-lab",
  "code-weave",
  "time-prism",
  "liminal-pass",
  "emerge-box",
  "rubric-co-builder",
  "cuts-catalogue",
  "feel-cards",
  "values-auction",
  "three-intelligence-workbook",
] as const;

export const TARGETS: readonly Target[] = [
  // ── site root + structural redirects ───────────────────────────────
  ["site apex", "https://windedvertigo.com", [200, 301, 308]],
  ["site www", "https://www.windedvertigo.com", 200],
  ["site portfolio", "https://www.windedvertigo.com/portfolio", [200, 308]],
  ["crm path-redirect", "https://www.windedvertigo.com/crm", 308],

  // ── harbour hub ────────────────────────────────────────────────────
  ["harbour hub", "https://www.windedvertigo.com/harbour", 200],
  ["harbour skills", "https://www.windedvertigo.com/harbour/skills", 200],
  ["harbour prowl", "https://www.windedvertigo.com/harbour/prowl", 200],
  [
    "harbour thread-pull",
    "https://www.windedvertigo.com/harbour/thread-pull",
    200,
  ],

  // ── nested harbour apps (each tile entry) ──────────────────────────
  ...HARBOUR_APPS.map(
    (slug): Target => [
      `harbour/${slug}`,
      `https://www.windedvertigo.com/harbour/${slug}`,
      [200, 301, 302, 307, 308, 401, 403],
    ],
  ),

  // ── auth surface ───────────────────────────────────────────────────
  [
    "creaseworks /api/auth/csrf",
    "https://www.windedvertigo.com/harbour/creaseworks/api/auth/csrf",
    200,
  ],
  [
    "vault /api/auth/csrf",
    "https://windedvertigo.com/harbour/vertigo-vault/api/auth/csrf",
    200,
  ],
  [
    "depth-chart /api/auth/csrf",
    "https://windedvertigo.com/harbour/depth-chart/api/auth/csrf",
    200,
  ],
  [
    "port /api/auth/csrf",
    "https://port.windedvertigo.com/api/auth/csrf",
    200,
  ],
  ["ops /api/auth/csrf", "https://ops.windedvertigo.com/api/auth/csrf", 200],

  // ── admin endpoint (must NOT return 200 unauth) ────────────────────
  [
    "sync-tiles unauth",
    "https://www.windedvertigo.com/harbour/api/admin/sync-tiles",
    [401, 403, 405],
  ],

  // ── port + ops origins (auth.js redirects unauth GET) ──────────────
  ["port root", "https://port.windedvertigo.com", [200, 302, 307]],
  ["ops root", "https://ops.windedvertigo.com", [200, 302, 307]],
];

/* ── probe primitives ─────────────────────────────────────────────────── */

export async function probeOnce(url: string): Promise<ProbeResult> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LaunchSmoke/1.0)",
      },
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      elapsed: Math.round(performance.now() - t0),
      reason: `fetch error: ${(e as Error).message?.slice(0, 80) ?? String(e)}`,
      headers: {},
      bodySample: "",
    };
  }
  const elapsed = Math.round(performance.now() - t0);
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  let bodySample = "";
  if (res.status >= 200 && res.status < 300) {
    try {
      const text = await res.text();
      bodySample = text.slice(0, 8192);
    } catch {
      bodySample = "";
    }
  }
  return { ok: true, status: res.status, elapsed, headers, bodySample };
}

function statusMatches(status: number, expect: ExpectStatus): boolean {
  if (expect === "ok-status") return status >= 200 && status < 400;
  if (Array.isArray(expect)) return expect.includes(status);
  return status === expect;
}

export function evaluate(target: Target, probe: ProbeResult): Evaluation {
  const [label, url, expect] = target;
  const reasons: string[] = [];

  if (!probe.ok) {
    reasons.push(probe.reason ?? "fetch failed");
    return {
      label,
      url,
      status: probe.status,
      elapsed: probe.elapsed,
      red: true,
      slow: false,
      reasons,
    };
  }

  if (!statusMatches(probe.status, expect)) {
    reasons.push(
      `expected ${
        Array.isArray(expect) ? expect.join("|") : expect
      }, got ${probe.status}`,
    );
  }
  if (probe.headers["x-vercel-error"]) {
    reasons.push(`x-vercel-error: ${probe.headers["x-vercel-error"]}`);
  }
  if (
    probe.bodySample &&
    /could not route to the requested URL|Worker threw exception|<title>Error 5\d\d/i.test(
      probe.bodySample,
    )
  ) {
    reasons.push("body contains error marker");
  }

  const contentType = probe.headers["content-type"] ?? "";
  const is2xxHtml =
    probe.status >= 200 &&
    probe.status < 300 &&
    contentType.startsWith("text/html");
  if (is2xxHtml && probe.bodySample && !/<title[\s>]/i.test(probe.bodySample)) {
    reasons.push("html response missing <title>");
  }
  if (probe.elapsed > SLOW_THRESHOLD_MS) {
    reasons.push(`slow: ${probe.elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`);
  }

  const slow = probe.elapsed > SLOW_THRESHOLD_MS;
  const nonSlowReasons = reasons.filter((r) => !r.startsWith("slow:"));
  return {
    label,
    url,
    status: probe.status,
    elapsed: probe.elapsed,
    red: nonSlowReasons.length > 0,
    slow,
    reasons,
  };
}

export async function probeWithRetry(target: Target): Promise<Evaluation> {
  let last: Evaluation | null = null;
  for (let i = 1; i <= RETRY_COUNT; i++) {
    const probe = await probeOnce(target[1]);
    const ev = evaluate(target, probe);
    if (!ev.red) return ev;
    last = ev;
    if (i < RETRY_COUNT) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  // Unreachable in practice (last assigned on every iteration), but keep
  // TypeScript happy.
  return (
    last ?? {
      label: target[0],
      url: target[1],
      status: 0,
      elapsed: 0,
      red: true,
      slow: false,
      reasons: ["probe loop exited without evaluation"],
    }
  );
}
