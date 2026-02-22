'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function LandingContent() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) { router.push('/dashboard'); return null; }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try { await login(alias, password); router.push('/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-11 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-pacific">SQR-RCT Platform</h1>
            <p className="text-xs text-gray-500">Nordic Naturals Research</p>
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#024a87]/75 via-[#024a87]/60 to-[#024a87]/80" />

          {/* Content */}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
                Study Quality Rubric<br className="hidden sm:block" /> for RCTs
              </h2>
              <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                Join our community of academics and industry experts evaluating randomized controlled trials in the nutraceutical and pharmaceutical domain.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row lg:justify-between items-start gap-8">
              {/* Value props — left column */}
              <div className="w-full lg:w-[38%] space-y-4">
                {[
                  { title: 'Review Studies', desc: 'Provide expert secondary reviews for published RCT studies using a validated, research-backed rubric.', color: 'nordic', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { title: 'Expert Network', desc: 'Connect with leading researchers and professionals in nutraceutical and pharmaceutical science.', color: 'gold', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                  { title: 'Build Credibility', desc: 'Earn badges, build your review portfolio, and generate evidence for promotion and tenure.', color: 'green', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
                ].map((item) => (
                  <div key={item.title} className={`card p-6 border-l-4 border-l-${item.color}-500 backdrop-blur-sm bg-white/95`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-${item.color}-50 flex items-center justify-center flex-shrink-0`}>
                        <svg className={`w-5 h-5 text-${item.color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d={item.icon} /></svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-pacific">{item.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Login card — right column */}
              <div className="w-full lg:w-[38%]">
                <div className="card shadow-xl backdrop-blur-sm bg-white/95">
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-pacific mb-1">Reviewer Login</h3>
                    <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="form-label" htmlFor="alias">Reviewer Alias</label>
                        <input id="alias" type="text" className="input-field" placeholder="Enter your alias" value={alias} onChange={(e) => setAlias(e.target.value)} required />
                      </div>
                      <div>
                        <label className="form-label" htmlFor="password">Password</label>
                        <input id="password" type="password" className="input-field" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200"><p className="text-sm text-red-700">{error}</p></div>}
                      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Signing in...' : 'Continue to Dashboard'}</button>
                    </form>
                  </div>
                  <div className="border-t border-gray-100 p-6 bg-gray-50/90 rounded-b-xl">
                    <p className="text-sm text-gray-600 mb-3"><span className="font-semibold">New Reviewer?</span> Register to get your alias and begin reviewing studies.</p>
                    <Link href="/register" className="btn-secondary w-full text-center">Register as Reviewer</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-white border-t border-gray-100 mt-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
            <h3 className="text-2xl font-bold text-pacific text-center mb-10">How It Works</h3>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                { step: '1', title: 'Submit Intake', desc: 'Extract key study details from the published article using our structured intake form.', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                { step: '2', title: 'Score Quality', desc: 'Rate the study across 11 validated rubric questions, each assessing a different quality dimension.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                { step: '3', title: 'Analyze Results', desc: 'View inter-rater reliability metrics, quality distributions, and detailed analytics across all reviews.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-pacific-100 text-pacific flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  <div className="text-xs font-bold text-pacific-600 uppercase tracking-wider mb-1">Step {item.step}</div>
                  <h4 className="font-semibold text-pacific mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-t border-gray-100 bg-pacific">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-white">
              {[
                { label: 'Rubric Questions', value: '11' },
                { label: 'Quality Dimensions', value: '3 Tiers' },
                { label: 'Max Score', value: '22' },
                { label: 'Reviewers per Article', value: 'Up to 3' },
              ].map((stat) => (
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
  return <AuthProvider><LandingContent /></AuthProvider>;
}
