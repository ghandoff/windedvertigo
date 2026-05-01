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

function ContactAvatarStatic({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}

export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Link href={`/contacts/${contact.id}`} className="block">
      <div className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-1.5">
        <div className="flex items-center gap-2">
          <ContactAvatarStatic
            name={contact.name}
            photoUrl={contact.profilePhotoUrl || undefined}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {contact.contactWarmth && (
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${WARMTH_DOT[contact.contactWarmth] ?? "bg-gray-300"}`} />
              )}
              <span className="font-medium text-sm truncate">{contact.name}</span>
            </div>
          </div>
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
