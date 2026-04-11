import Link from "next/link";
import type { ActivityEntry } from "@/lib/db/queries";

const ACTION_LABELS: Record<string, string> = {
  person_added: "added",
  person_updated: "updated",
  relationship_added: "added a relationship",
  source_added: "added source",
  photo_uploaded: "uploaded a photo for",
};

const ACTION_ICONS: Record<string, string> = {
  person_added: "+",
  person_updated: "~",
  relationship_added: "~",
  source_added: "+",
  photo_uploaded: "+",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

function actorName(email: string): string {
  const local = email.split("@")[0];
  return local.replace(/[._]/g, " ");
}

export function ActivityFeed({
  entries,
  compact = false,
}: {
  entries: ActivityEntry[];
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">no recent activity</p>
    );
  }

  const shown = compact ? entries.slice(0, 8) : entries;

  return (
    <ul className="space-y-1.5">
      {shown.map((entry) => {
        const icon = ACTION_ICONS[entry.action] ?? "·";
        const label = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, " ");
        const hasPersonLink = entry.target_type === "person" && entry.target_id;

        return (
          <li key={entry.id} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-muted-foreground">
                {actorName(entry.actor_email)}{" "}
              </span>
              <span className="text-foreground">{label}</span>
              {entry.target_name && (
                <>
                  {" "}
                  {hasPersonLink ? (
                    <Link
                      href={`/person/${entry.target_id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {entry.target_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{entry.target_name}</span>
                  )}
                </>
              )}
              <span className="text-muted-foreground ml-1.5">
                {relativeTime(entry.created_at)}
              </span>
            </div>
          </li>
        );
      })}
      {compact && entries.length > 8 && (
        <li>
          <Link
            href="/activity"
            className="text-xs text-primary hover:underline"
          >
            view all activity
          </Link>
        </li>
      )}
    </ul>
  );
}
