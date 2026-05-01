/**
 * Redirect /runs/new → /reflections/new.
 * Backward compatibility after the runs → reflections rename.
 */

import { redirect } from "next/navigation";

export default function OldNewRunPage() {
  redirect("/reflections/new");
}
