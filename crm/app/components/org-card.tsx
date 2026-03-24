import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, FitBadge } from "./priority-badge";
import type { Organization } from "@/lib/notion/types";

interface OrgCardProps {
  org: Organization;
}

export function OrgCard({ org }: OrgCardProps) {
  return (
    <Link href={`/organizations/${org.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-3 space-y-2">
          <p className="font-medium text-sm leading-tight truncate">
            {org.organization}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {org.priority && <PriorityBadge value={org.priority} />}
            {org.fitRating && <FitBadge value={org.fitRating} />}
          </div>
          {org.category.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {org.category.slice(0, 2).map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {c}
                </Badge>
              ))}
              {org.category.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{org.category.length - 2}
                </span>
              )}
            </div>
          )}
          {org.friendship && (
            <p className="text-[10px] text-muted-foreground truncate">
              {org.friendship}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
