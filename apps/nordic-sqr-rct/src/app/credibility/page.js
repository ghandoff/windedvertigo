// Wave 7.2 Phase 2 — /credibility moved to /reviews/credibility.
import { permanentRedirect } from 'next/navigation';

export default function CredibilityRedirectPage() {
  permanentRedirect('/reviews/credibility');
}
