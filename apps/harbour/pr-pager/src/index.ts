/**
 * wv-pr-pager — github pull-request webhooks → slack DM to garrett.
 *
 * deployed as a public worker. github calls POST /github with an
 * HMAC-SHA256 signature; we verify, filter to the events garrett
 * actually cares about, then post to slack.
 *
 * required secrets (set via `wrangler secret put`):
 *   GITHUB_WEBHOOK_SECRET   — shared secret for HMAC validation
 *   SLACK_BOT_TOKEN         — xoxb-... with chat:write
 *   SLACK_USER_ID           — garrett's slack user ID (DM target, e.g. U01ABC...)
 *
 * github webhook setup (one-time, in repo settings):
 *   payload URL: https://wv-pr-pager.windedvertigo.workers.dev/github
 *   content type: application/json
 *   secret:       <same as GITHUB_WEBHOOK_SECRET>
 *   events:       pull request, pull request review
 */

export interface Env {
  GITHUB_WEBHOOK_SECRET: string;
  SLACK_BOT_TOKEN: string;
  SLACK_USER_ID: string;
}

const GARRETT_LOGIN = 'ghandoff';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }
    if (req.method !== 'POST' || url.pathname !== '/github') {
      return new Response('not found', { status: 404 });
    }

    const event = req.headers.get('x-github-event') ?? '';
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    const raw = await req.text();

    if (!(await verifySignature(env.GITHUB_WEBHOOK_SECRET, signature, raw))) {
      return new Response('bad signature', { status: 401 });
    }

    let body: GithubWebhookBody;
    try {
      body = JSON.parse(raw) as GithubWebhookBody;
    } catch {
      return new Response('bad json', { status: 400 });
    }

    const message = buildSlackMessage(event, body);
    if (!message) return new Response('ignored', { status: 200 });

    await postSlackDM(env, message);
    return new Response('sent', { status: 200 });
  },
};

interface GithubWebhookBody {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    html_url: string;
    user?: { login: string };
    head?: { ref: string };
    requested_reviewers?: Array<{ login: string }>;
    assignees?: Array<{ login: string }>;
    body?: string | null;
  };
  requested_reviewer?: { login: string };
  review?: { state: string; user?: { login: string }; html_url: string };
  sender?: { login: string };
  repository?: { full_name: string };
}

interface SlackMessage {
  text: string;
  blocks: Array<unknown>;
}

function buildSlackMessage(event: string, body: GithubWebhookBody): SlackMessage | null {
  const pr = body.pull_request;
  if (!pr) return null;
  const repo = body.repository?.full_name ?? 'unknown';
  const author = pr.user?.login ?? 'unknown';
  if (author === GARRETT_LOGIN) return null; // don't notify on own PRs

  // only ping when garrett is actually involved or needs to act
  const involvesGarrett =
    pr.requested_reviewers?.some((r) => r.login === GARRETT_LOGIN) ||
    pr.assignees?.some((a) => a.login === GARRETT_LOGIN) ||
    body.requested_reviewer?.login === GARRETT_LOGIN;

  let kind: string | null = null;
  if (event === 'pull_request') {
    if (body.action === 'opened' && involvesGarrett) kind = 'opened';
    else if (body.action === 'review_requested' && body.requested_reviewer?.login === GARRETT_LOGIN)
      kind = 'review-requested';
    else if (body.action === 'ready_for_review' && involvesGarrett) kind = 'ready-for-review';
  } else if (event === 'pull_request_review') {
    // someone else reviewed garrett's PR — skip; garrett opens few PRs and the review noise isn't useful
    return null;
  }
  if (!kind) return null;

  const headRef = pr.head?.ref ?? '';
  const claudeCodeUrl = `https://code.claude.com/?prompt=${encodeURIComponent(`Review PR #${pr.number} on ${repo}: "${pr.title}". Summarise the diff and tell me if it's safe to merge.`)}`;
  const headline =
    kind === 'opened'
      ? `*${author}* opened PR #${pr.number}`
      : kind === 'review-requested'
        ? `*${author}* requested your review on PR #${pr.number}`
        : `PR #${pr.number} is ready for review`;

  return {
    text: `${headline}: ${pr.title}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${headline}\n*${pr.title}*` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `${repo} · branch \`${headRef}\`` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'review in claude' },
            url: claudeCodeUrl,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'open on github' },
            url: pr.html_url,
          },
        ],
      },
    ],
  };
}

async function verifySignature(secret: string, header: string, raw: string): Promise<boolean> {
  if (!header.startsWith('sha256=')) return false;
  const expected = header.slice('sha256='.length);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(computed, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function postSlackDM(env: Env, message: SlackMessage): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: env.SLACK_USER_ID,
      text: message.text,
      blocks: message.blocks,
      unfurl_links: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`slack post failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`slack api error: ${data.error}`);
}
