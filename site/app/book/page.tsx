import { redirect } from "next/navigation";

// Booking pages require a host-specific slug from your invitation link.
// e.g. /book/garrett-jaeger — there is no browsable index.
export default function BookIndexPage() {
  redirect("/");
}
