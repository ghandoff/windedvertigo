/**
 * Redirect /runs → /playbook.
 * The full runs list now lives at /playbook/runs.
 * This route stays for backward compatibility.
 */

import { redirect } from "next/navigation";

export default function RunsPage() {
  redirect("/playbook");
}
