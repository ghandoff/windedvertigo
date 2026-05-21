/**
 * POST /api/admin/users/invite
 *
 * Send an invitation email to a prospective user with a pre-filled
 * registration link. Requires the `users:invite` capability (admin+).
 *
 * Body: { firstName, lastName, email, affiliation?, roles: string[] }
 * Response: { ok: true, sentTo: string }
 */

import { requireCapability } from '@/lib/auth/require-capability';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

// ── Resend lazy-init (same pattern as src/lib/email.js) ──────────────────────

let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is required.');
  _resend = new Resend(key);
  return _resend;
}

const FROM_ADDRESS = 'Nordic Research Platform <noreply@windedvertigo.com>';

// ── Role label helper ─────────────────────────────────────────────────────────

const ROLE_LABELS = {
  reviewer:    'External Reviewer',
  researcher:  'Researcher',
  ra:          'Regulatory Affairs',
  admin:       'Administrator',
  'super-user': 'Super User',
  // legacy aliases
  'sqr-rct':   'External Reviewer',
  pcs:         'Researcher',
};

function roleLabel(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'platform member';
  return roles.map(r => ROLE_LABELS[r] || r).join(', ');
}

// ── Invite email ──────────────────────────────────────────────────────────────

async function sendInviteEmail({ to, firstName, inviterName, registrationUrl, roles }) {
  const displayName = firstName && firstName.trim() ? firstName.trim() : 'there';
  const inviter = inviterName && inviterName.trim() ? inviterName.trim() : 'A platform administrator';
  const roleName = roleLabel(roles);

  const isExternal = Array.isArray(roles) && roles.some(r => r === 'reviewer' || r === 'sqr-rct');
  const subject = isExternal
    ? "You've been invited to review for the Nordic SQR-RCT"
    : "You've been invited to the Nordic Research Platform";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1a6080;padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
                Nordic Research Platform
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                Substantiation &middot; Review &middot; Label intake
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                ${inviter} has invited you to join the Nordic Research Platform as a
                <strong>${roleName}</strong>. Click the link below to create your account.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#1a6080;">
                    <a href="${registrationUrl}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
                      Create your account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                If the button doesn&apos;t work, copy and paste this URL into your browser:
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
                ${registrationUrl}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                If you weren&apos;t expecting this invitation, you can safely ignore this email.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Nordic Naturals. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${displayName},

${inviter} has invited you to join the Nordic Research Platform as a ${roleName}.
Click the link below to create your account:

${registrationUrl}

If you weren't expecting this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} Nordic Naturals. All rights reserved.`;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    console.error('[invite] Resend send failed:', error);
    throw new Error(`Failed to send invite email: ${error.message}`);
  }

  return data;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const gate = await requireCapability(request, 'users:invite', { route: '/api/admin/users/invite' });
    if (gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const { firstName, lastName, email, affiliation, roles } = body;

    // Validate required fields
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return NextResponse.json({ error: 'firstName is required.' }, { status: 400 });
    }
    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
      return NextResponse.json({ error: 'lastName is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'At least one role is required.' }, { status: 400 });
    }

    // Privilege escalation guard: only super-users may invite someone with
    // admin or super-user roles. A regular admin (users:invite capability) may
    // only invite reviewer / researcher / ra.
    const PRIVILEGED_ROLES = ['admin', 'super-user'];
    const requestsPrivileged = roles.some(r => PRIVILEGED_ROLES.includes(r));
    if (requestsPrivileged) {
      const callerRoles = gate.user?.roles ?? [];
      if (!callerRoles.includes('super-user')) {
        return NextResponse.json(
          { error: 'Only super-users may invite users with admin or super-user roles.' },
          { status: 403 },
        );
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Build pre-filled registration URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nordic.windedvertigo.com';
    const params = new URLSearchParams({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
    });
    if (affiliation && typeof affiliation === 'string' && affiliation.trim()) {
      params.set('affiliation', affiliation.trim());
    }
    const registrationUrl = `${appUrl}/register?${params.toString()}`;

    // Resolve inviter name from the session token attached by requireCapability
    const inviterName = gate.user
      ? [gate.user.firstName, gate.user.lastName].filter(Boolean).join(' ')
      : null;

    await sendInviteEmail({
      to: normalizedEmail,
      firstName: firstName.trim(),
      inviterName,
      registrationUrl,
      roles,
    });

    return NextResponse.json({ ok: true, sentTo: normalizedEmail });
  } catch (error) {
    console.error('[invite] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
