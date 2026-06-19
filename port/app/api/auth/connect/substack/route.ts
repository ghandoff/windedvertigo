/**
 * GET /api/auth/connect/substack
 *
 * Substack has no public API. The richer subscriber-breakdown endpoint needs
 * a session cookie from a logged-in browser. This route walks the user
 * through extracting it.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized — sign in first" }, { status: 401 });
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>substack connect — winded.vertigo</title>
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
.ok{color:#16a34a}
</style></head><body>
<h1>substack connect</h1>
<p class="ok">✓ SUBSTACK_PUBLICATION already set to <code>windedvertigo</code></p>
<p class="meta">basic public stats work without a cookie. for subscriber breakdown (free vs paid, recent post views), follow the steps below.</p>

<div class="step">
<h2>step 1 — extract your substack.sid cookie</h2>
<ol>
<li>open <a href="https://windedvertigo.substack.com/publish/home" target="_blank" rel="noopener">windedvertigo.substack.com/publish/home</a> and sign in if needed</li>
<li>open chrome devtools (cmd+option+i)</li>
<li>application tab → cookies → <code>https://substack.com</code></li>
<li>find <code>substack.sid</code> — copy the <strong>value</strong> column</li>
</ol>
</div>

<div class="step">
<h2>step 2 — persist the cookie to wv-port</h2>
<pre id="cmd">cd /Users/garrettjaeger/Projects/windedvertigo/port
echo 'PASTE_COOKIE_VALUE_HERE' | npx wrangler secret put SUBSTACK_COOKIE</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent)">copy command</button>
</div>

<p class="meta">substack rotates session cookies — expect to redo this every few months. when you do, re-run step 2 only.</p>
<p>then: <a href="/mo">/mo</a> → click "sync now".</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
