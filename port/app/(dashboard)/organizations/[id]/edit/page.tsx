import { notFound } from "next/navigation";
import { getOrganization } from "@/lib/notion/organizations";
import { OrgEditForm } from "@/app/components/org-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrgEditPage({ params }: Props) {
  const { id } = await params;

  let org;
  try {
    org = await getOrganization(id);
  } catch {
    notFound();
  }

  return <OrgEditForm org={org} />;
}
