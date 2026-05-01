"use client";

/**
 * Harbour sign-in.
 *
 * Phase 3a shipped magic-link via Resend. Phase 3b (2026-04-26) added
 * Google OAuth using the existing Pool A OAuth client (id
 * 160968051904-ud88va6odnnjlp76j5dlc4qfd8upq2lp) — same client port +
 * creaseworks + vault + depth-chart all use. Just one redirect URI
 * added in the Cloud Console: `/harbour/api/auth/callback/google`.
 *
 * Pattern mirrors apps/depth-chart/app/login/page.tsx (the canonical
 * Pool A login). Auth.js v5's basePath stripping for redirects on
 * CF Workers is handled via `WORKERS_AUTH_PAGES_BASEPATH=/harbour`
 * set on the worker's secrets.
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginInner() {
  const params = useSearchParams();
  const verify = params.get("verify");
  const error = params.get("error");
  const callback_url = params.get("callbackUrl") || "/";

  // Auth.js v5 client signIn() handles CSRF token + redirect flow on its own.
  // Path needs the /harbour basePath because Auth.js redirect URLs are
  // emitted relative to the app's mount point.
  const fullCallback = `/harbour${callback_url}`;

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogle() {
    setSubmitting(true);
    await signIn("google", { callbackUrl: fullCallback });
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await signIn("resend", {
      email: email.toLowerCase().trim(),
      callbackUrl: fullCallback,
    });
  }

  if (verify) {
    return (
      <main id="main" className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-[var(--color-text-on-dark)]">
            check your email
          </h1>
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            we sent a sign-in link to your email address. click it to continue.
          </p>
          <a
            href="/harbour"
            className="inline-block text-xs text-[var(--wv-champagne)] hover:opacity-80"
          >
            ← back to harbour
          </a>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-[var(--color-text-on-dark)]">
            sign in to harbour
          </h1>
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            one account, all the apps under harbour.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 text-center">
            {error === "OAuthAccountNotLinked"
              ? "this email is already linked to another sign-in method."
              : "something went wrong. please try again."}
          </div>
        )}

        {/* google sign-in */}
        <div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
            </svg>
            sign in with Google
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-xs text-[var(--color-text-on-dark-muted)]">or</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* email magic link */}
        <form onSubmit={handleResend} className="space-y-3">
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-[var(--color-text-on-dark)] placeholder:text-white/30 focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
          />
          <button
            type="submit"
            disabled={!email.trim() || submitting}
            className="w-full bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            send magic link
          </button>
        </form>

        <p className="text-center text-xs text-[var(--color-text-on-dark-muted)]">
          no account needed — signing in creates one automatically.
        </p>

        <div className="text-center">
          <a
            href="/harbour"
            className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
          >
            ← continue without signing in
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
