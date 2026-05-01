"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  NAV_SECTIONS,
  BOTTOM_ITEMS,
  isNavItemActive,
  type NavSection,
} from "./nav-config";
import { UserBlock } from "./user-block";

function SectionGroup({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate: () => void;
}) {
  const hasActiveChild = section.items.some((item) =>
    isNavItemActive(item.href, pathname),
  );
  const [open, setOpen] = useState(section.defaultOpen || hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-medium tracking-wider text-white/50 uppercase hover:text-white/70 transition-colors"
      >
        {section.title}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const isActive = isNavItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
        </div>
      )}
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden flex h-14 items-center px-4 border-b bg-sidebar text-white">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger aria-label="open navigation menu" className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 transition-colors">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-sidebar text-white p-0">
          <SheetTitle className="flex h-16 items-center px-5 border-b border-sidebar-border">
            <img
              src="/images/wordmark.png"
              alt="winded vertigo"
              width={120}
              height={64}

            />
          </SheetTitle>
          <div className="px-5 pt-3 pb-1">
            <span className="text-xs font-medium tracking-wider text-white/50 uppercase">workspace</span>
          </div>
          <nav className="py-2 px-3 space-y-2 overflow-y-auto">
            {NAV_SECTIONS.map((section) => (
              <SectionGroup
                key={section.title}
                section={section}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            ))}
            <div className="border-t border-sidebar-border pt-2 mt-2 space-y-0.5">
              {BOTTOM_ITEMS.map((item) => {
                const isActive = isNavItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
            </div>
          </nav>
          <UserBlock />
        </SheetContent>
      </Sheet>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/wordmark.png"
        alt="winded vertigo"
        width={100}
        height={53}
        className="ml-3"
      />
    </div>
  );
}
