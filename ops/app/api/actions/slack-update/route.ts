import { NextResponse } from 'next/server';

/**
 * POST /api/actions/slack-update
 * Sends a pre-formatted ops status update to Slack.
 *
 * Supports two modes:
 * 1. Incoming Webhook (SLACK_WEBHOOK_URL) — simplest, posts to a fixed channel
 * 2. Bot Token (SLACK_BOT_TOKEN + SLACK_CHANNEL_ID) — more flexible, any channel
 */
export async function POST() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!webhookUrl && !botToken) {
    return NextResponse.json(
      { ok: false, error: 'Neither SLACK_WEBHOOK_URL nor SLACK_BOT_TOKEN configured' },
      { status: 503 }
    );
  }

  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    });

    const text = `📊 *ops status update* — ${dateStr}\n\n_Triggered from ops.windedvertigo.com_\n\nVisit <https://ops.windedvertigo.com|the dashboard> for full details.`;

    let res: Response;

    if (webhookUrl) {
      // Mode 1: Incoming Webhook
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } else if (botToken && channelId) {
      // Mode 2: Bot Token + Channel
      res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: channelId, text }),
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'SLACK_BOT_TOKEN set but SLACK_CHANNEL_ID is missing' },
        { status: 503 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Slack returned ${res.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Sent to Slack' });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to send' }, { status: 500 });
  }
}
