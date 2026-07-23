#!/usr/bin/env node
/**
 * Listen-library smoke test — end-to-end verify the document→audio pipeline.
 *
 * Submits a source to /api/listen, polls until it renders, then fetches the
 * first audio chunk and confirms it's real audio. Reports timing + the cost the
 * render should have incurred (Cartesia ≈ $50 / 1M characters).
 *
 * /api/listen is session-gated (no secret bypass), so pass a logged-in session
 * cookie. Grab it from the browser while signed in to port.windedvertigo.com:
 *   DevTools → Application → Cookies → copy the value of
 *   `__Secure-authjs.session-token` (or `authjs.session-token` on http).
 *
 * Usage:
 *   PORT_COOKIE='__Secure-authjs.session-token=eyJ...' \
 *     node scripts/listen-smoke.mjs [sourceUrl]
 *
 * Env:
 *   PORT_COOKIE  (required) — the session cookie header value
 *   BASE         (optional) — default https://port.windedvertigo.com
 *   SOURCE_URL   (optional) — a public article URL to read; default below
 */

const BASE = process.env.BASE ?? "https://port.windedvertigo.com";
const COOKIE = process.env.PORT_COOKIE;
const SOURCE_URL =
  process.argv[2] ??
  process.env.SOURCE_URL ??
  "https://en.wikipedia.org/wiki/Threshold_knowledge";
const CARTESIA_USD_PER_MILLION = 50;

if (!COOKIE) {
  console.error("✗ set PORT_COOKIE to a logged-in session cookie (see header).");
  process.exit(1);
}

const headers = { Cookie: COOKIE };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`→ submitting ${SOURCE_URL}`);
  const submit = await fetch(`${BASE}/api/listen`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "url", url: SOURCE_URL, cleanLevel: "clean" }),
  });
  const submitBody = await submit.json().catch(() => ({}));
  if (!submit.ok) {
    console.error(`✗ submit failed (${submit.status}):`, JSON.stringify(submitBody).slice(0, 300));
    process.exit(1);
  }
  const id = submitBody.item?.id;
  console.log(`✓ queued — item ${id} ("${submitBody.item?.title ?? "?"}")`);

  // poll for terminal status
  const t0 = Date.now();
  let item;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res = await fetch(`${BASE}/api/listen/${id}`, { headers });
    if (!res.ok) { console.log(`  …poll ${res.status}`); continue; }
    const data = await res.json();
    item = data.item;
    process.stdout.write(`  [${Math.round((Date.now() - t0) / 1000)}s] ${item.status}\r`);
    if (item.status === "ready") {
      console.log(`\n✓ ready after ${Math.round((Date.now() - t0) / 1000)}s`);
      break;
    }
    if (item.status === "failed") {
      console.error(`\n✗ render failed: ${item.error}`);
      process.exit(1);
    }
  }
  if (!item || item.status !== "ready") {
    console.error("\n✗ timed out waiting for render");
    process.exit(1);
  }

  // fetch the first chunk and confirm it's real audio
  const fetched = await fetch(`${BASE}/api/listen/${id}`, { headers });
  const { chunks } = await fetched.json();
  if (!chunks?.length) { console.error("✗ no chunks recorded"); process.exit(1); }
  const first = await fetch(chunks[0].url);
  const bytes = new Uint8Array(await first.arrayBuffer());
  const ct = first.headers.get("content-type") ?? "";
  console.log(`✓ chunk 0: ${bytes.length} bytes, ${ct} (${chunks.length} chunks total)`);
  if (bytes.length < 500 || !ct.includes("audio")) {
    console.error("✗ first chunk doesn't look like audio");
    process.exit(1);
  }

  const cost = ((item.char_count ?? 0) / 1_000_000) * CARTESIA_USD_PER_MILLION;
  console.log(
    `\n✅ PASS — ${item.char_count} chars · ~${item.est_minutes} min · ${chunks.length} chunks · ≈ $${cost.toFixed(3)} Cartesia`,
  );
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
