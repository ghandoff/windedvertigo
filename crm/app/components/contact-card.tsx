import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@/lib/notion/types";

const WARMTH_DOT: Record<string, string> = {
  cold: "bg-blue-400",
  lukewarm: "bg-yellow-400",
  warm: "bg-orange-400",
  hot: "bg-red-500",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Link href={`/contacts/${contact.id}`} className="block">
      <div className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-1.5">
        <div className="flex items-center gap-2">
          {contact.contactWarmth && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${WARMTH_DOT[contact.contactWarmth] ?? "bg-gray-300"}`} />
          )}
          <span className="font-medium text-sm truncate">{contact.name}</span>
        </div>

        {contact.role && (
          <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
        )}

        {contact.contactType && (
          <Badge variant="outline" className="text-[10px]">{contact.contactType}</Badge>
        )}

        {contact.lastContacted?.start && (
          <p className="text-[10px] text-muted-foreground">
            last: {formatDate(contact.lastContacted.start)}
          </p>
        )}

        {contact.nextAction && (
          <p className="text-[10px] text-accent truncate">
            next: {contact.nextAction}
          </p>
        )}
      </div>
    </Link>
  );
}
