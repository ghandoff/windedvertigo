#!/usr/bin/env node
// Trigger one harbour magic-link via the live Auth.js v5 Resend signin flow.
// Recipient pastes back the Authentication-Results header for SPF/DKIM/DMARC parse.

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    to: { type: "string" },
    base: { type: "string", default: "https://www.windedvertigo.com/harbour" },
  },
});

const to = values.to;
if (!to || !to.includes("@")) {
  console.error("usage: node scripts/trigger-magic-link.mjs --to=you@example.com");
  process.exit(1);
}

const base = values.base.replace(/\/$/, "");

// Auth.js v5 CSRF flow: GET /api/auth/csrf returns { csrfToken } and sets a
// httpOnly cookie that must accompany the signin POST.
const csrfRes = await fetch(`${base}/api/auth/csrf`);
if (!csrfRes.ok) {
  console.error(`csrf fetch failed: ${csrfRes.status} ${csrfRes.statusText}`);
  process.exit(1);
}
const { csrfToken } = await csrfRes.json();
const setCookie = csrfRes.headers.getSetCookie?.() ?? [csrfRes.headers.get("set-cookie") ?? ""];
const cookieHeader = setCookie
  .filter(Boolean)
  .map((c) => c.split(";")[0])
  .join("; ");

if (!csrfToken || !cookieHeader) {
  console.error("missing csrf token or cookie in response");
  process.exit(1);
}

const body = new URLSearchParams({
  email: to,
  csrfToken,
  callbackUrl: `${base}/account`,
  json: "true",
});

const signinRes = await fetch(`${base}/api/auth/signin/resend`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookieHeader,
  },
  body: body.toString(),
  redirect: "manual",
});

const respText = await signinRes.text();
if (signinRes.status >= 400) {
  console.error(`signin failed: ${signinRes.status}`);
  console.error(respText.slice(0, 500));
  process.exit(1);
}

console.log(`✓ magic-link requested for ${to} (status ${signinRes.status})`);
console.log("");
console.log("next steps:");
console.log(`  1. open the email in gmail (sender: noreply@windedvertigo.com)`);
console.log(`  2. ⋮ menu → "show original"`);
console.log(`  3. copy every line beginning with "Authentication-Results:" and paste back`);
console.log("");
console.log("don't click the link — that consumes the token. only the headers matter.");
