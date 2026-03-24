"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "pipeline", href: "/", icon: LayoutDashboard },
  { label: "organizations", href: "/organizations", icon: Building2 },
  { label: "contacts", href: "/contacts", icon: Users },
  { label: "email", href: "/email", icon: Mail },
  { label: "events", href: "/events", icon: CalendarDays },
  { label: "RFP radar", href: "/rfp-radar", icon: Radar },
  { label: "competitors", href: "/competitors", icon: Shield },
  { label: "social", href: "/social", icon: Share2 },
  { label: "assets", href: "/assets", icon: FolderOpen },
] as const;

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden flex h-14 items-center px-4 border-b bg-sidebar text-sidebar-foreground">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-sidebar text-sidebar-foreground p-0">
          <SheetTitle className="flex h-14 items-center px-5 border-b border-sidebar-border text-sidebar-foreground">
            w.v. CRM
          </SheetTitle>
          <nav className="py-4 px-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <span className="ml-3 text-lg font-semibold">w.v. CRM</span>
    </div>
  );
}
