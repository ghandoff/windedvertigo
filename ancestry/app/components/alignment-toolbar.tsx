"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

const DEFAULT_W = 160;
const DEFAULT_H = 60;

type AlignmentToolbarProps = {
  selectedNodeIds: string[];
  onAlign: (positions: Record<string, { x: number; y: number }>) => void;
};

export function AlignmentToolbar({ selectedNodeIds, onAlign }: AlignmentToolbarProps) {
  const { getNodes } = useReactFlow();

  const getSelectedBounds = useCallback(() => {
    const allNodes = getNodes();
    return allNodes
      .filter((n) => selectedNodeIds.includes(n.id))
      .map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? (n.width as number | undefined) ?? DEFAULT_W,
        h: n.measured?.height ?? (n.height as number | undefined) ?? DEFAULT_H,
      }));
  }, [getNodes, selectedNodeIds]);

  const alignLeft = useCallback(() => {
    const bounds = getSelectedBounds();
    const minX = Math.min(...bounds.map((b) => b.x));
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: minX, y: b.y };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const alignCenterH = useCallback(() => {
    const bounds = getSelectedBounds();
    const centers = bounds.map((b) => b.x + b.w / 2);
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: avgCenter - b.w / 2, y: b.y };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const alignRight = useCallback(() => {
    const bounds = getSelectedBounds();
    const maxRight = Math.max(...bounds.map((b) => b.x + b.w));
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: maxRight - b.w, y: b.y };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const alignTop = useCallback(() => {
    const bounds = getSelectedBounds();
    const minY = Math.min(...bounds.map((b) => b.y));
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: b.x, y: minY };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const alignMiddle = useCallback(() => {
    const bounds = getSelectedBounds();
    const centers = bounds.map((b) => b.y + b.h / 2);
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: b.x, y: avgCenter - b.h / 2 };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const alignBottom = useCallback(() => {
    const bounds = getSelectedBounds();
    const maxBottom = Math.max(...bounds.map((b) => b.y + b.h));
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of bounds) positions[b.id] = { x: b.x, y: maxBottom - b.h };
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const distributeH = useCallback(() => {
    const bounds = getSelectedBounds();
    if (bounds.length < 3) return;
    const sorted = [...bounds].sort((a, b) => a.x - b.x);
    const totalSpan = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x;
    const totalNodeWidth = sorted.reduce((sum, b) => sum + b.w, 0);
    const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1);
    let currentX = sorted[0].x;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of sorted) {
      positions[b.id] = { x: currentX, y: b.y };
      currentX += b.w + gap;
    }
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const distributeV = useCallback(() => {
    const bounds = getSelectedBounds();
    if (bounds.length < 3) return;
    const sorted = [...bounds].sort((a, b) => a.y - b.y);
    const totalSpan = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y;
    const totalNodeHeight = sorted.reduce((sum, b) => sum + b.h, 0);
    const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1);
    let currentY = sorted[0].y;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of sorted) {
      positions[b.id] = { x: b.x, y: currentY };
      currentY += b.h + gap;
    }
    onAlign(positions);
  }, [getSelectedBounds, onAlign]);

  const btnClass =
    "w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors";
  const sep = <div className="w-px h-5 bg-border mx-0.5" />;

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-card/95 backdrop-blur-sm border border-border p-1 shadow-md">
      <button onClick={alignLeft} className={btnClass} title="align left">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="1" y1="0" x2="1" y2="14" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="2" width="8" height="3" rx="0.5" fill="currentColor" /><rect x="3" y="9" width="5" height="3" rx="0.5" fill="currentColor" /></svg>
      </button>
      <button onClick={alignCenterH} className={btnClass} title="align center">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" /><rect x="2" y="2" width="10" height="3" rx="0.5" fill="currentColor" /><rect x="3.5" y="9" width="7" height="3" rx="0.5" fill="currentColor" /></svg>
      </button>
      <button onClick={alignRight} className={btnClass} title="align right">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="13" y1="0" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="2" width="8" height="3" rx="0.5" fill="currentColor" /><rect x="6" y="9" width="5" height="3" rx="0.5" fill="currentColor" /></svg>
      </button>
      {sep}
      <button onClick={alignTop} className={btnClass} title="align top">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="3" width="3" height="8" rx="0.5" fill="currentColor" /><rect x="9" y="3" width="3" height="5" rx="0.5" fill="currentColor" /></svg>
      </button>
      <button onClick={alignMiddle} className={btnClass} title="align middle">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" /><rect x="2" y="1" width="3" height="12" rx="0.5" fill="currentColor" /><rect x="9" y="3" width="3" height="8" rx="0.5" fill="currentColor" /></svg>
      </button>
      <button onClick={alignBottom} className={btnClass} title="align bottom">
        <svg width="14" height="14" viewBox="0 0 14 14"><line x1="0" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="3" width="3" height="8" rx="0.5" fill="currentColor" /><rect x="9" y="6" width="3" height="5" rx="0.5" fill="currentColor" /></svg>
      </button>
      {sep}
      <button onClick={distributeH} className={btnClass} title="distribute horizontally">
        <svg width="14" height="14" viewBox="0 0 14 14"><rect x="0" y="3" width="3" height="8" rx="0.5" fill="currentColor" /><rect x="5.5" y="3" width="3" height="8" rx="0.5" fill="currentColor" /><rect x="11" y="3" width="3" height="8" rx="0.5" fill="currentColor" /></svg>
      </button>
      <button onClick={distributeV} className={btnClass} title="distribute vertically">
        <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="0" width="8" height="3" rx="0.5" fill="currentColor" /><rect x="3" y="5.5" width="8" height="3" rx="0.5" fill="currentColor" /><rect x="3" y="11" width="8" height="3" rx="0.5" fill="currentColor" /></svg>
      </button>
    </div>
  );
}
