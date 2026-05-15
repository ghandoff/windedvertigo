// Wave 7.2 Phase 2 — /profile moved to /reviews/profile.
import { permanentRedirect } from 'next/navigation';

export default function ProfileRedirectPage() {
  permanentRedirect('/reviews/profile');
}
