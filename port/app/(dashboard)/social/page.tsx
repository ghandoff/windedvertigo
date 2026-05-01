import { redirect } from "next/navigation";

export default function SocialRedirect() {
  redirect("/campaigns?tab=social");
}
