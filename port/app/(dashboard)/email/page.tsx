import { redirect } from "next/navigation";

export default function EmailRedirect() {
  redirect("/campaigns?tab=email");
}
