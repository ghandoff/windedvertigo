'use client';

/**
 * Wave 7.3.0 Phase B — Email Confirmation Banner.
 *
 * Renders a sticky-top warning banner for any authenticated reviewer
 * whose row carries no email. Submitting the inline form posts to
 * /api/auth/confirm-email; on success we refetch session state via
 * checkAuth() so the banner self-dismisses.
 *
 * Gating: this banner does NOT block route navigation in 7.3.0 Phase B —
 * the plan calls for that, but route-level blocking lands in a later
 * phase. The visual treatment (sticky-top, amber, above all other
 * content) signals "resolve this now" without trapping the user.
 */

import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function needsConfirmation(user) {
  if (!user) return false;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  return email.length === 0;
}

export default function EmailConfirmationBanner() {
  const { user, checkAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!needsConfirmation(user)) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not save your email. Please try again.');
        setSubmitting(false);
        return;
      }
      // Re-validate the session against the server so user.email picks up
      // the new value and the banner self-dismisses.
      await checkAuth();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-gold-100 border-b-2 border-gold-300 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gold-900 text-sm">
              Please confirm your email
            </p>
            <p className="text-xs text-gold-800 mt-0.5">
              Your account doesn&rsquo;t have an email on file. Adding one now unlocks
              magic-link login (coming soon) and lets us send you platform notifications.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start"
          >
            <div className="flex flex-col">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="you@example.com"
                aria-label="Email address"
                className="px-3 py-1.5 text-sm border border-gold-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-60"
              />
              {error ? (
                <span className="text-xs text-red-700 mt-1">{error}</span>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium bg-gold-600 hover:bg-gold-700 text-white rounded disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {submitting ? 'Saving…' : 'Save email'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
