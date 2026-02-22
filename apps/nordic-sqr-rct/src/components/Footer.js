'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Branding */}
          <div className="flex items-center gap-2">
            <img src="/nordic-logo.png" alt="Nordic Naturals" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-gray-700">SQR-RCT Platform</span>
          </div>

          {/* Links */}
          {user && (
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href="/dashboard" className="hover:text-pacific transition">Dashboard</Link>
              {user.isAdmin && (
                <>
                  <Link href="/analytics" className="hover:text-pacific transition">Analytics</Link>
                  <Link href="/admin" className="hover:text-pacific transition">Admin</Link>
                </>
              )}
            </div>
          )}

          {/* Copyright + Powered by */}
          <div className="text-right">
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Nordic Naturals. All rights reserved.
            </p>
            <a
              href="https://windedvertigo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-gray-400 hover:text-gray-600 transition group"
            >
              <span>Powered by</span>
              <img
                src="/wv-wordmark.png"
                alt="winded.vertigo"
                className="h-5 w-auto opacity-60 group-hover:opacity-90 transition"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }}
              />
              <span className="font-bold text-sm tracking-tight text-gray-500 group-hover:text-gray-700 transition hidden" style={{ fontStyle: 'italic' }}>
                winded.vertigo
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
