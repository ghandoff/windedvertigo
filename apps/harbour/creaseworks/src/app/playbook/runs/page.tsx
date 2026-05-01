/**
 * Redirect /playbook/runs → /playbook/reflections.
 * Backward compatibility after the runs → reflections rename.
 */

import { redirect } from "next/navigation";

export default function OldPlaybookRunsPage() {
  redirect("/playbook/reflections");
}
