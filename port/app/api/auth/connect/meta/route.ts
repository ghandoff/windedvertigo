/**
 * GET /api/auth/connect/meta
 *
 * No OAuth flow — Meta page-access tokens require Graph API Explorer + app
 * review for the relevant scopes. This route renders a step-by-step guide
 * with copy-paste `wrangler secret put` commands.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_read_user_content", "instagram_basic", "instagram_manage_insights"];

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized — sign in first" }, { status: 401 });
  }

  const explorerUrl = `https://developers.facebook.com/tools/explorer/?method=GET&path=me%2Faccounts&version=v22.0`;
  const scopesQuery = SCOPES.join(",");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>meta connect — winded.vertigo</title>
<style>
body{font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#273248}
h1{font-size:18px;margin:0 0 8px}h2{font-size:15px;margin:24px 0 8px}
pre{background:#f6f8fa;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;border:1px solid #e5e7eb}
.step{margin:18px 0;padding:14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px}
.meta{color:#6b7280;font-size:12px}
ol{padding-left:18px}li{margin:6px 0}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px}
button{padding:6px 12px;border:1px solid #b15043;background:#fff;color:#b15043;border-radius:4px;cursor:pointer;font-size:12px}
button:hover{background:#b1504310}
a{color:#b15043}
</style></head><body>
<h1>meta (facebook + instagram) connect</h1>
<p class="meta">meta doesn't expose a clean OAuth redirect for page-access tokens. follow these steps in graph api explorer.</p>

<div class="step">
<h2>step 1 — get a long-lived page access token</h2>
<ol>
<li>open <a href="${explorerUrl}" target="_blank" rel="noopener">graph api explorer</a></li>
<li>top-right: select your facebook app (or create one in the app dropdown)</li>
<li>click "generate access token" → log in with the facebook account that admins the winded.vertigo page</li>
<li>add these permissions: <code>${SCOPES.join("</code>, <code>")}</code></li>
<li>submit the request to <code>GET /me/accounts</code></li>
<li>copy the <strong>access_token</strong> value for the winded.vertigo page row, and the <strong>id</strong> (page id)</li>
</ol>
<p class="meta">the token returned this way is short-lived (~1 hour). next step exchanges it for a long-lived one (~60 days, or never expires for page tokens).</p>
</div>

<div class="step">
<h2>step 2 — exchange for a long-lived page token</h2>
<p>in your terminal, run (substitute your values):</p>
<pre id="exchange">curl -s "https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN" | jq '.access_token'</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('exchange').textContent)">copy command</button>
</div>

<div class="step">
<h2>step 3 — get the instagram business user id</h2>
<pre id="ig">curl -s "https://graph.facebook.com/v22.0/PAGE_ID?fields=instagram_business_account&access_token=LONG_LIVED_TOKEN" | jq '.instagram_business_account.id'</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('ig').textContent)">copy command</button>
</div>

<div class="step">
<h2>step 4 — persist all three to wv-port</h2>
<pre id="persist">cd /Users/garrettjaeger/Projects/windedvertigo/port
echo 'LONG_LIVED_TOKEN'  | npx wrangler secret put META_PAGE_ACCESS_TOKEN
echo 'PAGE_ID'           | npx wrangler secret put META_PAGE_ID
echo 'IG_BUSINESS_ID'    | npx wrangler secret put META_IG_USER_ID</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('persist').textContent)">copy commands</button>
</div>

<div class="step">
<h2>step 5 — sync</h2>
<p>head back to <a href="/strategy">/strategy</a> and click "sync now" in the targets card. fb + instagram engagement will populate on the next sync (or this one).</p>
</div>

<p class="meta">if any scope is denied, your meta app probably needs review. for personal accounts admining a page, basic scopes generally work without review. for full insights data you may need to submit for "advanced access" on <code>pages_read_engagement</code>.</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
