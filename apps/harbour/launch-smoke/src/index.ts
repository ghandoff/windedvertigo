/**
 * wv-launch-smoke — scheduled CF Worker that runs the harbour smoke harness
 * every 30 minutes and posts a digest to Slack on red.
 *
 * Mirrors the evaluation logic in `harbour-apps/scripts/launch-smoke.mjs`.
 * The CLI script and this Worker share `./probes.ts`, so a human running
 * the script locally and the cron Worker reach the same green/red verdicts.
 *
 * Bindings (configured in wrangler.jsonc + secrets):
 *   SMOKE_LATEST   — KV namespace; stores the most-recent run summary
 *   WV_CLAW_WEBHOOK (secret) — Slack incoming webhook URL; only required
 *                              for posting on red. Set with:
 *                              `wrangler secret put WV_CLAW_WEBHOOK`
 */

import { TARGETS, probeWithRetry, type Evaluation } from "./probes.js";

export interface Env {
  SMOKE_LATEST: KVNamespace;
  WV_CLAW_WEBHOOK?: string;
}

interface Summary {
  ranAt: string;
  totalMs: number;
  total: number;
  green: number;
  slow: number;
  red: number;
  results: Evaluation[];
}

async function runAllProbes(): Promise<Summary> {
  const t0 = Date.now();
  // Sequential — avoids a 39-fan-out spike that could trip rate limits on
  // shared infra (e.g. the same Vercel project hosting many harbour app
  // routes). Workers cron has 30s CPU but unbounded wall-clock for fetch
  // I/O, and 39 × ~500ms ≈ 20s is well under either ceiling.
  const results: Evaluation[] = [];
  for (const t of TARGETS) {
    results.push(await probeWithRetry(t));
  }
  const red = results.filter((r) => r.red).length;
  const slow = results.filter((r) => r.slow && !r.red).length;
  return {
    ranAt: new Date().toISOString(),
    totalMs: Date.now() - t0,
    total: results.length,
    green: results.length - red,
    slow,
    red,
    results,
  };
}

function formatDigest(summary: Summary): string {
  const reds = summary.results.filter((r) => r.red);
  const lines = [
    `:rotating_light: harbour smoke — ${summary.green}/${summary.total} green, ${summary.red} red, ${summary.slow} slow (${summary.ranAt})`,
    ...reds.map((r) => `• *${r.label}* ${r.status} — ${r.reasons.join("; ")}`),
  ];
  return lines.join("\n");
}

async function postDigest(webhook: string, summary: Summary): Promise<void> {
  await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: formatDigest(summary) }),
  });
}

export default {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const summary = await runAllProbes();
    ctx.waitUntil(
      env.SMOKE_LATEST.put("latest", JSON.stringify(summary), {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
      }),
    );
    if (summary.red > 0 && env.WV_CLAW_WEBHOOK) {
      ctx.waitUntil(postDigest(env.WV_CLAW_WEBHOOK, summary));
    }
  },

  async fetch(_req: Request, env: Env): Promise<Response> {
    const raw = await env.SMOKE_LATEST.get("latest");
    if (!raw) {
      return new Response(JSON.stringify({ error: "no smoke run yet" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(raw, {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  },
} satisfies ExportedHandler<Env>;
