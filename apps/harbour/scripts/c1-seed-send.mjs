#!/usr/bin/env node
// C1 deliverability seed test — phase 1 (send).
// Sends a transactional email per recipient via Resend, persists message ids
// for the watch script to poll. Recipients populated by garrett in
// scripts/c1-recipients.local.json (gitignored).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    campaign: { type: "string", default: `c1-seed-${new Date().toISOString().slice(0, 10)}` },
    "dry-run": { type: "boolean", default: false },
    recipients: { type: "string", default: "scripts/c1-recipients.local.json" },
    "min-per": { type: "string", default: "10" },
  },
});

if (!process.env.RESEND_API_KEY) {
  console.error("missing RESEND_API_KEY in env");
  console.error("source ~/.config/wv-agent/env.local then re-run");
  process.exit(1);
}

const recipientsPath = resolve(process.cwd(), values.recipients);
if (!existsSync(recipientsPath)) {
  console.error(`recipients file not found: ${recipientsPath}`);
  console.error("populate as JSON array of email addresses, eg.");
  console.error('  ["a@gmail.com", "b@yahoo.com", ...]');
  process.exit(1);
}

const recipients = JSON.parse(readFileSync(recipientsPath, "utf8"));
if (!Array.isArray(recipients) || recipients.length === 0) {
  console.error("recipients file must contain a non-empty JSON array");
  process.exit(1);
}

const providerOf = (email) => {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail";
  if (domain === "yahoo.com" || domain === "ymail.com") return "yahoo";
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return "icloud";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return "outlook";
  return "other";
};

const counts = recipients.reduce((acc, r) => {
  const p = providerOf(r);
  acc[p] = (acc[p] ?? 0) + 1;
  return acc;
}, {});

console.log(`recipients: ${recipients.length} total`);
for (const [p, n] of Object.entries(counts)) console.log(`  ${p}: ${n}`);

const minPer = Number(values["min-per"]);
const targetProviders = ["gmail", "yahoo", "icloud", "outlook"];
const present = targetProviders.filter((p) => (counts[p] ?? 0) > 0);
const underMin = present.filter((p) => counts[p] < minPer);
if (underMin.length) {
  console.error(`\nproviders below --min-per=${minPer}: ${underMin.join(", ")}`);
  process.exit(1);
}
const absent = targetProviders.filter((p) => !present.includes(p));
if (absent.length) {
  console.warn(`\n⚠ no addresses on: ${absent.join(", ")} — those providers won't be tested`);
}

const stateDir = join(homedir(), ".config/wv-agent");
const statePath = join(stateDir, `${values.campaign}.json`);
if (existsSync(statePath)) {
  console.error(`\ncampaign "${values.campaign}" already has a send log at ${statePath}`);
  console.error("pass --campaign=<new-name> to start a fresh run");
  process.exit(1);
}
mkdirSync(dirname(statePath), { recursive: true });

const from = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";
const sends = [];

for (let i = 0; i < recipients.length; i++) {
  const to = recipients[i];
  const idx = i + 1;
  const provider = providerOf(to);

  if (values["dry-run"]) {
    console.log(`[dry-run] ${idx}/${recipients.length} ${provider} ${to}`);
    sends.push({ idx, to, provider, dryRun: true, ts: new Date().toISOString() });
    continue;
  }

  const reqBody = {
    from,
    to,
    subject: `Harbour deliverability seed — ${values.campaign} #${idx}`,
    text: [
      "This is a one-time deliverability seed test for harbour's magic-link",
      "infrastructure. No action is required and no link is included.",
      "",
      `campaign: ${values.campaign}`,
      `recipient slot: ${idx} of ${recipients.length}`,
      "",
      "— garrett @ winded.vertigo",
    ].join("\n"),
    tags: [
      { name: "campaign", value: values.campaign },
      { name: "provider", value: provider },
    ],
  };

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
  } catch (err) {
    console.error(`✗ ${idx}/${recipients.length} ${to} → network error: ${err.message}`);
    sends.push({ idx, to, provider, error: String(err), ts: new Date().toISOString() });
    writeFileSync(statePath, JSON.stringify({ campaign: values.campaign, sends }, null, 2));
    continue;
  }

  const respJson = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`✗ ${idx}/${recipients.length} ${to} → ${res.status} ${JSON.stringify(respJson)}`);
    sends.push({
      idx,
      to,
      provider,
      error: respJson,
      status: res.status,
      ts: new Date().toISOString(),
    });
  } else {
    console.log(`✓ ${idx}/${recipients.length} ${provider.padEnd(7)} ${to} → ${respJson.id}`);
    sends.push({ idx, to, provider, id: respJson.id, ts: new Date().toISOString() });
  }

  // Persist after every send so a crash never loses message ids.
  writeFileSync(statePath, JSON.stringify({ campaign: values.campaign, sends }, null, 2));

  if (i < recipients.length - 1) await new Promise((r) => setTimeout(r, 1500));
}

console.log("");
console.log(`state: ${statePath}`);
console.log(`watch: node scripts/c1-seed-watch.mjs --campaign=${values.campaign}`);
