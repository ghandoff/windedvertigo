/**
 * /find/hunt → redirects to /find?mode=hunt
 *
 * All find modes now live on the single /find page for instant
 * client-side switching. This redirect preserves old bookmarks.
 */

import { redirect } from "next/navigation";

export default function HuntPage() {
  redirect("/find?mode=hunt");
}
