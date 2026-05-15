// Wave 7.2 Phase 2 — /score moved to /reviews/score.
import { redirect } from 'next/navigation';

export default function ScoreRedirectPage({ searchParams }) {
  const qs = new URLSearchParams(searchParams || {}).toString();
  redirect(`/reviews/score${qs ? `?${qs}` : ''}`);
}
