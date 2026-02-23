/**
 * /analytics — redirects to /profile?manage=true.
 */

import { redirect } from "next/navigation";

export default function AnalyticsPage() {
  redirect("/profile?manage=true");
}
