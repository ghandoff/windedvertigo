'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  // Fetch profile image in background
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.profile?.profileImageUrl) {
          setProfileImage(data.profile.profileImageUrl);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-9 w-auto" />
            <span className="text-lg font-bold text-pacific">SQR-RCT</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/dashboard" className="text-sm font-semibold text-pacific px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Dashboard</Link>
              <Link href="/reviews" className="text-sm font-semibold text-pacific px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Reviews</Link>
              <Link href="/network" className="text-sm font-semibold text-pacific px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Network</Link>
              {user.isAdmin && <Link href="/analytics" className="text-sm font-semibold text-pacific px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Analytics</Link>}
              {user.isAdmin && <Link href="/admin" className="text-sm font-semibold text-pacific px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Admin</Link>}
            </div>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/profile" className="hidden sm:flex items-center gap-2.5 hover:opacity-80 transition">
                  {profileImage ? (
                    <img src={profileImage} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pacific text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                      {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                    </div>
                  )}
                  <span className="text-sm font-medium text-pacific">{user.alias}</span>
                </Link>
                <button onClick={handleLogout} className="hidden sm:inline-flex text-sm text-gray-400 hover:text-gray-600 transition">Sign out</button>

                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <Link href="/" className="btn-ghost text-sm">Sign in</Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {user && mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 border-b border-gray-100 mb-2">
              {profileImage ? (
                <img src={profileImage} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pacific text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                  {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                </div>
              )}
              <span>Signed in as <span className="font-medium text-gray-700">{user.alias}</span></span>
            </div>
            <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Dashboard
            </Link>
            <Link href="/reviews" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              My Reviews
            </Link>
            <Link href="/network" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Expert Network
            </Link>
            <Link href="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              My Profile
            </Link>
            {user.isAdmin && (
              <>
                <Link href="/analytics" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Analytics
                </Link>
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Admin
                </Link>
              </>
            )}
            <button
              onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
