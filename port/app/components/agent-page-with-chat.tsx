"use client";

/**
 * AgentPageWithChat — layout wrapper that embeds a chat panel alongside a
 * dashboard page.
 *
 * Mobile (< md): tab toggle at the top; dashboard is the default view.
 * Desktop (≥ md): CSS grid split — dashboard on the left, chat panel pinned
 * on the right as a sticky sidebar.
 *
 * User info is read from UserContext (provided by the dashboard layout) so
 * each page doesn't need to call auth() or pass userName as a prop.
 */

import { useState } from "react";
import { AgentChat } from "./agent-chat";
import { useUser } from "./user-provider";
import type { AgentId } from "@/lib/agent/agent-router";

export interface AgentPageWithChatProps {
  agentId: Exclude<AgentId, "port">;
  children: React.ReactNode;
}

export function AgentPageWithChat({ agentId, children }: AgentPageWithChatProps) {
  const user = useUser();
  const userName =
    user?.firstName ||
    user?.name?.split(" ")[0]?.toLowerCase() ||
    "there";

  const [activeView, setActiveView] = useState<"dashboard" | "chat">("dashboard");

  return (
    <>
      {/* ── Mobile tab toggle ───────────────────────────────────── */}
      <div className="md:hidden flex border-b border-border -mx-6 px-6 mb-4 gap-0">
        <button
          onClick={() => setActiveView("dashboard")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 -mb-px ${
            activeView === "dashboard"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent"
          }`}
        >
          dashboard
        </button>
        <button
          onClick={() => setActiveView("chat")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 -mb-px ${
            activeView === "chat"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent"
          }`}
        >
          chat
        </button>
      </div>

      {/* ── Responsive split layout ─────────────────────────────── */}
      <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
        {/* Dashboard content — hidden on mobile when in chat view */}
        {/* min-w-0: overrides CSS Grid's default min-width:auto so the 1fr cell */}
        {/* respects its assigned fraction rather than expanding to content width. */}
        {/* Without this, DraggableKanban's 1152px minimum forces the cell wider  */}
        {/* than the viewport, causing cards to bleed behind the sidebar.          */}
        <div className={`min-w-0 ${activeView === "chat" ? "hidden md:block" : ""}`}>
          {children}
        </div>

        {/* Chat panel — hidden on mobile when in dashboard view */}
        <aside
          className={`${
            activeView === "dashboard" ? "hidden md:flex" : "flex"
          } flex-col h-[calc(100vh-9rem)] md:sticky md:top-6 md:h-[calc(100vh-8rem)] border border-border rounded-xl p-4 bg-card`}
        >
          <AgentChat
            initialAgent={agentId}
            userName={userName}
            compact
          />
        </aside>
      </div>
    </>
  );
}
