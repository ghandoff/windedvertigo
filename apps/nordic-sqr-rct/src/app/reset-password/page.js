'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * /reset-password — Wave 7.0.7
 *
 * Reached only when /api/auth/login returned `{ resetRequired: true }` and
 * set the short-lived `sqr_reset_grant` cookie. The page asks the reviewer
 * for a new password (twice, to avoid typos), posts to
 * /api/auth/reset-password, and on success redirects back to the login page
 * so they authenticate normally.
 *
 * There is intentionally no "forgot my alias" affordance here — the grant
 * cookie already identifies the reviewer; this is a one-shot form.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must include upper-case, lower-case, and a digit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuccess(true);
      // Small delay so the user reads the confirmation before we redirect.
      setTimeout(() => router.push('/'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Image src="/nordic-logo.png" alt="Nordic Naturals" height={44} width={160} className="h-11 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-pacific">Reset your password</h1>
            <p className="text-xs text-gray-500">Nordic Naturals Research</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">One-time password reset</h2>
            <p className="mt-2 text-sm text-gray-600">
              For security reasons, your account must set a new password before
              you can continue. Your old password may have been visible to
              administrators during an earlier storage configuration; this
              reset rotates that exposure out.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Your new password never leaves your device in the clear — it&rsquo;s
              hashed with bcrypt before being written to the database.
            </p>

            {success ? (
              <div className="mt-6 rounded bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                Password reset. Redirecting you to the login page…
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum 12 characters, must include upper-case, lower-case, and a digit.
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-pacific-500 focus:outline-none focus:ring-1 focus:ring-pacific-500"
                  />
                </div>

                {error && (
                  <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded bg-pacific-600 px-4 py-2 text-sm font-medium text-white hover:bg-pacific-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
