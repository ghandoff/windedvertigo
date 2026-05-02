'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isPcs = pathname?.startsWith('/pcs');

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Logo + platform */}
          <div className="flex items-center gap-2">
            <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-6 w-auto opacity-60" />
            <span className="text-xs text-gray-400 font-medium">
              {isPcs ? 'Product Claim Substantiation' : 'SQR-RCT'}
            </span>
          </div>

          {/* Center: Quick links */}
          {user && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {isPcs ? (
                <>
                  <Link href="/pcs" className="hover:text-gray-600 transition">Command Center</Link>
                  <span className="text-gray-200">|</span>
                  <Link href="/pcs/evidence" className="hover:text-gray-600 transition">Evidence</Link>
                  <span className="text-gray-200">|</span>
                  <Link href="/pcs/claims" className="hover:text-gray-600 transition">Claims</Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard" className="hover:text-gray-600 transition">Dashboard</Link>
                  <span className="text-gray-200">|</span>
                  <Link href="/reviews" className="hover:text-gray-600 transition">Reviews</Link>
                  {user.isAdmin && (
                    <>
                      <span className="text-gray-200">|</span>
                      <Link href="/admin" className="hover:text-gray-600 transition">Admin</Link>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Right: Copyright + Powered by */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>&copy; {new Date().getFullYear()} Nordic Naturals</span>
            <a
              href="https://windedvertigo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition"
            >
              Powered by <span className="font-medium">winded.vertigo</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
