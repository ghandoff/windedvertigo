import { Suspense } from "react";
import { PageHeader } from "@/app/components/page-header";
import { EmailComposer } from "@/app/components/email-composer";

export const revalidate = 300;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EmailPage(props: Props) {
  const params = await props.searchParams;

  return (
    <>
      <PageHeader
        title="email"
        description="compose and send outreach emails with pre-written bespoke copy"
      />
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <EmailComposer preselectedOrgId={params.org} />
      </Suspense>
    </>
  );
}
