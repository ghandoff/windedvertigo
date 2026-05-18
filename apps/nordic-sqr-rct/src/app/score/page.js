// Wave 7.2 Phase 2 — /score moved to /reviews/score.
import { redirect } from 'next/navigation';

export default async function ScoreRedirectPage({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams(params || {}).toString();
  redirect(`/reviews/score${qs ? `?${qs}` : ''}`);
}
