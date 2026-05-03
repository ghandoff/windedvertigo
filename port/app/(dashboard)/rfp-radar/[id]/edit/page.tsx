/**
 * RFP edit page — allows manual correction/enrichment of RFP fields.
 */

import { notFound } from "next/navigation";
import { getRfpOpportunityByIdFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { PageHeader } from "@/app/components/page-header";
import { RfpEditForm } from "@/app/components/rfp-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RfpEditPage({ params }: Props) {
  const { id } = await params;

  const rfp = await getRfpOpportunityByIdFromSupabase(id);
  if (!rfp) notFound();

  return (
    <>
      <PageHeader title={`edit: ${rfp.opportunityName}`} />
      <RfpEditForm rfpId={id} rfp={rfp} />
    </>
  );
}
