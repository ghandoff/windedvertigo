import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveUserContext } from "@/lib/role";
import { PageHeader } from "@/app/components/page-header";
import { ReimbursementGenerator } from "./reimbursement-generator";

export const revalidate = 120;

export default async function ReimbursementPage() {
  const ctx = await resolveUserContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <PageHeader
        title="reimbursement invoice"
        description="generate a printable invoice for your approved expense reimbursements"
      >
        <Link
          href="/work/time"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; back to time
        </Link>
      </PageHeader>
      <ReimbursementGenerator userName={ctx.name} userEmail={ctx.email} />
    </>
  );
}
