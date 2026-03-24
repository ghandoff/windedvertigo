"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Mail,
  CalendarDays,
  Shield,
  Share2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Pipeline", href: "/", icon: LayoutDashboard },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Email", href: "/email", icon: Mail },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Competitors", href: "/competitors", icon: Shield },
  { label: "Social", href: "/social", icon: Share2 },
  { label: "Assets", href: "/assets", icon: FolderOpen },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-5 border-b border-sidebar-border">
        <span className="text-lg font-semibold tracking-tight">w.v. CRM</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
