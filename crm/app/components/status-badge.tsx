import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CONNECTION_COLORS: Record<string, string> = {
  unengaged: "bg-gray-100 text-gray-600 border-gray-200",
  exploring: "bg-amber-50 text-amber-700 border-amber-200",
  "in progress": "bg-orange-50 text-orange-700 border-orange-200",
  collaborating: "bg-blue-50 text-blue-700 border-blue-200",
  champion: "bg-green-50 text-green-700 border-green-200",
  steward: "bg-purple-50 text-purple-700 border-purple-200",
  "past client": "bg-gray-50 text-gray-500 border-gray-200",
};

const OUTREACH_COLORS: Record<string, string> = {
  "Not started": "bg-gray-100 text-gray-600 border-gray-200",
  Researching: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  "In conversation": "bg-orange-50 text-orange-700 border-orange-200",
  "Proposal sent": "bg-pink-50 text-pink-700 border-pink-200",
  "Active client": "bg-green-50 text-green-700 border-green-200",
};

interface StatusBadgeProps {
  value: string;
  type?: "connection" | "outreach";
  className?: string;
}

export function StatusBadge({ value, type = "connection", className }: StatusBadgeProps) {
  if (!value) return null;
  const colors = type === "outreach" ? OUTREACH_COLORS : CONNECTION_COLORS;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", colors[value] ?? "bg-gray-50 text-gray-500", className)}
    >
      {value}
    </Badge>
  );
}
