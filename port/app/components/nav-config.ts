/**
 * Shared navigation configuration for the port sidebar.
 *
 * Single source of truth — both desktop and mobile sidebars import
 * from here.
 *
 * IA model (2026-06): each AI agent is the *head* of its domain section
 * rather than grouped under a single "agents" list. Mo leads outreach,
 * PaM leads delivery, cARL leads knowledge, Biz leads growth (added when
 * /biz ships), Opsy + Fin lead operations. Agent items carry
 * `badge: "agent"` so the roster stays recognisable once dispersed.
 */

import {
  Activity,
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
  Anchor,
  ListChecks,
  BookOpen,
  Library,
  FileSearch,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── types ────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  /** marks an AI-agent item so the renderer shows the agent indicator dot */
  badge?: "agent";
}

export interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// ── sections ─────────────────────────────────────────────────
// every section opens by default so each agent (the section head) is
// visible at a glance — the "agent is the department" model.

export const NAV_SECTIONS: NavSection[] = [
  {
    // cARL leads · shared inputs the collective + agents draw on
    title: "knowledge",
    defaultOpen: true,
    items: [
      { label: "carl", href: "/carl", icon: BookOpen, badge: "agent" },
      { label: "find articles", href: "/find-articles", icon: FileSearch },
      { label: "council", href: "/council", icon: MessagesSquare },
      { label: "bibliography", href: "/bibliography", icon: Library },
    ],
  },
  {
    // PaM leads · production + execution
    title: "delivery",
    defaultOpen: true,
    items: [
      { label: "pam", href: "/pam", icon: ListChecks, badge: "agent" },
      { label: "designs", href: "/designs", icon: FileText },
      { label: "projects", href: "/projects", icon: FolderKanban },
      { label: "time", href: "/work/time", icon: Clock },
    ],
  },
  {
    // Biz leads (added when /biz ships) · pipeline + relationships
    title: "growth",
    defaultOpen: true,
    items: [
      { label: "pipeline", href: "/opportunities", icon: Target },
      { label: "contacts", href: "/contacts", icon: Users },
    ],
  },
  {
    // Mo leads · brand, campaigns, scheduling
    title: "outreach",
    defaultOpen: true,
    items: [
      { label: "mo", href: "/mo", icon: LineChart, badge: "agent" },
      { label: "campaigns", href: "/campaigns", icon: Megaphone },
      { label: "compose", href: "/compose", icon: FileText },
      { label: "events", href: "/events", icon: CalendarDays },
      { label: "bookings", href: "/bookings", icon: CalendarClock },
    ],
  },
  {
    // Opsy + Fin lead · back-office systems + tools
    title: "operations",
    defaultOpen: true,
    items: [
      { label: "ops", href: "/ops", icon: Activity, badge: "agent" },
      { label: "finn", href: "/finn", icon: DollarSign, badge: "agent", ownerOnly: true },
      { label: "harbour", href: "/harbour", icon: Anchor },
      { label: "ai hub", href: "/ai-hub", icon: Sparkles },
      { label: "docent", href: "/docent", icon: Compass },
    ],
  },
];

// harbour / ai-hub / docent moved into the operations section above.
export const BOTTOM_ITEMS: NavItem[] = [];

// ── helpers ──────────────────────────────────────────────────

/** Check if a nav item is active given the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
