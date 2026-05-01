import { redirect } from "next/navigation";

export default function StudiosRedirect() {
  redirect("/projects?type=studios");
}
