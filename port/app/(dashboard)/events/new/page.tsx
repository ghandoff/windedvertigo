import { EventEditForm } from "@/app/components/event-edit-form";
import { PageHeader } from "@/app/components/page-header";

export default function NewEventPage() {
  return (
    <>
      <PageHeader
        title="add event"
        description="add a new event or conference to track"
      />
      <EventEditForm />
    </>
  );
}
