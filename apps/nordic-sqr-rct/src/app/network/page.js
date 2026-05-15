// Wave 7.2 Phase 2 — /network moved to /reviews/network.
import { permanentRedirect } from 'next/navigation';

export default function NetworkRedirectPage() {
  permanentRedirect('/reviews/network');
}
