// wv-coding-verifier — evidence verification console.
// adjudicate double-coded research claims for desk reviews (amna at 10 + future engagements).
//
// auth: google sign-in restricted to the windedvertigo.com workspace. the worker runs the
// oauth code flow itself (no cloudflare access dependency). google's "internal" consent screen
// limits sign-in to the org; the worker re-checks the `hd` claim as defence-in-depth. the
// signed-in email IS the reviewer, recorded server-side on every action.
//
// routes everything under /tools/coding-verifier:
//   GET  …/api/auth/login            → redirect to google (signed state for csrf)
//   GET  …/api/auth/callback         → exchange code, verify claims, set cv_session cookie
//   GET  …/api/logout                → clear session
//   GET  …/api/session               → { ok, email }
//   GET  …/api/claims?status=&engagement=  → list (pending first)
//   GET  …/api/claims/:id            → single claim + its audit trail
//   POST …/api/claims/:id/verify     → status verified   (reviewer = session email)
//   POST …/api/claims/:id/flag       → { note* }         → status flagged
//   POST …/api/claims/:id/adjudicate → { ruling, chosen? } → status adjudicated
//   GET  …/api/stats                 → dashboard tally
//   GET  …/api/export?format=csv|json → full dump for the methods log
//   everything else                  → static assets (env.ASSETS)

const BASE = "/tools/coding-verifier";
const ALLOWED_DOMAIN = "windedvertigo.com";
const COOKIE = "cv_session";
const STATE_COOKIE = "cv_oauth_state";
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12h
const STATE_TTL = 10 * 60 * 1000; // 10m

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path === BASE) return Response.redirect(url.origin + BASE + "/", 308);
    if (path.startsWith(BASE + "/")) path = path.slice(BASE.length);

    try {
      // ── public auth endpoints ───────────────────────────────────────────
      if (path === "/api/auth/login") return authLogin(url, env);
      if (path === "/api/auth/callback") return authCallback(url, request, env);
      if (path === "/api/logout") return logout();
      if (path === "/api/session") {
        const email = await authed(request, env);
        return json({ ok: !!email, email: email || null });
      }

      // ── gated api ───────────────────────────────────────────────────────
      if (path.startsWith("/api/")) {
        const email = await authed(request, env);
        if (!email) return json({ error: "unauthorised" }, 401);

        if (path === "/api/claims" && request.method === "GET") return listClaims(url, env);
        if (path === "/api/stats") return stats(env);
        if (path === "/api/export") return exportClaims(url, env);

        const m = path.match(/^\/api\/claims\/(\d+)(?:\/(verify|flag|adjudicate))?$/);
        if (m) {
          const id = Number(m[1]);
          if (!m[2] && request.method === "GET") return getClaim(id, env);
          if (m[2] && request.method === "POST") return act(m[2], id, request, env, email);
        }
        return json({ error: "not_found" }, 404);
      }

      // ── static front-end ────────────────────────────────────────────────
      const assetUrl = new URL(url);
      assetUrl.pathname = path || "/";
      return env.ASSETS.fetch(new Request(assetUrl, request));
    } catch (err) {
      console.error("handler error", err);
      return json({ error: "server_error" }, 500);
    }
  },
};

// ── google oauth ────────────────────────────────────────────────────────────

function redirectUri(url) {
  return url.origin + BASE + "/api/auth/callback";
}

