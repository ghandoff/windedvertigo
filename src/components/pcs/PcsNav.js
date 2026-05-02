'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { hasAnyRole, ROLE_SETS } from '@/lib/auth/has-any-role';

// Wave 6.0 — Option D Data Hub collapse.
// The former trio (Export, Import, Label Import) is now a single "Data"
// entry that targets /pcs/data, where a tab strip handles Imports,
// Label Imports, and Export. Role-gating happens inside the hub so the
// entry itself is always visible — pcs-readonly users will see the
// Export tab active and the other two tabs rendering a disabled
// placeholder instead of having the entry disappear entirely.
const navItems = [
  { href: '/pcs', label: 'Command Center', exact: true },
  { href: '/pcs/claims', label: 'Claims' },
  { href: '/pcs/evidence', label: 'Evidence' },
  { href: '/pcs/ingredients', label: 'Ingredients' },
  { href: '/pcs/documents', label: 'Documents' },
  { href: '/pcs/requests', label: 'Requests' },
  { href: '/pcs/data', label: 'Data' },
];

// Wave 7.0.2 — role checks moved to `hasAnyRole`/`ROLE_SETS`.
// Client gating here is a UX hint; the server is the source of truth.
const hasPcsWriteAccess = (user) => hasAnyRole(user, ROLE_SETS.PCS_WRITERS);
const hasSqrAccess = (user) => hasAnyRole(user, ROLE_SETS.SQR_REVIEWERS);

export default function PcsNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  // Wave 6.0 — writeOnly is no longer used on top-level items (Data is
  // universally visible; the tabs inside /pcs/data handle their own
  // gating). Filter preserved defensively in case an item reintroduces
  // the flag later.
  const filteredNavItems = navItems.filter(item => !item.writeOnly || hasPcsWriteAccess(user));

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

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [menuOpen]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + platform name */}
          <div className="flex items-center gap-3">
            <Link href="/pcs" className="flex items-center gap-2">
              <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-8 w-auto" />
              <span className="text-sm font-bold text-pacific hidden sm:block">PCS</span>
            </Link>

            {/* Hamburger — mobile */}
            <button
              className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition"
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Center: Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-0.5">
            {filteredNavItems.map(item => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
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
          </nav>

          {/* Right: Cross-links + user + logout */}
          <div className="flex items-center gap-2">
            {hasSqrAccess(user) && (
              <Link
                href="/dashboard"
                className="text-xs font-medium text-pacific-700 bg-pacific-50 px-2.5 py-1 rounded-md hover:bg-pacific-100 transition-colors hidden sm:inline-flex"
              >
                SQR-RCT
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
            <Link href="/profile" className="flex items-center hover:opacity-80 transition ml-1">
              {profileImage ? (
                <img src={profileImage} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pacific text-white flex items-center justify-center text-[10px] font-bold uppercase">
                  {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
                </div>
              )}
            </Link>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition ml-1">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-4 pb-3 pt-2 space-y-1">
          {filteredNavItems.map(item => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
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
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-pacific-600 hover:bg-pacific-50">
              SQR-RCT Reviews
            </Link>
          )}
          {user?.isAdmin && (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
