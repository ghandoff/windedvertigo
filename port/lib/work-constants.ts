/**
 * Shared constants for the Work module — prevents drift across
 * contract board, studio board, backlog, and mobile work item views.
 */

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export const TYPE_COLORS: Record<string, string> = {
  plan: "bg-blue-50 text-blue-600",
  design: "bg-purple-50 text-purple-600",
  research: "bg-indigo-50 text-indigo-600",
  implement: "bg-green-50 text-green-600",
  "publish/present": "bg-pink-50 text-pink-600",
  review: "bg-yellow-50 text-yellow-600",
  admin: "bg-gray-50 text-gray-600",
  coordinate: "bg-teal-50 text-teal-600",
};

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const CYCLE_STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 border-blue-200",
  planned: "bg-amber-100 text-amber-700 border-amber-200",
  complete: "bg-green-100 text-green-700 border-green-200",
};

export const MILESTONE_STATUS_COLORS: Record<string, string> = {
  "not started": "bg-gray-100 text-gray-600 border-gray-200",
  "in progress": "bg-amber-100 text-amber-700 border-amber-200",
  complete: "bg-green-100 text-green-700 border-green-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
};
