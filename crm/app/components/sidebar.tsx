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
  Radar,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "pipeline", href: "/", icon: LayoutDashboard },
  { label: "organizations", href: "/organizations", icon: Building2 },
  { label: "contacts", href: "/contacts", icon: Users },
  { label: "email", href: "/email", icon: Mail },
  { label: "events", href: "/events", icon: CalendarDays },
  { label: "campaigns", href: "/campaigns", icon: Megaphone },
  { label: "RFP radar", href: "/rfp-radar", icon: Radar },
  { label: "competitors", href: "/competitors", icon: Shield },
  { label: "social", href: "/social", icon: Share2 },
  { label: "assets", href: "/assets", icon: FolderOpen },
  { label: "AI hub", href: "/ai-hub", icon: Sparkles },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-white">
      <div className="flex h-20 items-center px-5 pt-2 border-b border-sidebar-border">
        <Link href="/" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/wordmark.png"
            alt="winded vertigo"
            width={140}
            height={74}
          />
        </Link>
      </div>
      <div className="px-5 pt-3 pb-1">
        <span className="text-xs font-medium tracking-wider text-white/50 uppercase">CRM</span>
      </div>
      <nav className="flex-1 py-2 px-3 space-y-0.5">
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
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
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
