/**
 * Shared navigation configuration for the port sidebar.
 *
 * Single source of truth — both desktop and mobile sidebars import
 * from here. Phase 2 restructure: 12 items → 7 items + 2 bottom.
 */

import {
  Users,
  FolderKanban,
  Megaphone,
  Target,
  Clock,
  Compass,
  Sparkles,
  CalendarDays,
  CalendarClock,
  LineChart,
  MessagesSquare,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── types ────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// ── sections ─────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "delivery",
    defaultOpen: true,
    items: [
      { label: "strategy", href: "/strategy", icon: LineChart },
      { label: "council", href: "/council", icon: MessagesSquare },
      { label: "designs", href: "/designs", icon: FileText },
      { label: "projects", href: "/projects", icon: FolderKanban },
      { label: "time", href: "/work/time", icon: Clock },
    ],
  },
  {
    title: "growth",
    items: [
      { label: "pipeline", href: "/opportunities", icon: Target },
      { label: "contacts", href: "/contacts", icon: Users },
    ],
  },
  {
    title: "outreach",
    items: [
      { label: "campaigns", href: "/campaigns", icon: Megaphone },
      { label: "compose", href: "/compose", icon: FileText },
      { label: "events", href: "/events", icon: CalendarDays },
      { label: "bookings", href: "/bookings", icon: CalendarClock },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { label: "ai hub", href: "/ai-hub", icon: Sparkles },
  { label: "docent", href: "/docent", icon: Compass },
];

// ── helpers ──────────────────────────────────────────────────

/** Check if a nav item is active given the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
