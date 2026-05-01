/**
 * /matcher → redirects to /find
 *
 * Preserves existing bookmarks and links after the route rename.
 * Passes through any query params (e.g., ?mode=challenge).
 */

import { redirect } from "next/navigation";

export default function MatcherRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  // Next.js 16: searchParams is a Promise in server components
  // redirect() works synchronously so we build the URL from the raw object
  // We can't await in a sync component, so use a simple redirect
  redirect("/find");
}
