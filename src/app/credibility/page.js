'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useState, useEffect } from 'react';

/* ─── Portal screenshot used as "image" inside mock posts ─── */
function PortalScreenshot() {
  return (
    <div className="select-none pointer-events-none" aria-hidden="true">
      {/* Mini browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded text-[9px] text-gray-400 px-2 py-0.5 font-mono truncate">
          sqr-rct.vercel.app/dashboard
        </div>
      </div>
      {/* Navbar mock */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-pacific" />
          <span className="text-[10px] font-bold text-pacific tracking-tight">SQR-RCT</span>
        </div>
        <div className="flex gap-3 ml-auto">
          <span className="text-[8px] text-pacific font-semibold px-1.5 py-0.5 rounded bg-blue-50">Dashboard</span>
          <span className="text-[8px] text-gray-400 font-medium">Reviews</span>
          <span className="text-[8px] text-gray-400 font-medium">Network</span>
        </div>
      </div>
      {/* Dashboard body */}
      <div className="bg-gray-50 px-4 py-3">
        <p className="text-[10px] font-bold text-pacific mb-2">Welcome back!</p>
        {/* Stat cards row */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[
            { n: '12', l: 'Reviews', c: 'text-pacific' },
            { n: '8', l: 'Available', c: 'text-gray-700' },
            { n: '17.4', l: 'Avg Score', c: 'text-gray-700' },
            { n: '▓▓░', l: 'Quality', c: 'text-green-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded border border-gray-200 px-2 py-1.5 text-center">
              <p className={`text-[11px] font-bold ${s.c}`}>{s.n}</p>
              <p className="text-[7px] text-gray-400 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
        {/* Articles preview */}
        <div className="bg-white rounded border border-gray-200 px-2.5 py-2">
          <p className="text-[9px] font-bold text-pacific mb-1.5">Articles Needing Review</p>
          {['Smith et al., 2024 — Omega-3 supplementation…', 'Chen et al., 2024 — DHA and cognitive…', 'Patel et al., 2023 — Fish oil in cardiovascular…'].map((t, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-t border-gray-100 first:border-t-0">
              <span className="text-[8px] text-gray-600 truncate flex-1">{t}</span>
              <span className="text-[7px] bg-pacific text-white px-1.5 py-0.5 rounded ml-2 shrink-0">Review</span>
            </div>
          ))}
        </div>
      </div>
      {/* Co-brand footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-1.5 flex items-center justify-center gap-1.5">
        <span className="text-[7px] text-gray-400">Powered by</span>
        <span className="text-[8px] font-semibold text-pacific">Nordic Naturals</span>
        <span className="text-[7px] text-gray-400">× SQR-RCT</span>
      </div>
    </div>
  );
}

/* ─── Copy button (reusable) ─── */
function CopyButton({ text, id, copiedId, onCopy, variant = 'light' }) {
  const isCopied = copiedId === id;
  const base = variant === 'dark'
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300';
  return (
    <button
      onClick={() => onCopy(text, id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition text-xs font-medium ${base}`}
    >
      {isCopied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-green-500">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Post Text
        </>
      )}
    </button>
  );
}

function CredibilityContent() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data.profile);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : 'Reviewer';
  const institution = profile?.affiliation || '[Your Institution]';
  const discipline = profile?.discipline || '[Your Discipline]';
  const alias = profile?.alias || 'reviewer';
  const reviewCount = profile?.reviewCount || 0;
  const initials = (profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '');

  // Template text
  const linkedInTemplate = `Proud to serve as an expert reviewer for Nordic Naturals' SQR-RCT Platform — a systematic quality review tool for randomized controlled trials in nutritional science. Contributing to evidence-based research standards in ${discipline}.\n\n#ResearchQuality #EBM #SystematicReview #ClinicalResearch`;

  const blueskyTemplate = `Serving as an expert reviewer on the SQR-RCT Platform by Nordic Naturals. Helping ensure quality standards for randomized controlled trials in nutritional science.\n\nsqr-rct.vercel.app\n\n#ResearchQuality #EBM`;

  const emailTemplate = `Dear [Dean/Department Chair Name],

I am writing to inform you of my involvement as an expert reviewer on the SQR-RCT (Systematic Quality Review of Randomized Controlled Trials) Platform, developed by Nordic Naturals.

In this role, I apply evidence-based methodology to evaluate the quality of published randomized controlled trials using a validated 11-item rubric. This work contributes to the advancement of research quality standards in nutritional science and ${discipline}.

To date, I have completed ${reviewCount} review${reviewCount !== 1 ? 's' : ''}. My participation has strengthened my expertise in critical appraisal, systematic review methodology, and evidence-based research evaluation.

I would be happy to provide additional details about this work and its relevance to our department's research mission.

Best regards,
${fullName}
${institution}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-pacific" />
            <p className="mt-4 text-gray-500 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard" className="card p-5 border-l-4 border-l-pacific-500 hover:shadow-md transition group">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-pacific-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-pacific-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Review Studies</h3>
                <p className="text-xs text-gray-500 mt-0.5">Start a new review</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-pacific ml-auto mt-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
          <Link href="/network" className="card p-5 border-l-4 border-l-gold-500 hover:shadow-md transition group">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Expert Network</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect with reviewers</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-pacific ml-auto mt-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
          <div className="card p-5 border-l-4 border-l-green-500 ring-2 ring-pacific bg-green-50">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-pacific text-sm">Build Credibility</h3>
                <p className="text-xs text-gray-500 mt-0.5">{reviewCount} review{reviewCount !== 1 ? 's' : ''} completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific">Build Credibility</h1>
          <p className="text-gray-600 mt-2">
            Promote your expert reviewer work with ready-to-use templates and digital assets.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            SOCIAL MEDIA TEMPLATES — realistic post mockups
            ═══════════════════════════════════════════════════════════ */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-pacific mb-2">Social Media Templates</h2>
          <p className="text-sm text-gray-500 mb-6">Ready-to-post templates styled as each platform. Copy the text, then paste directly.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── LinkedIn Post ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">LinkedIn</span>
                </div>
                <CopyButton text={linkedInTemplate} id="linkedin" copiedId={copiedId} onCopy={handleCopy} />
              </div>

              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                {/* Post header */}
                <div className="px-4 pt-3 pb-2 flex gap-3">
                  {profile?.profileImageUrl ? (
                    <img src={profile.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-pacific text-white flex items-center justify-center text-sm font-bold uppercase shrink-0">
                      {initials || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 leading-tight">{fullName}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5 truncate">{discipline} | {institution}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5 flex items-center gap-1">
                      1w &middot;
                      <svg className="w-3 h-3 text-gray-400 inline" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8a5 5 0 0110 0M2 8h12M8 3a8.5 8.5 0 012.6 5M8 3a8.5 8.5 0 00-2.6 5M8 13a8.5 8.5 0 01-2.6-5M8 13a8.5 8.5 0 002.6-5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
                    </p>
                  </div>
                  {/* 3-dot menu */}
                  <svg className="w-5 h-5 text-gray-400 ml-auto shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                </div>

                {/* Post text */}
                <div className="px-4 pb-3">
                  <p className="text-[13px] text-gray-800 leading-[1.4] whitespace-pre-line">{linkedInTemplate}</p>
                </div>

                {/* Portal screenshot as post image */}
                <PortalScreenshot />

                {/* Reactions */}
                <div className="px-4 py-1.5 flex items-center text-[11px] text-gray-500 border-b border-gray-200">
                  <span className="flex -space-x-0.5">
                    <span className="w-4 h-4 rounded-full bg-[#378FE9] flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 16 16"><path d="M2 14h1V8H2v6zm2.2-5.6c-.2-.3-.2-.7 0-.9L8 4l.4-.5c.3-.3.8-.1.8.3v2.3h3c.5 0 1 .4 1 .9l-.7 4c-.1.4-.4.7-.8.7H5.5c-.3 0-.5-.1-.7-.3l-.6-.8z"/></svg>
                    </span>
                    <span className="w-4 h-4 rounded-full bg-[#DF704D] flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3C5.5 1 2.5 2.5 2 5c-.5 3 2 5 6 8 4-3 6.5-5 6-8-.5-2.5-3.5-4-6-2z"/></svg>
                    </span>
                  </span>
                  <span className="ml-1.5">14</span>
                  <span className="ml-auto">2 comments</span>
                </div>

                {/* Action bar */}
                <div className="px-2 py-1 flex">
                  {[
                    { label: 'Like', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /> },
                    { label: 'Comment', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
                    { label: 'Repost', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> },
                    { label: 'Send', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /> },
                  ].map((a) => (
                    <button key={a.label} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded hover:bg-gray-100 transition text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">{a.icon}</svg>
                      <span className="text-[12px] font-medium">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bluesky Post ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 600 530" fill="#0085FF">
                    <path d="M135.72 44.03C202.216 93.951 273.74 195.86 300 249.491c26.262-53.631 97.782-155.54 164.28-205.461C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.632-175.895-31.511-189.63-71.734-2.355-6.902-3.45-10.15-3.706-7.416-.256-2.734-1.351.514-3.706 7.416-13.735 40.223-67.24 197.366-189.63 71.734-64.444-66.128-34.604-132.256 82.697-152.22-67.106 11.421-142.547-7.449-163.25-81.433C20.155 217.615 10 86.537 10 68.825c0-88.687 77.742-60.816 125.72-24.795z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">Bluesky</span>
                </div>
                <CopyButton text={blueskyTemplate} id="bluesky" copiedId={copiedId} onCopy={handleCopy} />
              </div>

              <div className="bg-[#161e27] rounded-xl overflow-hidden shadow-lg border border-gray-700/30">
                {/* Post header */}
                <div className="px-4 pt-3.5 pb-1 flex gap-3">
                  {profile?.profileImageUrl ? (
                    <img src={profile.profileImageUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-pacific text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                      {initials || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold text-white">{fullName}</span>
                      <span className="text-[13px] text-gray-500">@{alias}.bsky.social</span>
                      <span className="text-[13px] text-gray-600">&middot;</span>
                      <span className="text-[13px] text-gray-500">1w</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                </div>

                {/* Post text */}
                <div className="px-4 pb-3">
                  <p className="text-[14px] text-gray-100 leading-relaxed whitespace-pre-line">Serving as an expert reviewer on the SQR-RCT Platform by Nordic Naturals. Helping ensure quality standards for randomized controlled trials in nutritional science.</p>
                  <p className="text-[14px] text-[#0085FF] mt-2">sqr-rct.vercel.app</p>
                  <p className="text-[14px] text-[#0085FF] mt-1">#ResearchQuality #EBM</p>
                </div>

                {/* Portal screenshot as post image */}
                <div className="mx-4 mb-3 rounded-lg overflow-hidden border border-gray-700/40">
                  <PortalScreenshot />
                </div>

                {/* Engagement icons */}
                <div className="px-4 pb-3 flex items-center gap-0">
                  {/* Reply */}
                  <button className="flex items-center gap-1.5 text-gray-500 hover:text-[#0085FF] transition pr-6 py-1">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-[12px]">2</span>
                  </button>
                  {/* Repost */}
                  <button className="flex items-center gap-1.5 text-gray-500 hover:text-green-400 transition pr-6 py-1">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-[12px]">3</span>
                  </button>
                  {/* Like */}
                  <button className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 transition pr-6 py-1">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="text-[12px]">8</span>
                  </button>
                  {/* Spacer */}
                  <div className="flex-1" />
                  {/* Bookmark */}
                  <button className="text-gray-500 hover:text-[#0085FF] transition px-2 py-1">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  {/* Share */}
                  <button className="text-gray-500 hover:text-[#0085FF] transition pl-1 py-1">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            EMAIL TEMPLATES
            ═══════════════════════════════════════════════════════════ */}
        <div className="card p-6 mb-8">
          <h2 className="text-lg font-bold text-pacific mb-6">Email Templates</h2>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email to Dean / Department Chair
              </h3>
              <CopyButton text={emailTemplate} id="email" copiedId={copiedId} onCopy={handleCopy} />
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{emailTemplate}</pre>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            DIGITAL ASSETS
            ═══════════════════════════════════════════════════════════ */}
        <div className="card p-6 mb-8">
          <h2 className="text-lg font-bold text-pacific mb-6">Digital Assets</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Reviewer Badge */}
            <a
              href={`/api/credibility/badge?name=${encodeURIComponent(fullName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6 border-2 border-dashed border-pacific text-center hover:bg-blue-50 transition"
            >
              <div className="w-16 h-16 bg-pacific rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <h3 className="font-semibold text-pacific mb-2">Reviewer Badge</h3>
              <p className="text-sm text-gray-600">Download your SVG badge</p>
              <div className="flex items-center justify-center gap-2 text-pacific text-sm font-medium mt-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </div>
            </a>

            {/* Certificate */}
            <a
              href={`/api/credibility/certificate?name=${encodeURIComponent(fullName)}&reviews=${reviewCount}&institution=${encodeURIComponent(institution)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6 border-2 border-dashed border-pacific text-center hover:bg-blue-50 transition"
            >
              <div className="w-16 h-16 bg-pacific rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-pacific mb-2">Certificate of Contribution</h3>
              <p className="text-sm text-gray-600">Download your PDF certificate</p>
              <div className="flex items-center justify-center gap-2 text-pacific text-sm font-medium mt-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </div>
            </a>

            {/* LinkedIn Follow */}
            <a
              href="https://www.linkedin.com/company/nordic-naturals"
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6 border-2 border-dashed border-pacific text-center hover:bg-blue-50 transition"
            >
              <div className="w-16 h-16 bg-[#0A66C2] rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-pacific mb-2">Follow on LinkedIn</h3>
              <p className="text-sm text-gray-600">Connect with Nordic Naturals</p>
              <div className="flex items-center justify-center gap-2 text-pacific text-sm font-medium mt-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open
              </div>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CredibilityPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <CredibilityContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
