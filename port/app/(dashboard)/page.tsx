import { redirect } from "next/navigation";

// / → /mo (Mo's dashboard) is the canonical landing page.
// The docent welcome banner lives on /mo so new teammates still see it.
export default function DashboardPage() {
  redirect("/mo");
}
