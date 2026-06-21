import { redirect } from "next/navigation";

export default function FindArticlesPage() {
  redirect("/bibliography?tab=find");
}
