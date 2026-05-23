'use client';

/**
 * /welcome — unconditional redirect to the Command Center.
 *
 * The welcome card-grid caused redirect loops for Nordic team members
 * (2026-05-22). Replaced with a direct passthrough. Magic-link verify
 * now lands on /research/pcs directly; this page is a safety net for
 * any bookmarked or externally linked /welcome URLs.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/research/pcs');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-pacific-200 border-t-pacific rounded-full animate-spin" />
    </div>
  );
}
