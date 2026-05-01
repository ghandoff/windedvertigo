import { redirect } from "next/navigation";

export default function RfpRadarRedirect() {
  redirect("/opportunities?tab=rfps");
}
