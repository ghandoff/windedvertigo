"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type NodeContextMenuProps = {
  x: number;
  y: number;
  personId: string;
  personName: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  isCollapsible: boolean;
  onClose: () => void;
  onQuickAdd: (type: "parent" | "child" | "spouse") => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onSetFocal?: () => void;
  onToggleCollapse?: () => void;
  onDelete: () => void;
};

export function NodeContextMenu({
  x,
  y,
  personId,
  personName,
  hasChildren,
  isCollapsed,
  isCollapsible,
  onClose,
  onQuickAdd,
  onViewDetails,
  onEdit,
  onSetFocal,
  onToggleCollapse,
  onDelete,
}: NodeContextMenuProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // adjust position if menu overflows viewport
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > vw - 8) adjustedX = x - rect.width;
    if (y + rect.height > vh - 8) adjustedY = y - rect.height;
    if (adjustedX < 8) adjustedX = 8;
    if (adjustedY < 8) adjustedY = 8;

    setPosition({ x: adjustedX, y: adjustedY });
  }, [x, y]);

  // close on escape or click outside
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose],
  );

  const itemClass =
    "px-3 py-1.5 text-xs hover:bg-muted cursor-pointer rounded-sm transition-colors";
  const separator = <div className="border-t border-border my-1" />;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg py-1"
      style={{ left: position.x, top: position.y }}
    >
      {confirmingDelete ? (
        <div className="px-3 py-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            delete {personName.toLowerCase()}?
          </p>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
              onClick={() => handleAction(onDelete)}
            >
              confirm
            </button>
            <button
              className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => setConfirmingDelete(false)}
            >
              cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* quick-add actions */}
          <button
            className={itemClass + " w-full text-left"}
            onClick={() => handleAction(() => onQuickAdd("parent"))}
          >
            + add parent
          </button>
          <button
            className={itemClass + " w-full text-left"}
            onClick={() => handleAction(() => onQuickAdd("spouse"))}
          >
            + add spouse
          </button>
          <button
            className={itemClass + " w-full text-left"}
            onClick={() => handleAction(() => onQuickAdd("child"))}
          >
            + add child
          </button>

          {separator}

          {/* navigation actions */}
          <button
            className={itemClass + " w-full text-left"}
            onClick={() => handleAction(onViewDetails)}
          >
            view details
          </button>
          <button
            className={itemClass + " w-full text-left"}
            onClick={() => handleAction(onEdit)}
          >
            edit person
          </button>
          {onSetFocal && (
            <button
              className={itemClass + " w-full text-left"}
              onClick={() => handleAction(onSetFocal)}
            >
              set as focal person
            </button>
          )}

          {/* collapse/expand */}
          {isCollapsible && onToggleCollapse && (
            <>
              {separator}
              <button
                className={itemClass + " w-full text-left"}
                onClick={() => handleAction(onToggleCollapse)}
              >
                {isCollapsed ? "expand branch" : "collapse branch"}
              </button>
            </>
          )}

          {separator}

          {/* destructive action */}
          <button
            className={itemClass + " w-full text-left text-red-500"}
            onClick={() => setConfirmingDelete(true)}
          >
            delete person
          </button>
        </>
      )}
    </div>
  );
}
