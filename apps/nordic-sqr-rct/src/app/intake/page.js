// Wave 7.2 Phase 2 — /intake moved to /reviews/intake.
import { redirect } from 'next/navigation';

export default async function IntakeRedirectPage({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams(params || {}).toString();
  redirect(`/reviews/intake${qs ? `?${qs}` : ''}`);
}
