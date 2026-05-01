"use client";

import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { ContactCard } from "./contact-card";
import type { Contact } from "@/lib/notion/types";

const STAGE_COLUMNS: KanbanColumn[] = [
  { key: "stranger", label: "stranger", color: "bg-gray-400" },
  { key: "introduced", label: "introduced", color: "bg-blue-400" },
  { key: "in conversation", label: "in conversation", color: "bg-yellow-400" },
  { key: "warm connection", label: "warm connection", color: "bg-orange-400" },
  { key: "active collaborator", label: "active collaborator", color: "bg-green-500" },
  { key: "inner circle", label: "inner circle", color: "bg-purple-500" },
];

interface ContactKanbanItem {
  id: string;
  kanbanStatus: string;
  contact: Contact;
}

export function ContactPipeline({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();

  const items: ContactKanbanItem[] = contacts.map((c) => ({
    id: c.id,
    kanbanStatus: c.relationshipStage || "stranger",
    contact: c,
  }));

  async function handleStatusChange(itemId: string, newStatus: string) {
    await fetch(`/api/contacts/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipStage: newStatus }),
    });
    router.refresh();
  }

  return (
    <DraggableKanban
      columns={STAGE_COLUMNS}
      items={items}
      renderCard={(item) => <ContactCard contact={item.contact} />}
      onStatusChange={handleStatusChange}
    />
  );
}
