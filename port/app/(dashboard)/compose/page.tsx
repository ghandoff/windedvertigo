import { redirect } from "next/navigation";

export default function ComposePage() {
  redirect("/campaigns?tab=drafts");
}
