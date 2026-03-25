import { Badge } from "@/components/ui/badge";
import type { Activity } from "@/lib/notion/types";
import {
  Mail, Phone, Users, Handshake, Globe, FileText, MessageCircle, MoreHorizontal,
  Video,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  "email sent": Mail,
  "email received": Mail,
  "meeting": Video,
  "call": Phone,
  "conference encounter": Users,
  "intro made": Handshake,
  "linkedin message": Globe,
  "proposal shared": FileText,
  "other": MoreHorizontal,
};

const TYPE_COLORS: Record<string, string> = {
  "email sent": "bg-blue-100 text-blue-700",
  "email received": "bg-blue-50 text-blue-600",
  "meeting": "bg-green-100 text-green-700",
  "call": "bg-green-50 text-green-600",
  "conference encounter": "bg-purple-100 text-purple-700",
  "intro made": "bg-yellow-100 text-yellow-700",
  "linkedin message": "bg-blue-100 text-blue-700",
  "proposal shared": "bg-orange-100 text-orange-700",
  "other": "bg-gray-100 text-gray-600",
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-green-50 text-green-700 border-green-200",
  neutral: "bg-gray-50 text-gray-600 border-gray-200",
  "no response": "bg-yellow-50 text-yellow-700 border-yellow-200",
  declined: "bg-red-50 text-red-600 border-red-200",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">no activities logged yet</p>
        <p className="text-xs mt-1">click "log activity" to add the first touchpoint</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((act, i) => {
        const Icon = TYPE_ICONS[act.type] ?? MoreHorizontal;
        const colorClass = TYPE_COLORS[act.type] ?? "bg-gray-100 text-gray-600";
        const isLast = i === activities.length - 1;

        return (
          <div key={act.id} className="flex gap-3">
            {/* timeline line + icon */}
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${colorClass}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
            </div>

            {/* content */}
            <div className="pb-6 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{act.activity}</span>
                {act.outcome && (
                  <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[act.outcome] ?? ""}`}>
                    {act.outcome}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {formatDate(act.date?.start)}
                </span>
                <Badge variant="outline" className="text-[10px]">{act.type}</Badge>
                {act.loggedBy && (
                  <span className="text-[10px] text-muted-foreground">by {act.loggedBy}</span>
                )}
              </div>
              {act.notes && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {act.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
