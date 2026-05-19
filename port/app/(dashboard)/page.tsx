import { redirect } from "next/navigation";

// / → /strategy is the canonical landing page.
// The docent welcome banner lives on /strategy so new teammates still see it.
export default function DashboardPage() {
  redirect("/strategy");
}
