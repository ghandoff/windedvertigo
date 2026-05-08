// read-the-room Worker entry — serves the static HTML and routes /api/room/*
// to the Room Durable Object.
//
// URL surface served at https://www.windedvertigo.com/harbour/read-the-room
// (proxied through site/next.config.ts) and at the canonical workers.dev
// origin for direct WS connections from the client:
//
//   GET  /                                 → index.html
//   GET  /harbour/read-the-room            → index.html (path is preserved by the site rewrite)
//   POST /api/room                         → create room, returns { code }
//   GET  /api/room/:code/exists            → { exists: bool }
//   GET  /api/room/:code/ws (Upgrade)      → WebSocket → DO.fetch
//   POST /api/admin/wipe/:code             → admin: wipe a single room (bearer-auth)
//
// Room codes are 6 uppercase consonants — server picks, retries on miss.

import { Room } from "./src/room";

export { Room };

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  // Bearer token for admin endpoints. Set via:
  //   echo "..." | npx wrangler secret put WIPE_TOKEN
  // Absent in local dev → admin endpoints disabled (return 404).
  WIPE_TOKEN?: string;
}

const PATH_PREFIX = "/harbour/read-the-room";
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ"; // 21 consonants
const CODE_LENGTH = 6;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function corsHeaders(origin: string | null): HeadersInit {
  // Permissive CORS — the only sensitive operations require room-code knowledge
  // and an open WebSocket. Allowing any origin keeps the API usable from any
  // local-dev port and from the proxied www.windedvertigo.com origin.
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upgrade, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// Constant-time string comparison so a wrong token can't be inferred byte
// by byte from response timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function roomExists(env: Env, code: string): Promise<boolean> {
  const stub = env.ROOM.get(env.ROOM.idFromName(code));
  const res = await stub.fetch(`https://room/exists`);
  const body = (await res.json()) as { exists: boolean };
  return body.exists;
}

async function createRoom(env: Env): Promise<string> {
  // Up to 5 attempts to find an unused code. With 21^6 ≈ 85M codes and ~120
  // concurrent rooms the first attempt almost always wins.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (!(await roomExists(env, code))) {
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      await stub.fetch(`https://room/init?code=${code}`);
      return code;
    }
  }
  throw new Error("could not allocate room code");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // ---------- API ----------
    if (url.pathname === "/api/room" && request.method === "POST") {
      const code = await createRoom(env);
      return Response.json({ code }, { headers: corsHeaders(origin) });
    }

    // ---------- Admin: wipe a single room by code ----------
    // POST /api/admin/wipe/:code  with header  Authorization: Bearer <WIPE_TOKEN>
    // Returns { ok: true, wiped: bool } — `wiped` is true if the room actually
    // had state, false if the code was already empty (idempotent).
    const adminMatch = url.pathname.match(/^\/api\/admin\/wipe\/([A-Z]{6})$/);
    if (adminMatch) {
      if (request.method !== "POST") {
        return new Response("method not allowed", { status: 405, headers: corsHeaders(origin) });
      }
      const expected = env.WIPE_TOKEN;
      if (!expected) {
        return new Response("not found", { status: 404, headers: corsHeaders(origin) });
      }
      const auth = request.headers.get("Authorization") ?? "";
      const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return new Response("forbidden", { status: 403, headers: corsHeaders(origin) });
      }
      const code = adminMatch[1];
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      const res = await stub.fetch(`https://room/wipe`);
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const roomMatch = url.pathname.match(/^\/api\/room\/([A-Z]{6})\/(exists|ws)$/);
    if (roomMatch) {
      const code = roomMatch[1];
      const action = roomMatch[2];
      const stub = env.ROOM.get(env.ROOM.idFromName(code));

      if (action === "exists") {
        const res = await stub.fetch(`https://room/exists`);
        const body = await res.text();
        return new Response(body, {
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      // WebSocket upgrade — forward to DO with original query string preserved.
      const doUrl = new URL(`https://room/ws`);
      doUrl.search = url.search;
      return stub.fetch(doUrl.toString(), request);
    }

    // ---------- Static assets ----------
    // The site rewrite preserves the /harbour/read-the-room prefix when
    // proxying to this Worker. Static assets are served from /public/ at the
    // root, so /harbour/read-the-room → /index.html.
    const stripped =
      url.pathname === PATH_PREFIX || url.pathname === PATH_PREFIX + "/"
        ? "/"
        : url.pathname.startsWith(PATH_PREFIX + "/")
          ? url.pathname.slice(PATH_PREFIX.length)
          : url.pathname;

    const assetReq = new Request(new URL(stripped, url).toString(), request);
    const assetRes = await env.ASSETS.fetch(assetReq);

    const headers = new Headers(assetRes.headers);
    // The Worker now answers windedvertigo.com traffic directly via CF edge
    // routes (see wrangler.jsonc), so we can no longer rely on wv-site's
    // response headers. Replicate the relevant ones here. CSP is scoped
    // tightly to what this app actually needs: inline <script>/<style>,
    // Google Fonts, and HTTPS/WSS to its own workers.dev origin.
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self' https://wv-harbour-read-the-room.windedvertigo.workers.dev wss://wv-harbour-read-the-room.windedvertigo.workers.dev",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    // A small sentinel so deploy-time smoke checks can prove they hit the
    // Worker directly (via CF route) and not a fallback.
    headers.set("X-Served-By", "wv-harbour-read-the-room");
    return new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
