import { redirect } from "next/navigation";

export default function ContractsRedirect() {
  redirect("/projects?type=contracts");
}
