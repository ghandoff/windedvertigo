"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TreePine, Search, Activity, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "tree", icon: TreePine },
  { href: "/?focus=search", label: "search", icon: Search },
  { href: "/activity", label: "activity", icon: Activity },
  { href: "/settings", label: "settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm md:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center rounded-md transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
