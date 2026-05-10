"use client";
/**
 * Client component wrapper for the edit-link cell in EventsTable.
 *
 * Needed because the parent (EventsTable) is a Server Component and
 * cannot pass `onClick` function props to `"use client"` components
 * (functions are not serializable across the RSC boundary).
 * Moving stopPropagation here keeps the click isolation while satisfying RSC rules.
 */

import Link from "next/link";
import { TableCell } from "@/components/ui/table";
import { Pencil } from "lucide-react";

interface Props {
  href: string;
}

export function EventTableEditCell({ href }: Props) {
  return (
    <TableCell onClick={(e) => e.stopPropagation()}>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Edit event"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
    </TableCell>
  );
}
