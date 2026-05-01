"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { label: "contracts", href: "/work/contracts" },
  { label: "studios", href: "/work/studios" },
  { label: "time", href: "/work/time" },
] as const;

export function WorkModeNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-border">
      {MODES.map((mode) => {
        const isActive = pathname.startsWith(mode.href);
        return (
          <Link
            key={mode.href}
            href={mode.href}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {mode.label}
          </Link>
        );
      })}
    </div>
  );
}
