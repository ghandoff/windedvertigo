"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
}

interface UrlTabsProps {
  /** URL search param name. @default "tab" */
  paramKey?: string;
  /** Available tabs. */
  tabs: readonly TabDef[];
  /** Active tab key (server-resolved from searchParams). */
  activeTab: string;
}

/**
 * Client-side tab bar that syncs the active tab to a URL search parameter
 * via router.replace (no full navigation, no scroll reset).
 *
 * The *server* component reads `searchParams` and passes `activeTab` down,
 * so first paint always matches the URL. This component only handles clicks.
 */
export function UrlTabs({ paramKey = "tab", tabs, activeTab }: UrlTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setTab = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === tabs[0]?.key) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, key);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, paramKey, tabs],
  );

  return (
    <div className="inline-flex items-center gap-1 mb-6 bg-muted rounded-lg p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-all rounded-md",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
