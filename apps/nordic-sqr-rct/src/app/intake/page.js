// Wave 7.2 Phase 2 — /intake moved to /reviews/intake.
import { redirect } from 'next/navigation';

export default function IntakeRedirectPage({ searchParams }) {
  const qs = new URLSearchParams(searchParams || {}).toString();
  redirect(`/reviews/intake${qs ? `?${qs}` : ''}`);
}
