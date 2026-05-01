/**
 * Shared navigation configuration for the port sidebar.
 *
 * Single source of truth — both desktop and mobile sidebars import
 * from here. Phase 2 restructure: 12 items → 7 items + 2 bottom.
 */

import {
  Building2,
  Users,
  FolderOpen,
  FolderKanban,
  Megaphone,
  Target,
  Clock,
  Compass,
  Shield,
  TrendingUp,
  Sparkles,
  PenLine,
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
      { label: "projects", href: "/projects", icon: FolderKanban },
      { label: "time", href: "/work/time", icon: Clock },
    ],
  },
  {
    title: "pipeline",
    items: [
      { label: "opportunities", href: "/opportunities", icon: Target },
      { label: "contacts", href: "/contacts", icon: Users },
      { label: "organisations", href: "/organizations", icon: Building2 },
      { label: "competitors", href: "/competitors", icon: Shield },
    ],
  },
  {
    title: "outreach",
    items: [
      { label: "campaigns", href: "/campaigns", icon: Megaphone },
      { label: "content", href: "/content", icon: PenLine },
      { label: "assets", href: "/assets", icon: FolderOpen },
    ],
  },
  {
    title: "insights",
    items: [
      { label: "analytics", href: "/analytics", icon: TrendingUp },
      { label: "ai hub", href: "/ai-hub", icon: Sparkles },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { label: "docent", href: "/docent", icon: Compass },
];

// ── helpers ──────────────────────────────────────────────────

/** Check if a nav item is active given the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
