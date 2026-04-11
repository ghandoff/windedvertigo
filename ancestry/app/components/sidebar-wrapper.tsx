"use client";

import { MobileDrawer } from "./mobile-drawer";

/**
 * renders sidebar content in a fixed aside on desktop,
 * and inside a slide-out drawer on mobile.
 */
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* desktop sidebar */}
      <aside className="hidden md:block w-80 shrink-0 overflow-y-auto border-r border-border p-4 space-y-6">
        {children}
      </aside>

      {/* mobile drawer */}
      <MobileDrawer>
        {children}
      </MobileDrawer>
    </>
  );
}
