'use client';

import { useState, useEffect, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Audience-aware landing copy. The page renders the same shell for both
 * audiences (Nordic Team + External Reviewer); only the content varies
 * with the active tab. This keeps the page coherent — no mixed messaging
 * between hero, about, stats, and CTA.
 */
const AUDIENCE_CONTENT = {
  reviewer: {
    label: 'External Reviewer',
    heroTitle: 'Study Quality Rubric for RCTs',
    heroSubtitle: 'Independent secondary reviews of randomized controlled trials in nutraceutical and pharmaceutical research. Earn credibility, build your portfolio.',
    primaryCtaLabel: 'Apply to be a reviewer',
    primaryCtaHref: '/register',
    secondaryCtaLabel: 'Sign in',
    aboutHeading: 'How peer review works',
    steps: [
      { title: 'Submit Intake', desc: 'Extract key study details from the published article using our structured intake form.', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
      { title: 'Score Quality', desc: 'Rate the study across 11 validated rubric questions, each assessing a different quality dimension.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { title: 'Analyze Results', desc: 'View inter-rater reliability metrics, quality distributions, and detailed analytics across all reviews.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ],
    stats: [
      { label: 'Rubric Questions', value: '11' },
      { label: 'Quality Dimensions', value: '3 Tiers' },
      { label: 'Max Score', value: '22' },
      { label: 'Reviewers per Article', value: 'Up to 3' },
    ],
  },
  nordic: {
    label: 'Nordic Team Member',
    heroTitle: 'Substantiate the Science Behind Every Claim',
    heroSubtitle: 'PCS substantiation, AICS active-ingredient research, label intake, claim review, and audit-ready compliance — built for Nordic Research, Regulatory Affairs, and Operations.',
    primaryCtaLabel: 'Sign in',
    primaryCtaHref: null, // scrolls to sign-in card
    secondaryCtaLabel: 'Need access? Contact your manager',
    aboutHeading: 'How the platform works',
    steps: [
      { title: 'Document the Science', desc: 'Build PCS and AICS substantiation files with controlled vocabulary for active ingredient, form, dose, and demographic.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { title: 'Review and Approve', desc: 'Living PCS versioning, inline edit, audit-trail revert, and dedupe flow keep claim language consistent across the portfolio.', icon: 'M5 13l4 4L19 7' },
      { title: 'Audit-Ready Compliance', desc: 'Every mutation logged. CSV export for FDA/Health Canada/regulatory inquiries, available to RA and admin roles.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    ],
    stats: [
      { label: 'Active SKUs Tracked', value: 'All' },
      { label: 'PCS Lifecycle Stages', value: '5' },
      { label: 'Per-Role Sidebars', value: '5' },
      { label: 'Audit Coverage', value: '100%' },
    ],
  },
};

function LandingContent() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Password login state
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicSubmitting, setMagicSubmitting] = useState(false);
  const [magicError, setMagicError] = useState('');

  // Login mode — reviewer tab defaults to magic link (Wave 7.3.1)
  // 'magic' | 'password'
  const [loginMode, setLoginMode] = useState('magic');

  // Audience tab — defaults to 'reviewer' since that is the marketing /
  // acquisition surface (Nordic team members typically know the URL and
  // sign in directly; external reviewers are discovering the platform).
  const [audience, setAudience] = useState('reviewer');
  const content = AUDIENCE_CONTENT[audience];

  // Detect ?error=magic-link-invalid from the verify redirect.
  const magicLinkError = searchParams?.get('error') === 'magic-link-invalid';

  // Wave 7.2 Phase 3 — all successful logins route through /welcome, which
  // reads the user's roles and renders a role-aware destination picker.
  // Reviewer-only users are silently deep-linked inside /welcome itself.
  if (!loading && user) { router.push('/welcome'); return null; }

  // Reset mode and state when audience tab changes.
  const handleAudienceChange = (key) => {
    setAudience(key);
    // Nordic team always uses password; reviewer tab defaults to magic link.
    setLoginMode(key === 'nordic' ? 'password' : 'magic');
    setError('');
    setMagicError('');
    setMagicSent(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(alias, password);
      if (data?.resetRequired) {
        router.push('/reset-password');
        return;
      }
      router.push('/welcome');
    }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setMagicError('');
    setMagicSubmitting(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMagicError(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      setMagicSent(true);
    } catch {
      setMagicError('Network error. Check your connection and try again.');
    } finally {
      setMagicSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Image src="/nordic-logo.png" alt="Nordic Naturals" height={44} width={160} className="h-11 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-pacific">Nordic Research Platform</h1>
            <p className="text-xs text-gray-500">Substantiation · Review · Label intake</p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — with nordic-hq.jpg background */}
        <section className="relative overflow-hidden">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/nordic-hq.jpg')" }}
          />
          {/* Branded dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-pacific-800/75 via-pacific-800/60 to-pacific-800/80" />

          {/* Content */}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12">
            {/* Audience tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-full bg-white/10 backdrop-blur-sm p-1 border border-white/20" role="tablist" aria-label="Choose audience">
                {Object.keys(AUDIENCE_CONTENT).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={audience === key}
                    onClick={() => handleAudienceChange(key)}
                    className={`px-5 sm:px-6 py-2 rounded-full text-sm font-semibold transition ${
                      audience === key
                        ? 'bg-white text-pacific shadow'
                        : 'text-white/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    I&apos;m a {AUDIENCE_CONTENT[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hero copy — audience-aware */}
            <div className="text-center mb-10 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
                {content.heroTitle}
              </h2>
              <p className="text-lg text-white/85 leading-relaxed">
                {content.heroSubtitle}
              </p>
            </div>

            {/* Sign-in card — single, centered, audience-aware form */}
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <div className="card shadow-xl backdrop-blur-sm bg-white/95">
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-pacific mb-1">Sign in</h3>

                    {/* Expired / invalid magic link banner */}
                    {magicLinkError && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-800">
                          That sign-in link has expired or already been used. Request a new one below.
                        </p>
                      </div>
                    )}

                    {/* ── Reviewer tab: magic link primary ── */}
                    {audience === 'reviewer' && loginMode === 'magic' && (
                      <>
                        <p className="text-sm text-gray-500 mb-6">
                          Enter your email and we&apos;ll send a one-click sign-in link. No password needed.
                        </p>
                        {magicSent ? (
                          <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                              <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm font-semibold text-green-800">Check your inbox</p>
                              <p className="text-sm text-green-700 mt-1">
                                If that address is on file, a sign-in link is on the way. The link expires in 15 minutes.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setMagicSent(false); setMagicEmail(''); }}
                              className="w-full text-sm text-pacific hover:underline"
                            >
                              Use a different email
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleMagicLink} className="space-y-4">
                            <div>
                              <label className="form-label" htmlFor="magic-email">Email address</label>
                              <input
                                id="magic-email"
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={magicEmail}
                                onChange={(e) => setMagicEmail(e.target.value)}
                                required
                                autoComplete="email"
                                inputMode="email"
                              />
                            </div>
                            {magicError && (
                              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                                <p className="text-sm text-red-700">{magicError}</p>
                              </div>
                            )}
                            <button type="submit" disabled={magicSubmitting} className="btn-primary w-full">
                              {magicSubmitting ? 'Sending…' : 'Send sign-in link'}
                            </button>
                            <p className="text-center text-xs text-gray-400">
                              or{' '}
                              <button
                                type="button"
                                onClick={() => setLoginMode('password')}
                                className="text-pacific hover:underline"
                              >
                                use a password instead
                              </button>
                            </p>
                          </form>
                        )}
                      </>
                    )}

                    {/* ── Password form (Nordic tab always; reviewer tab if toggled) ── */}
                    {(audience === 'nordic' || loginMode === 'password') && (
                      <>
                        <p className="text-sm text-gray-500 mb-6">
                          {audience === 'reviewer'
                            ? 'Enter your email and password.'
                            : 'Sign in with your Nordic Naturals work email and the password sent to you. First-time sign-ins will be prompted to set a new password.'}
                        </p>
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div>
                            <label className="form-label" htmlFor="alias">
                              {audience === 'nordic' ? 'Email' : 'Email or username'}
                            </label>
                            <input
                              id="alias"
                              type="text"
                              className="input-field"
                              placeholder={audience === 'nordic' ? 'you@nordicnaturals.com' : 'Email or legacy username'}
                              value={alias}
                              onChange={(e) => setAlias(e.target.value)}
                              required
                              autoComplete="username"
                              inputMode={audience === 'nordic' ? 'email' : 'text'}
                            />
                          </div>
                          <div>
                            <label className="form-label" htmlFor="password">Password</label>
                            <input id="password" type="password" className="input-field" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                          </div>
                          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200"><p className="text-sm text-red-700">{error}</p></div>}
                          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Signing in…' : 'Sign in'}</button>
                          {audience === 'reviewer' && (
                            <p className="text-center text-xs text-gray-400">
                              or{' '}
                              <button
                                type="button"
                                onClick={() => { setLoginMode('magic'); setError(''); }}
                                className="text-pacific hover:underline"
                              >
                                send a sign-in link instead
                              </button>
                            </p>
                          )}
                        </form>
                      </>
                    )}
                  </div>
                  <div className="border-t border-gray-100 p-6 bg-gray-50/90 rounded-b-xl">
                    {audience === 'reviewer' ? (
                      <>
                        <p className="text-sm text-gray-600 mb-3">
                          <span className="font-semibold">New here?</span> Apply to join the reviewer network and start grading RCTs.
                        </p>
                        <Link href="/register" className="btn-secondary w-full text-center">Apply to be a reviewer</Link>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Need access?</span> Nordic team accounts are provisioned by the platform admin. Contact your manager or email <a href="mailto:garrett@windedvertigo.com" className="text-pacific underline">garrett@windedvertigo.com</a>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About / How It Works — audience-aware */}
        <section className="bg-white border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
            <h3 className="text-2xl font-bold text-pacific text-center mb-2">{content.aboutHeading}</h3>
            <p className="text-center text-sm text-gray-500 mb-10">
              Showing the experience for {content.label.toLowerCase()}s. Switch tabs above to see the other side.
            </p>
            <div className="grid sm:grid-cols-3 gap-8">
              {content.steps.map((item, idx) => (
                <div key={item.title} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-pacific-100 text-pacific flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  <div className="text-xs font-bold text-pacific-600 uppercase tracking-wider mb-1">Step {idx + 1}</div>
                  <h4 className="font-semibold text-pacific mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats strip — audience-aware */}
        <section className="border-t border-gray-100 bg-pacific">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-white">
              {content.stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-pacific-200 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Nordic Naturals. All rights reserved.</p>
            <a
              href="https://windedvertigo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition group"
            >
              <span className="text-xs">Powered by</span>
              <img
                src="/wv-wordmark.png"
                alt="winded.vertigo"
                className="h-5 w-auto opacity-60 group-hover:opacity-90 transition"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }}
              />
              <span className="font-bold text-sm tracking-tight text-gray-500 group-hover:text-gray-700 transition hidden" style={{ fontStyle: 'italic' }}>winded.vertigo</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <LandingContent />
      </Suspense>
    </AuthProvider>
  );
}
