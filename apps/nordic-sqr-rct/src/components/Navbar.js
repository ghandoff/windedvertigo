'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

// Wave 7.0.2 — centralized role check. Client check is UX hint; server
// is the source of truth for PCS routes (authenticatePcsRead/Write).
const hasPcsAccess = (user) => hasAnyRole(user, ROLE_SETS.PCS_ANY);

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/network', label: 'Network' },
  { href: '/analytics', label: 'Analytics', adminOnly: true },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

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

  // Client-side admin check is a UX hint only; the server is the source of
  // truth (admin API routes re-verify via verifyAdminFromNotion /
  // requireAdminLive). See Wave 7.0.1.
  const filteredNav = navItems.filter(item => !item.adminOnly || user?.isAdmin);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + platform name */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-8 w-auto" />
            <span className="text-sm font-bold text-pacific hidden sm:block">SQR-RCT</span>
          </Link>

          {/* Center: Nav links — desktop */}
          {user && (
            <div className="hidden md:flex items-center gap-0.5">
              {filteredNav.map(item => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-pacific-50 text-pacific-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right: Cross-link + profile + logout */}
          <div className="flex items-center gap-2">
            {user && hasPcsAccess(user) && (
              <Link
                href="/pcs"
                className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-md hover:bg-green-100 transition-colors hidden sm:inline-flex"
              >
                PCS
              </Link>
            )}

            {user?.isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md hover:bg-gray-200 transition-colors hidden sm:inline-flex"
              >
                Admin
              </Link>
            )}

            {user ? (
              <>
                <Link href="/profile" className="hidden sm:flex items-center gap-2 ml-1 hover:opacity-80 transition">
                  {profileImage ? (
                    <img src={profileImage} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-pacific text-white flex items-center justify-center text-[10px] font-bold uppercase">
                      {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                    </div>
                  )}
                </Link>
                <button onClick={handleLogout} className="hidden sm:inline-flex text-xs text-gray-400 hover:text-gray-600 transition ml-1">
                  Sign out
                </button>

                {/* Hamburger — mobile */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition"
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
              <Link href="/" className="text-sm text-pacific font-medium hover:text-pacific-800 transition">Sign in</Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {user && mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-3 pt-2 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-gray-100">
            {profileImage ? (
              <img src={profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-pacific text-white flex items-center justify-center text-[9px] font-bold uppercase">
                {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
              </div>
            )}
            <span className="text-sm text-gray-500">{user.alias}</span>
          </div>

          {filteredNav.map(item => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pacific-50 text-pacific-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <Link href="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
            Profile
          </Link>

          {hasPcsAccess(user) && (
            <Link href="/pcs" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-green-700 hover:bg-green-50">
              PCS Portal
            </Link>
          )}

          <button
            onClick={() => { setMobileOpen(false); handleLogout(); }}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
