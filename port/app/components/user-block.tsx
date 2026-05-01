"use client";

import { signOut } from "next-auth/react";
import { LogOut, Clock } from "lucide-react";
import { useUser } from "./user-provider";
import { useTimer, formatElapsed } from "./timer-context";
import { cn } from "@/lib/utils";

/**
 * User block — sits at the bottom of the sidebar.
 *
 * Renders:
 *   - A subtle "timer running" strip when a timer is active (pulse +
 *     elapsed time). Clicking it does nothing today — the popover in
 *     the top-bar is the control surface. Visual confirmation only.
 *   - User avatar (first-initial) + display name.
 *   - Sign-out button.
 */
export function UserBlock({ compact = false }: { compact?: boolean }) {
  const user = useUser();
  const timer = useTimer();
  if (!user) return null;

  const displayName = user.firstName || user.name || user.email.split("@")[0];
  const initial = (user.firstName || user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="border-t border-sidebar-border">
      {/* Running timer indicator — only when active */}
      {timer.running && (
        <div
          className="px-3 py-2 border-b border-sidebar-border flex items-center gap-2 text-xs"
          aria-live="polite"
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <Clock className="h-3 w-3 text-white/60" aria-hidden="true" />
          <span className="font-mono tabular-nums text-white/90">
            {formatElapsed(timer.elapsed)}
          </span>
          <span className="text-white/50 truncate flex-1">
            {timer.description || "timer running"}
          </span>
        </div>
      )}

      <div
        className={cn(
          "px-3 pt-3 pb-3",
          "flex items-center gap-3",
        )}
      >
        {/* avatar */}
        <div
          className="shrink-0 rounded-full bg-accent text-white h-8 w-8 flex items-center justify-center text-sm font-semibold"
          aria-hidden="true"
        >
          {initial}
        </div>

        {/* name + sign-out */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors mt-0.5"
            aria-label="sign out"
          >
            <LogOut className="h-3 w-3" aria-hidden="true" />
            sign out
          </button>
        </div>
      </div>
    </div>
  );
}
