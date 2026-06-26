// wv-coding-verifier — evidence verification console.
// adjudicate double-coded research claims for desk reviews (amna at 10 + future engagements).
//
// routes everything under /tools/coding-verifier:
//   POST …/api/login                 → check password, set signed cv_session cookie
//   GET  …/api/logout                → clear session
//   GET  …/api/session               → { ok } — is the cookie valid?
//   GET  …/api/claims?status=&engagement=  → list (pending first)
//   GET  …/api/claims/:id            → single claim + its audit trail
//   POST …/api/claims/:id/verify     → { reviewer }            → status verified
//   POST …/api/claims/:id/flag       → { reviewer, note* }     → status flagged (note required)
//   POST …/api/claims/:id/adjudicate → { reviewer, ruling, chosen? } → status adjudicated
//   GET  …/api/stats                 → dashboard tally
//   GET  …/api/export?format=csv|json → full dump for the methods log
//   everything else                  → static assets (env.ASSETS), gated where noted

const BASE = "/tools/coding-verifier";
const REVIEWERS = ["garrett", "jamie"];
const COOKIE = "cv_session";
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12h

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path === BASE) return Response.redirect(url.origin + BASE + "/", 308);
    if (path.startsWith(BASE + "/")) path = path.slice(BASE.length);

    try {
      // ── public api: login / logout / session-check ──────────────────────
      if (path === "/api/login" && request.method === "POST") return login(request, env);
      if (path === "/api/logout") return logout(url);
      if (path === "/api/session") {
        return json({ ok: await authed(request, env) });
      }

      // ── gated api ───────────────────────────────────────────────────────
      if (path.startsWith("/api/")) {
        if (!(await authed(request, env))) return json({ error: "unauthorised" }, 401);

        if (path === "/api/claims" && request.method === "GET") return listClaims(url, env);
        if (path === "/api/stats") return stats(env);
        if (path === "/api/export") return exportClaims(url, env);

        const m = path.match(/^\/api\/claims\/(\d+)(?:\/(verify|flag|adjudicate))?$/);
        if (m) {
          const id = Number(m[1]);
          if (!m[2] && request.method === "GET") return getClaim(id, env);
          if (m[2] && request.method === "POST") return act(m[2], id, request, env);
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

// ── auth ──────────────────────────────────────────────────────────────────

async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const supplied = String(body.password || "");
  const expected = env.APP_PASSWORD || "";
  if (!expected || !timingSafeEqual(supplied, expected)) {
    return json({ error: "wrong_password" }, 401);
  }
  const token = await signSession(env, Date.now() + SESSION_TTL);
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=${token}; Path=${BASE}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}`,
  });
}

function logout(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: BASE + "/",
      "Set-Cookie": `${COOKIE}=; Path=${BASE}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    },
  });
}

async function authed(request, env) {
  const token = cookie(request, COOKIE);
  if (!token) return false;
  return verifySession(env, token);
}

// session token = base64url(expiryMs) "." base64url(hmac). no pii inside.
async function signSession(env, expiry) {
  const payload = b64url(String(expiry));
  const sig = await hmac(env, payload);
  return `${payload}.${sig}`;
}

async function verifySession(env, token) {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(env, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  const expiry = Number(unb64url(payload));
  return Number.isFinite(expiry) && expiry > Date.now();
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
  // pending first, then flagged, then the rest; newest within each
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
  const trail = await env.DB.prepare(
    "select * from audit_log where claim_id = ? order by id asc"
  )
    .bind(id)
    .all();
  return json({ claim, audit: trail.results || [] });
}

// ── claims: write (verify / flag / adjudicate) ──────────────────────────────

async function act(action, id, request, env) {
  const body = await request.json().catch(() => ({}));
  const reviewer = String(body.reviewer || "");
  if (!REVIEWERS.includes(reviewer)) return json({ error: "reviewer_required" }, 400);

  const current = await env.DB.prepare("select status from claims where id = ?").bind(id).first();
  if (!current) return json({ error: "not_found" }, 404);
  const from = current.status;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  let to, update, note;
  if (action === "verify") {
    to = "verified";
    note = "confirmed against source";
    update = env.DB.prepare(
      "update claims set status=?, reviewer=?, verified_at=?, updated_at=? where id=?"
    ).bind(to, reviewer, now, now, id);
  } else if (action === "flag") {
    note = String(body.note || "").trim();
    if (!note) return json({ error: "note_required" }, 400);
    to = "flagged";
    update = env.DB.prepare(
      "update claims set status=?, reviewer=?, notes=?, updated_at=? where id=?"
    ).bind(to, reviewer, note, now, id);
  } else {
    // adjudicate
    const ruling = String(body.ruling || "").trim();
    const chosen = body.chosen ? String(body.chosen) : null; // 'a' | 'b' | 'carl'
    if (!ruling && !chosen) return json({ error: "ruling_or_choice_required" }, 400);
    to = "adjudicated";
    note = chosen ? `chose coder ${chosen}. ${ruling}`.trim() : ruling;
    update = env.DB.prepare(
      "update claims set status=?, reviewer=?, ruling=?, verified_at=?, updated_at=? where id=?"
    ).bind(to, reviewer, note, now, now, id);
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
  const byStatus = await env.DB.prepare(
    "select status, count(*) n from claims where engagement=? group by status"
  )
    .bind(engagement)
    .all();
  const byAgreement = await env.DB.prepare(
    "select agreement, count(*) n from claims where engagement=? group by agreement"
  )
    .bind(engagement)
    .all();
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
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="coding-verifier-export.json"',
      },
    });
  }
  const cols = Object.keys(rows[0] || { id: 1 });
  const esc = (v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coding-verifier-export.csv"',
    },
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

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}
