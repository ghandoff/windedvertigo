#!/usr/bin/env node
// C1 deliverability seed test — phase 2 (watch).
// Polls Resend per-message status for a campaign created by c1-seed-send.mjs.
// On red (bounce >2% or complaint >0.1%) posts to wv-claw via WV_CLAW_WEBHOOK.
// Default cadence: every 30 min for 48h, then emit a final markdown report.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    campaign: { type: "string" },
    once: { type: "boolean", default: false },
    "report-dir": { type: "string", default: "docs/runbooks" },
  },
});

if (!values.campaign) {
  console.error("usage: node scripts/c1-seed-watch.mjs --campaign=<name> [--once]");
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error("missing RESEND_API_KEY in env");
  process.exit(1);
}

const statePath = join(homedir(), ".config/wv-agent", `${values.campaign}.json`);
if (!existsSync(statePath)) {
  console.error(`no state file at ${statePath} — has the send phase run?`);
  process.exit(1);
}

const POLL_MS = 30 * 60 * 1000;
const DURATION_MS = 48 * 60 * 60 * 1000;

const collect = async () => {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const sends = state.sends.filter((s) => s.id);

  const overall = { delivered: 0, bounced: 0, complained: 0, sent: 0, queued: 0, other: 0 };
  const byProvider = {};

  for (const s of sends) {
    const res = await fetch(`https://api.resend.com/emails/${s.id}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) {
      console.error(`lookup ${s.id} failed: ${res.status}`);
      continue;
    }
    const detail = await res.json();
    // Resend reports `last_event` as the most recent terminal event; fall back
    // to top-level `status` for older API responses.
    const status = detail.last_event ?? detail.status ?? "other";
    overall[status] = (overall[status] ?? 0) + 1;
    byProvider[s.provider] ??= { delivered: 0, bounced: 0, complained: 0, total: 0 };
    byProvider[s.provider].total++;
    if (status === "delivered") byProvider[s.provider].delivered++;
    if (status === "bounced") byProvider[s.provider].bounced++;
    if (status === "complained") byProvider[s.provider].complained++;
  }

  return { sends, overall, byProvider };
};

const fmt = ({ overall, byProvider, sends }) => {
  const lines = [];
  lines.push(`=== ${values.campaign} @ ${new Date().toISOString()} ===`);
  lines.push(`overall: ${JSON.stringify(overall)}`);
  for (const [p, st] of Object.entries(byProvider)) {
    const rate = st.total ? ((st.delivered / st.total) * 100).toFixed(1) : "–";
    const flags = [
      st.bounced ? `✗${st.bounced} bounced` : "",
      st.complained ? `⚠${st.complained} complained` : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`  ${p.padEnd(8)} ${st.delivered}/${st.total} delivered (${rate}%) ${flags}`);
  }
  return { text: lines.join("\n"), bounceRate: overall.bounced / sends.length, complaintRate: overall.complained / sends.length };
};

const maybeAlert = async ({ bounceRate, complaintRate }) => {
  if (bounceRate <= 0.02 && complaintRate <= 0.001) return;
  if (!process.env.WV_CLAW_WEBHOOK) {
    console.warn("threshold breached but WV_CLAW_WEBHOOK not set — skipping slack post");
    return;
  }
  const msg = [
    `🚨 \`${values.campaign}\` deliverability red`,
    `bounce: ${(bounceRate * 100).toFixed(2)}% (threshold 2%)`,
    `complaint: ${(complaintRate * 100).toFixed(3)}% (threshold 0.1%)`,
  ].join("\n");
  try {
    await fetch(process.env.WV_CLAW_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    });
  } catch (err) {
    console.error(`slack post failed: ${err.message}`);
  }
};

const writeReport = (snapshot) => {
  const { overall, byProvider, sends } = snapshot;
  const stamp = new Date().toISOString().slice(0, 10);
  const path = resolve(process.cwd(), values["report-dir"], `${values.campaign}-results.md`);
  const rows = Object.entries(byProvider).map(([p, st]) => {
    const rate = st.total ? ((st.delivered / st.total) * 100).toFixed(1) : "–";
    return `| ${p} | ${st.total} | ${st.delivered} (${rate}%) | ${st.bounced} | ${st.complained} |`;
  });
  const md = [
    `# ${values.campaign} — deliverability seed results`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Sends: ${sends.length}`,
    "",
    `Overall: ${JSON.stringify(overall)}`,
    "",
    "| Provider | Total | Delivered | Bounced | Complained |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `Stamp: ${stamp}`,
  ].join("\n");
  writeFileSync(path, md);
  console.log(`\nfinal report: ${path}`);
};

if (values.once) {
  const snap = await collect();
  const f = fmt(snap);
  console.log(f.text);
  await maybeAlert(f);
  process.exit(0);
}

const start = Date.now();
let lastSnap;
while (Date.now() - start < DURATION_MS) {
  lastSnap = await collect();
  const f = fmt(lastSnap);
  console.log(f.text);
  await maybeAlert(f);
  await new Promise((r) => setTimeout(r, POLL_MS));
}

console.log("\n=== final pass ===");
lastSnap = await collect();
console.log(fmt(lastSnap).text);
writeReport(lastSnap);
