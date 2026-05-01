"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StaggeredEntrance } from "@/app/components/staggered-entrance";

// ── types ────────────────────────────────────────────────

export interface KanbanColumn {
  key: string;
  label: string;
  color: string;
}

export interface KanbanItem {
  id: string;
  kanbanStatus: string;
}

interface DraggableKanbanProps<T extends KanbanItem> {
  columns: readonly KanbanColumn[];
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  renderOverlay?: (item: T) => React.ReactNode;
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>;
}

// ── droppable column ─────────────────────────────────────

function DroppableColumn({
  column,
  children,
  count,
}: {
  column: KanbanColumn;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-lg transition-colors ${
        isOver ? "bg-accent/20 ring-2 ring-accent/30" : "bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${column.color}`} />
          <h3 className="text-sm font-medium">{column.label}</h3>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="p-2 space-y-2 min-h-[60px]">
          {children}
          {count === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {isOver ? "drop here" : "no items"}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── draggable card wrapper ───────────────────────────────

function DraggableCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

// ── main component ───────────────────────────────────────

export function DraggableKanban<T extends KanbanItem>({
  columns,
  items: initialItems,
  renderCard,
  renderOverlay,
  onStatusChange,
}: DraggableKanbanProps<T>) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const hasAnimated = useRef(false);

  // Sync with server data after refresh (only when not mid-save)
  useEffect(() => {
    if (!saving) setItems(initialItems);
  }, [initialItems, saving]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    hasAnimated.current = true;
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const itemId = String(active.id);
      const newStatus = String(over.id);

      // Find the item and check if status actually changed
      const item = items.find((i) => i.id === itemId);
      if (!item || item.kanbanStatus === newStatus) return;

      // Optimistic update — move card immediately
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, kanbanStatus: newStatus } : i)),
      );

      // Persist to Notion
      setSaving(itemId);
      try {
        await onStatusChange(itemId, newStatus);
      } catch {
        // Revert on error
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, kanbanStatus: item.kanbanStatus } : i,
          ),
        );
      } finally {
        setSaving(null);
      }
    },
    [items, onStatusChange],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {columns.map((col) => {
          const colItems = items.filter((i) => i.kanbanStatus === col.key);
          return (
            <DroppableColumn key={col.key} column={col} count={colItems.length}>
              {(() => {
                const cards = colItems.map((item) => (
                  <DraggableCard key={item.id} id={item.id}>
                    <div className="relative">
                      {renderCard(item)}
                      {saving === item.id && (
                        <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">saving...</span>
                        </div>
                      )}
                    </div>
                  </DraggableCard>
                ));
                return hasAnimated.current ? cards : (
                  <StaggeredEntrance>{cards}</StaggeredEntrance>
                );
              })()}
            </DroppableColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-2 shadow-lg">
            {renderOverlay ? renderOverlay(activeItem) : renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
