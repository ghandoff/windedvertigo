/**
 * Wave 6.1 — in-app feedback submission endpoint.
 * Accepts a feedback payload from the floating FeedbackButton and fans it
 * out to Slack via the existing SLACK_WEBHOOK_URL.
 *
 * TODO (v2 / Wave 6.2+): also persist to a Notion "Feedback Inbox" DB so
 * submissions are queryable at /admin/feedback. Right now this is
 * fire-and-forget to Slack only.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { notifyFeedback } from '@/lib/slack-notifier';
import { createRateLimiter } from '@/lib/rate-limit';

const VALID_CATEGORIES = new Set(['bug', 'confusion', 'idea', 'other']);
const MAX_MESSAGE_LEN = 4000;

// 5 submissions per 10 minutes per IP. Cheap insurance against runaway clients.
const checkFeedbackRate = createRateLimiter({ maxAttempts: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/feedback' });
  if (auth.error) return auth.error;

  const rate = checkFeedbackRate(request);
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many feedback submissions. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const category = String(payload?.category || '').toLowerCase();
  const message = String(payload?.message || '').trim();
  const emailBack = Boolean(payload?.emailBack);
  const pageUrl = typeof payload?.pageUrl === 'string' ? payload.pageUrl.slice(0, 500) : null;
  const viewport = typeof payload?.viewport === 'string' ? payload.viewport.slice(0, 32) : null;

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LEN})` }, { status: 400 });
  }

  const user = auth.user || {};
  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';
  const resolvedPageUrl = pageUrl || referer || null;

  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null;

  const result = await notifyFeedback({
    category,
    message,
    emailBack,
    context: {
      pageUrl: resolvedPageUrl,
      userAlias: user.alias,
      userName,
      roles: user.roles,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      userAgent,
      viewport,
    },
  });

  if (!result.sent) {
    // Log server-side but don't leak reason to client.
    console.error('[feedback] Slack notify failed:', result.reason);
    return NextResponse.json({ error: 'Could not deliver feedback. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
