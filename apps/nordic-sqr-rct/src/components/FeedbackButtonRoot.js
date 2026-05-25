'use client';

/**
 * Wraps `FeedbackButton` in its own AuthProvider + ToastProvider context
 * so it can be mounted in the ROOT layout — independent of whether a
 * given page already has its own AuthProvider scope.
 *
 * Why a wrapper instead of lifting AuthProvider into the root layout
 * unconditionally: AuthProvider is already mounted in 19 different
 * layout / page files (every authenticated subtree, every preview
 * route, etc.). Lifting it to root would require removing all 19 inner
 * mounts to avoid double-fetching `/api/auth/me`, which is a big
 * refactor and a lot of regression risk for what's essentially a UX
 * polish ("show the feedback button on every page, not just /pcs/*").
 *
 * Trade-off: pages with their own AuthProvider now have TWO providers
 * (one inner, one from this root mount). Each makes one independent
 * `/api/auth/me` call on mount. That's an extra request per page load
 * but no functional impact — both providers converge on the same
 * session cookie answer. If/when we lift AuthProvider into the root
 * for real, we'd delete this file and consolidate.
 *
 * The button itself short-circuits with `if (!user) return null;` so
 * on unauthenticated routes (login, register) it's invisible.
 */

import { AuthProvider } from '@/lib/useAuth';
import { ToastProvider } from '@/components/Toast';
import FeedbackButton from './FeedbackButton';

export default function FeedbackButtonRoot() {
  return (
    <AuthProvider>
      <ToastProvider>
        <FeedbackButton />
      </ToastProvider>
    </AuthProvider>
  );
}
