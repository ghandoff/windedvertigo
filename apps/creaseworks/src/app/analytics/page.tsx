/**
 * /analytics — redirects to /profile?tab=analytics.
 */

import { redirect } from "next/navigation";

export default function AnalyticsPage() {
  redirect("/profile?tab=analytics");
}
