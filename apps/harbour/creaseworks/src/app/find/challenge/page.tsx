/**
 * /find/challenge → redirects to /find?mode=challenge
 *
 * All find modes now live on the single /find page for instant
 * client-side switching. This redirect preserves old bookmarks.
 */

import { redirect } from "next/navigation";

export default function ChallengePage() {
  redirect("/find?mode=challenge");
}
