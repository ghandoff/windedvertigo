'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';
import PlatformToggle from '@/components/PlatformToggle';

// Wave 7.2 — Unified nav shell. Replaces Navbar.js (reviewer surface) and
// PcsNav.js (research/PCS surface). Pass variant="reviewer" or variant="research".
// Client checks here are UX hints; the server is the source of truth.

const hasPcsAccess = (user) => hasAnyRole(user, ROLE_SETS.PCS_ANY);
const hasSqrAccess = (user) => hasAnyRole(user, ROLE_SETS.SQR_REVIEWERS);
const hasPcsWriteAccess = (user) => hasAnyRole(user, ROLE_SETS.PCS_WRITERS);

// Reviewer (SQR-RCT) desktop + mobile nav items
const reviewerNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/network', label: 'Network' },
  { href: '/analytics', label: 'Analytics', adminOnly: true },
];

// Research (PCS) mobile nav items — desktop center is intentionally empty
const researchMobileNavItems = [
  { href: '/pcs', label: 'Command Center', exact: true },
  { href: '/pcs/claims', label: 'Claims' },
  { href: '/pcs/evidence', label: 'Evidence' },
  { href: '/pcs/ingredients', label: 'Ingredients' },
  { href: '/pcs/documents', label: 'Documents' },
  { href: '/pcs/requests', label: 'Requests' },
  { href: '/pcs/data', label: 'Data' },
];

/**
 * WorkspaceShell — unified top nav for both platform surfaces.
 *
 * @param {{ variant: 'reviewer' | 'research' }} props
 *   variant="reviewer"  SQR-RCT surface: logo → /dashboard, desktop center nav links visible
 *   variant="research"  PCS surface:     logo → /pcs,       desktop center is empty (sidebar handles it)
 */
export default function WorkspaceShell({ variant = 'reviewer' }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  const isReviewer = variant === 'reviewer';

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

  // Escape key closes mobile menu (carried over from PcsNav)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    if (mobileOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Reviewer: filter adminOnly items by role
  const filteredReviewerNav = reviewerNavItems.filter(item => !item.adminOnly || user?.isAdmin);

  // Research: filter writeOnly items by role
  const filteredResearchMobileNav = researchMobileNavItems.filter(
    item => !item.writeOnly || hasPcsWriteAccess(user)
  );

  const logoHref = isReviewer ? (user ? '/dashboard' : '/') : '/pcs';
  const currentPlatform = isReviewer ? 'sqr-rct' : 'pcs';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Left: Logo (+ hamburger for research variant, which puts it left of center) */}
          {isReviewer ? (
            <Link href={logoHref} className="flex items-center gap-2">
              <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-8 w-auto" />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link href={logoHref} className="flex items-center gap-2">
                <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-8 w-auto" />
              </Link>
              {/* Hamburger — mobile (research variant places it here, beside logo) */}
              {user && (
                <button
                  className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition"
                  onClick={() => setMobileOpen(prev => !prev)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileOpen}
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
              )}
            </div>
          )}

          {/* Center: Nav links (reviewer) or intentionally empty (research) */}
          {isReviewer ? (
            user && (
              <div className="hidden md:flex items-center gap-0.5">
                {filteredReviewerNav.map(item => {
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
            )
          ) : (
            /* Research: desktop center empty — sidebar handles wayfinding */
            <div className="hidden md:block flex-1" aria-hidden="true" />
          )}

          {/* Right: Platform toggle + Admin chip + profile + sign out + hamburger (reviewer) */}
          <div className="flex items-center gap-2">
            <PlatformToggle currentPlatform={currentPlatform} />

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
                <Link
                  href="/reviews/profile"
                  className={`${isReviewer ? 'hidden sm:flex' : 'flex'} items-center gap-2 ml-1 hover:opacity-80 transition`}
                >
                  {profileImage ? (
                    <img src={profileImage} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-pacific text-white flex items-center justify-center text-[10px] font-bold uppercase">
                      {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                    </div>
                  )}
                </Link>

                <button
                  onClick={isReviewer ? handleLogout : logout}
                  className={`${isReviewer ? 'hidden sm:inline-flex' : ''} text-xs text-gray-400 hover:text-gray-600 transition ml-1`}
                >
                  Sign out
                </button>

                {/* Hamburger — mobile (reviewer variant places it on the right) */}
                {isReviewer && (
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
                )}
              </>
            ) : (
              isReviewer && (
                <Link href="/" className="text-sm text-pacific font-medium hover:text-pacific-800 transition">Sign in</Link>
              )
            )}
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {user && mobileOpen && (
        isReviewer ? (
          /* Reviewer mobile dropdown */
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

            {filteredReviewerNav.map(item => {
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

            <Link href="/reviews/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
              Profile
            </Link>

            {hasPcsAccess(user) && (
              <Link href="/research/pcs" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-green-700 hover:bg-green-50">
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
        ) : (
          /* Research mobile dropdown */
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 pb-3 pt-2 space-y-1">
            {filteredResearchMobileNav.map(item => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
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

            {hasSqrAccess(user) && (
              <Link href="/reviews/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-pacific-600 hover:bg-pacific-50">
                SQR-RCT Reviews
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
                Admin
              </Link>
            )}
          </nav>
        )
      )}
    </nav>
  );
}
