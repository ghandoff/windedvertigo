"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface PlayContext {
  name: string;
  age_groups: string[];
  contexts: string[];
  energy: string;
  created_at: string;
}

interface Props {
  contexts: PlayContext[];
  activeContextName: string | null;
}

const ENERGY_ICONS: Record<string, string> = {
  chill: "🌿",
  medium: "🌤️",
  active: "⚡",
  any: "🎲",
};

const CONTEXT_ICONS: Record<string, string> = {
  home: "🏠",
  classroom: "🏫",
  outdoors: "🌳",
  travel: "✈️",
};

export default function PlayContextSwitcher({
  contexts: initialContexts,
  activeContextName: initialActive,
}: Props) {
  const router = useRouter();
  const [contexts, setContexts] = useState(initialContexts);
  const [active, setActive] = useState(initialActive);
  const [switching, setSwitching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function switchContext(name: string) {
    if (name === active) return;
    setSwitching(name);
    try {
      const res = await fetch(apiUrl("/api/onboarding/context"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextName: name }),
      });
      if (res.ok) {
        setActive(name);
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  }

  async function deleteContext(name: string) {
    if (!confirm(`remove "${name}" context?`)) return;
    setDeleting(name);
    try {
      const res = await fetch(apiUrl("/api/onboarding/context"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextName: name }),
      });
      if (res.ok) {
        const data = await res.json();
        setContexts(data.contexts);
        setActive(data.active);
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-3">
      {contexts.map((ctx) => {
        const isActive = ctx.name === active;
        const isSwitching = switching === ctx.name;
        const isDeleting = deleting === ctx.name;

        return (
          <div
            key={ctx.name}
            className={`rounded-xl border-2 px-4 py-3 transition-all ${
              isActive
                ? "border-sienna bg-sienna/5"
                : "border-cadet/10 hover:border-cadet/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-cadet truncate">
                    {ctx.name}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-semibold tracking-wide px-1.5 py-px rounded-full bg-sienna/10 text-sienna">
                      active
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {ctx.contexts.map((c) => (
                    <span key={c} className="text-xs text-cadet/40">
                      {CONTEXT_ICONS[c] ?? ""} {c}
                    </span>
                  ))}
                  {ctx.energy && (
                    <span className="text-xs text-cadet/40">
                      {ENERGY_ICONS[ctx.energy] ?? ""} {ctx.energy}
                    </span>
                  )}
                  {ctx.age_groups.length > 0 && (
                    <span className="text-xs text-cadet/40">
                      &middot; {ctx.age_groups.join(", ")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {!isActive && (
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchContext(ctx.name)}
                    className="text-xs text-sienna/60 hover:text-sienna transition-colors disabled:opacity-40"
                  >
                    {isSwitching ? "..." : "use this"}
                  </button>
                )}
                <a
                  href={`/onboarding?edit=true&context=${encodeURIComponent(ctx.name)}`}
                  className="text-xs text-cadet/30 hover:text-cadet/50 transition-colors"
                >
                  edit
                </a>
                {contexts.length > 1 && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => deleteContext(ctx.name)}
                    className="text-xs text-cadet/20 hover:text-redwood/60 transition-colors disabled:opacity-40"
                  >
                    {isDeleting ? "..." : "remove"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* add new context button */}
      <a
        href="/onboarding?edit=true"
        className="flex items-center justify-center rounded-xl border-2 border-dashed border-cadet/10 px-4 py-3 text-sm text-cadet/40 hover:border-sienna/30 hover:text-sienna/60 transition-colors"
      >
        + add a play context
      </a>
    </div>
  );
}

