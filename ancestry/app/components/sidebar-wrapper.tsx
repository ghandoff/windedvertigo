"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { MobileDrawer } from "./mobile-drawer";

/**
 * renders sidebar content in a collapsible aside on desktop,
 * and inside a slide-out drawer on mobile.
 */
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 overflow-y-auto border-r border-border transition-all duration-200 ${
          collapsed ? "w-0 p-0 overflow-hidden" : "w-80 p-4"
        }`}
      >
        <div className="space-y-6">{children}</div>
      </aside>

      {/* desktop collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex fixed bottom-4 left-2 z-30 h-8 w-8 items-center justify-center rounded-md bg-card border border-border shadow-sm hover:bg-muted transition-colors"
        aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
        title={collapsed ? "expand sidebar" : "collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeft className="h-4 w-4 text-muted-foreground" />
        ) : (
          <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* mobile drawer */}
      <MobileDrawer>
        {children}
      </MobileDrawer>
    </>
  );
}
