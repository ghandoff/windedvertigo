// Wave 7.2 Phase 2 — /dashboard moved to /reviews/dashboard.
// next.config.js handles the 301 redirect before this page is reached.
// This shim is a belt-and-suspenders fallback for edge cases where
// the middleware or a direct server-render lands here.
import { permanentRedirect } from 'next/navigation';

export default function DashboardRedirectPage() {
  permanentRedirect('/reviews/dashboard');
}
