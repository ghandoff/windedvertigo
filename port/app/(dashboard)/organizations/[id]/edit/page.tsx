import { notFound } from "next/navigation";
import { getOrganizationByIdFromSupabase } from "@/lib/supabase/organizations";
import { OrgEditForm } from "@/app/components/org-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrgEditPage({ params }: Props) {
  const { id } = await params;
  const org = await getOrganizationByIdFromSupabase(id);
  if (!org) notFound();
  return <OrgEditForm org={org} />;
}
