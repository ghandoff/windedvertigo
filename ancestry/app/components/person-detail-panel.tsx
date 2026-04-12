"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TreeNode, PersonEvent } from "@/lib/types";

type PersonDetailPanelProps = {
  person: TreeNode | null;
  allNodes: TreeNode[];
  events: PersonEvent[];
  onClose: () => void;
  onNavigateTo: (personId: string) => void;
  onSetFocal?: (personId: string) => void;
};

const SEX_ICONS: Record<string, string> = {
  M: "♂",
  F: "♀",
  X: "⚧",
  U: "·",
};

function formatEventType(type: string): string {
  return type.replace(/_/g, " ");
}

function RelativeLink({
  id,
  allNodes,
  onNavigateTo,
}: {
  id: string;
  allNodes: TreeNode[];
  onNavigateTo: (personId: string) => void;
}) {
  const node = allNodes.find((n) => n.id === id);
  if (!node) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigateTo(id)}
      className="text-left text-sm text-foreground hover:underline truncate block w-full"
    >
      {node.displayName}
      <span className="text-muted-foreground ml-1 text-xs">
        {SEX_ICONS[node.sex ?? "U"]}
      </span>
    </button>
  );
}

export function PersonDetailPanel({
  person,
  allNodes,
  events,
  onClose,
  onNavigateTo,
  onSetFocal,
}: PersonDetailPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = person !== null;

  // close on escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // close on click outside panel
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const icon = person ? (SEX_ICONS[person.sex ?? "U"] ?? "·") : "·";

  const lifespan = person
    ? [person.birthYear, person.isLiving ? "living" : (person.deathYear ?? "?")]
        .filter(Boolean)
        .join(" – ")
    : "";

  // find place from birth event if available
  const birthEvent = events.find((e) => e.event_type === "birth");
  const deathEvent = events.find((e) => e.event_type === "death");

  return (
    // backdrop layer — only captures clicks, no visual overlay
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      onClick={handleBackdropClick}
    >
      {/* slide-over panel */}
      <div
        ref={panelRef}
        className={`absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl transition-transform duration-200 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {person && (
          <>
            {/* header actions */}
            <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  router.push(`/person/${person.id}`);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="edit person"
                title="edit person"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 1.5l2.5 2.5L4.5 12H2v-2.5L10 1.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="close panel"
              >
                ✕
              </button>
            </div>

            {/* header */}
            <div className="p-4 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                {person.thumbnailUrl ? (
                  <img
                    src={person.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
                    {icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-foreground truncate">
                    {person.displayName}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lifespan}
                  </p>
                </div>
              </div>

              {/* birth/death places */}
              {(birthEvent?.description || deathEvent?.description) && (
                <div className="mt-2 space-y-0.5">
                  {birthEvent?.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      b. {birthEvent.description}
                    </p>
                  )}
                  {deathEvent?.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      d. {deathEvent.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* events */}
            {events.length > 0 && (
              <div className="p-4 pb-3 border-b border-border">
                <h3 className="text-xs font-medium text-muted-foreground mb-2">
                  events
                </h3>
                <ul className="space-y-1.5">
                  {events.map((evt) => (
                    <li key={evt.id} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground text-xs shrink-0 mt-0.5 w-16 text-right">
                        {evt.date?.display ?? "—"}
                      </span>
                      <span className="text-foreground">
                        {formatEventType(evt.event_type)}
                        {evt.description && (
                          <span className="text-muted-foreground text-xs ml-1">
                            · {evt.description}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* family */}
            <div className="p-4 pb-3 border-b border-border">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                family
              </h3>

              {/* parents */}
              {person.parentIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">parents</p>
                  <div className="space-y-0.5">
                    {person.parentIds.map((pid) => (
                      <RelativeLink
                        key={pid}
                        id={pid}
                        allNodes={allNodes}
                        onNavigateTo={onNavigateTo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* spouses */}
              {person.spouseIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">spouses</p>
                  <div className="space-y-0.5">
                    {person.spouseIds.map((sid) => (
                      <RelativeLink
                        key={sid}
                        id={sid}
                        allNodes={allNodes}
                        onNavigateTo={onNavigateTo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* children */}
              {person.childIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">children</p>
                  <div className="space-y-0.5">
                    {person.childIds.map((cid) => (
                      <RelativeLink
                        key={cid}
                        id={cid}
                        allNodes={allNodes}
                        onNavigateTo={onNavigateTo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {person.parentIds.length === 0 &&
                person.spouseIds.length === 0 &&
                person.childIds.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    no family connections recorded
                  </p>
                )}
            </div>

            {/* actions footer */}
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  router.push(`/person/${person.id}`);
                }}
                className="w-full text-sm text-center py-2 rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                view full profile
              </button>
              {onSetFocal && (
                <button
                  type="button"
                  onClick={() => onSetFocal(person.id)}
                  className="w-full text-sm text-center py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  set as focal person
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
