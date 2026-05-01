"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  NAV_SECTIONS,
  BOTTOM_ITEMS,
  isNavItemActive,
  type NavItem,
  type NavSection,
} from "./nav-config";
import { UserBlock } from "./user-block";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isNavItemActive(item.href, pathname);
  return (
    <Link
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
}

function CollapsibleSection({ section, pathname }: { section: NavSection; pathname: string }) {
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
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

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
        <span className="text-xs font-medium tracking-wider text-white/50 uppercase">workspace</span>
      </div>
      <nav className="flex-1 py-2 px-3 space-y-2 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <CollapsibleSection
            key={section.title}
            section={section}
            pathname={pathname}
          />
        ))}
        <div className="border-t border-sidebar-border pt-2 mt-2 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
      <UserBlock />
    </aside>
  );
}
