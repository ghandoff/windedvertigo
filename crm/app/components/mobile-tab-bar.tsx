"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "log", href: "/m/log", icon: PenLine },
  { label: "contacts", href: "/m/contacts", icon: Users },
  { label: "today", href: "/m/today", icon: CalendarDays },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const isActive = pathname.endsWith(tab.href) || pathname.endsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors",
                isActive ? "text-accent" : "text-muted-foreground",
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