async function authLogin(url, env) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "oauth_not_configured" }, 500);
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)).join("-"));
  const stateToken = await sign(env, JSON.stringify({ s: state, exp: Date.now() + STATE_TTL }));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(url),
    response_type: "code",
    scope: "openid email profile",
    hd: ALLOWED_DOMAIN,
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GOOGLE_AUTH}?${params}`,
      // lax so the cookie survives the top-level redirect back from google
      "Set-Cookie": `${STATE_COOKIE}=${stateToken}; Path=${BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL / 1000}`,
    },
  });
}

async function authCallback(url, request, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return deny("missing code or state");

  // verify state against the signed cookie (csrf)
  const stateToken = cookie(request, STATE_COOKIE);
  const statePayload = stateToken ? await unsign(env, stateToken) : null;
  if (!statePayload) return deny("bad state");
  const parsed = JSON.parse(statePayload);
  if (parsed.s !== state || !(parsed.exp > Date.now())) return deny("state expired or mismatched");

  // exchange the code for tokens, server-side over tls
  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(url),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return deny("token exchange failed");
  const tokens = await tokenRes.json();

  // the id_token came straight from google's token endpoint over tls, so we validate
  // its claims without re-verifying the signature (per google's own guidance).
  const claims = decodeJwt(tokens.id_token);
  if (!claims) return deny("no id_token");
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audOk = claims.aud === env.GOOGLE_CLIENT_ID;
  const expOk = Number(claims.exp) * 1000 > Date.now();
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  const domainOk =
    claims.hd === ALLOWED_DOMAIN &&
    typeof claims.email === "string" &&
    claims.email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN);
  if (!(issOk && audOk && expOk && emailVerified && domainOk)) return deny("not a windedvertigo.com account");

  const session = await sign(env, JSON.stringify({ email: claims.email.toLowerCase(), exp: Date.now() + SESSION_TTL }));
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", BASE + "/"],
      ["Set-Cookie", `${COOKIE}=${session}; Path=${BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`],
      ["Set-Cookie", `${STATE_COOKIE}=; Path=${BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`],
    ],
  });
}

function logout() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: BASE + "/",
      "Set-Cookie": `${COOKIE}=; Path=${BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

// returns the signed-in email, or null
async function authed(request, env) {
  const token = cookie(request, COOKIE);
  if (!token) return null;
  const payload = await unsign(env, token);
  if (!payload) return null;
  try {
    const { email, exp } = JSON.parse(payload);
    if (!email || !(exp > Date.now())) return null;
    return email;
  } catch {
    return null;
  }
}

function deny(reason) {
  // small html page rather than json — the user lands here via a browser redirect
  const body = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;background:#faf6ef;color:#1d2533;max-width:34rem;margin:12vh auto;padding:0 1.2rem">
<h2 style="font-weight:600">sign-in not allowed</h2>
<p>${reason}. this console is limited to <b>@${ALLOWED_DOMAIN}</b> google accounts.</p>
<p><a href="${BASE}/" style="color:#b15043">back to sign in</a></p>`;
  return new Response(body, { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } });
}

// ── signing (hmac over a payload string) ────────────────────────────────────

async function sign(env, payloadStr) {
  const payload = b64url(payloadStr);
  return `${payload}.${await hmac(env, payload)}`;
}
async function unsign(env, token) {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(env, payload))) return null;
  return unb64url(payload);
}
async function hmac(env, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET || ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}
function timingSafeEqual(a, b) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
function decodeJwt(jwt) {
  try {
    const part = String(jwt).split(".")[1];
    return JSON.parse(unb64url(part));
  } catch {
    return null;
  }
}

// ── claims: read ────────────────────────────────────────────────────────────

async function listClaims(url, env) {
  const status = url.searchParams.get("status");
  const engagement = url.searchParams.get("engagement") || "amna-at-10";
  const where = ["engagement = ?"];
  const binds = [engagement];
  if (status && status !== "all") {
    where.push("status = ?");
    binds.push(status);
  }
  // pending first, then flagged, then the rest; ordered within each
  const rows = await env.DB.prepare(
    `select * from claims where ${where.join(" and ")}
     order by case status when 'pending' then 0 when 'flagged' then 1
                          when 'adjudicated' then 2 else 3 end, id asc`
  )
    .bind(...binds)
    .all();
  return json({ claims: rows.results || [] });
}

async function getClaim(id, env) {
  const claim = await env.DB.prepare("select * from claims where id = ?").bind(id).first();
  if (!claim) return json({ error: "not_found" }, 404);
  const trail = await env.DB.prepare("select * from audit_log where claim_id = ? order by id asc").bind(id).all();
  return json({ claim, audit: trail.results || [] });
}

// ── claims: write (verify / flag / adjudicate) ──────────────────────────────
// reviewer is the authenticated email — never taken from the request body.

async function act(action, id, request, env, reviewer) {
  const body = await request.json().catch(() => ({}));

  const current = await env.DB.prepare("select status from claims where id = ?").bind(id).first();
  if (!current) return json({ error: "not_found" }, 404);
  const from = current.status;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  let to, update, note;
  if (action === "verify") {
    to = "verified";
    note = "confirmed against source";
    update = env.DB.prepare("update claims set status=?, reviewer=?, verified_at=?, updated_at=? where id=?").bind(to, reviewer, now, now, id);
  } else if (action === "flag") {
    note = String(body.note || "").trim();
    if (!note) return json({ error: "note_required" }, 400);
    to = "flagged";
    update = env.DB.prepare("update claims set status=?, reviewer=?, notes=?, updated_at=? where id=?").bind(to, reviewer, note, now, id);
  } else {
    const ruling = String(body.ruling || "").trim();
    const chosen = body.chosen ? String(body.chosen) : null; // 'a' | 'b' | 'carl'
    if (!ruling && !chosen) return json({ error: "ruling_or_choice_required" }, 400);
    to = "adjudicated";
    note = chosen ? `chose coder ${chosen}. ${ruling}`.trim() : ruling;
    update = env.DB.prepare("update claims set status=?, reviewer=?, ruling=?, verified_at=?, updated_at=? where id=?").bind(to, reviewer, note, now, now, id);
  }

  const audit = env.DB.prepare(
    "insert into audit_log (claim_id, action, from_status, to_status, reviewer, note, at) values (?,?,?,?,?,?,?)"
  ).bind(id, action, from, to, reviewer, note, now);

  // atomic: status change + audit row land together
  await env.DB.batch([update, audit]);
  return getClaim(id, env);
}

// ── dashboard tally ─────────────────────────────────────────────────────────

async function stats(env) {
  const engagement = "amna-at-10";
  const byStatus = await env.DB.prepare("select status, count(*) n from claims where engagement=? group by status").bind(engagement).all();
  const byAgreement = await env.DB.prepare("select agreement, count(*) n from claims where engagement=? group by agreement").bind(engagement).all();
  const byReviewer = await env.DB.prepare(
    "select reviewer, count(*) n from audit_log where action='adjudicate' and reviewer is not null group by reviewer"
  ).all();
  const totals = await env.DB.prepare(
    `select count(*) total,
            sum(case when status in ('verified','adjudicated') then 1 else 0 end) confronted,
            sum(case when agreement='agree' then 1 else 0 end) agreed
     from claims where engagement=?`
  )
    .bind(engagement)
    .first();

  const total = totals.total || 0;
  return json({
    engagement,
    by_status: tally(byStatus.results, "status"),
    by_agreement: tally(byAgreement.results, "agreement"),
    adjudications_by_reviewer: tally(byReviewer.results, "reviewer"),
    total,
    source_confronted_pct: total ? Math.round((100 * (totals.confronted || 0)) / total) : 0,
    coder_agreement_pct: total ? Math.round((100 * (totals.agreed || 0)) / total) : 0,
  });
}

function tally(rows, key) {
  const out = {};
  for (const r of rows || []) out[r[key] ?? "—"] = r.n;
  return out;
}

// ── export ──────────────────────────────────────────────────────────────────

async function exportClaims(url, env) {
  const fmt = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = (await env.DB.prepare("select * from claims order by id asc").all()).results || [];
  if (fmt === "json") {
    return new Response(JSON.stringify({ exported_at: new Date().toISOString(), claims: rows }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="coding-verifier-export.json"' },
    });
  }
  const cols = Object.keys(rows[0] || { id: 1 });
  const esc = (v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="coding-verifier-export.csv"' },
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "X-Robots-Tag": "noindex, nofollow", ...headers },
  });
}
function cookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const hit = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : null;
}
function b64url(strOrBytes) {
  const str = typeof strOrBytes === "string" ? strOrBytes : String(strOrBytes);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}
