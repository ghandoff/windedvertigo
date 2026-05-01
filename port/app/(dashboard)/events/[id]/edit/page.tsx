import { getEvent } from "@/lib/notion/events";
import { EventEditForm } from "@/app/components/event-edit-form";
import { PageHeader } from "@/app/components/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);

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
