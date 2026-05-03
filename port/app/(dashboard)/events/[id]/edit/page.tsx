import { notFound } from "next/navigation";
import { getEventByIdFromSupabase } from "@/lib/supabase/events";
import { EventEditForm } from "@/app/components/event-edit-form";
import { PageHeader } from "@/app/components/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventByIdFromSupabase(id);
  if (!event) return notFound();

  return (
    <>
      <PageHeader
        title="edit event"
        description={event.event}
      />
      <EventEditForm event={event} />
    </>
  );
}
