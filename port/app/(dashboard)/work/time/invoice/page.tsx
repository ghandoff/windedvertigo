import { Suspense } from "react";
import Link from "next/link";
import { queryProjects } from "@/lib/notion/projects";
import { PageHeader } from "@/app/components/page-header";
import { InvoiceGenerator } from "./components/invoice-generator";

export const revalidate = 120;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function InvoiceContent({ searchParams }: Props) {
  const params = await searchParams;
  const projectId = params.projectId;
  const month = params.month;

  // Fetch contract projects (invoicing is for contract work)
  const { data: projects } = await queryProjects(
    { type: "contract" },
    { pageSize: 50 },
  );

  // Also include in-progress projects without a type set (legacy)
  const { data: activeProjects } = await queryProjects(
    { status: "in progress" },
    { pageSize: 50 },
  );

  // Merge and deduplicate
  const seen = new Set<string>();
  const allProjects = [...projects, ...activeProjects].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const projectOptions = allProjects.map((p) => ({
    id: p.id,
    name: p.project,
  }));

  return (
    <InvoiceGenerator
      projects={projectOptions}
      initialProjectId={projectId}
      initialMonth={month}
    />
  );
}

export default function InvoicePage(props: Props) {
  return (
    <>
      <PageHeader
        title="generate invoice"
        description="create and send branded invoices from approved timesheets"
      >
        <Link
          href="/work/time"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← back to time
        </Link>
      </PageHeader>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading projects...</div>}>
        <InvoiceContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
