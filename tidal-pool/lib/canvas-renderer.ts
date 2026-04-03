/**
 * tidal.pool — canvas rendering
 *
 * Draws elements as pulsing circles and connections as animated
 * directional arcs on an HTML Canvas. Separated from React so
 * the draw logic is independently testable and reusable.
 */

import type { PoolElement, Connection, ConnectionType } from "./types";

// ── constants ───────────────────────────────────────────────

const NODE_RADIUS = 28;
const NODE_BORDER = 3;
const ARROW_SIZE = 8;
const LABEL_FONT = '500 11px "Inter", system-ui, sans-serif';
const VALUE_FONT = '700 14px "Inter", system-ui, sans-serif';
const ICON_FONT = "20px serif";

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  amplifying: "rgba(34, 197, 94, 0.6)", // green
  dampening: "rgba(239, 68, 68, 0.6)", // red
  delayed: "rgba(59, 130, 246, 0.6)", // blue
  threshold: "rgba(245, 158, 11, 0.6)", // amber
};

// ── drawing helpers ─────────────────────────────────────────

function drawConnection(
  ctx: CanvasRenderingContext2D,
  conn: Connection,
  elements: PoolElement[],
  tick: number,
) {
  const from = elements.find((e) => e.id === conn.from);
  const to = elements.find((e) => e.id === conn.to);
  if (!from || !to) return;

  const color = CONNECTION_COLORS[conn.type];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  // Unit vector
  const ux = dx / dist;
  const uy = dy / dist;

  // Start/end offset by node radius
  const startX = from.x + ux * (NODE_RADIUS + 4);
  const startY = from.y + uy * (NODE_RADIUS + 4);
  const endX = to.x - ux * (NODE_RADIUS + 4);
  const endY = to.y - uy * (NODE_RADIUS + 4);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 + conn.strength * 2;
  ctx.setLineDash(conn.type === "delayed" ? [6, 4] : []);

  // Animated flow: dash offset moves along the line
  if (conn.type === "delayed") {
    ctx.lineDashOffset = -(tick * 2);
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - ux * ARROW_SIZE - uy * ARROW_SIZE * 0.5,
    endY - uy * ARROW_SIZE + ux * ARROW_SIZE * 0.5,
  );
  ctx.lineTo(
    endX - ux * ARROW_SIZE + uy * ARROW_SIZE * 0.5,
    endY - uy * ARROW_SIZE - ux * ARROW_SIZE * 0.5,
  );
  ctx.closePath();
  ctx.fill();

  // Connection type label at midpoint
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const typeLabel =
    conn.type === "amplifying"
      ? "+"
      : conn.type === "dampening"
        ? "−"
        : conn.type === "delayed"
          ? "⏱"
          : "⚡";

  ctx.font = '600 12px "Inter", system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(typeLabel, midX, midY - 8);

  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: PoolElement,
  tick: number,
  isSelected: boolean,
) {
  const { x, y, value, color, icon, label } = el;

  // Value-based pulse: radius oscillates slightly with value
  const pulse = Math.sin(tick * 0.1 + value * 0.05) * 2;
  const radius = NODE_RADIUS + pulse;

  // Value fill (ring that fills clockwise based on value percentage)
  const valuePct = (value - el.minValue) / (el.maxValue - el.minValue);

  // Outer glow when selected
  if (isSelected) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 235, 210, 0.4)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 235, 210, 0.15)";
    ctx.fill();
    ctx.restore();
  }

  // Background circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(30, 39, 56, 0.9)"; // surface-raised
  ctx.fill();

  // Value arc
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * valuePct);
  ctx.strokeStyle = color;
  ctx.lineWidth = NODE_BORDER;
  ctx.stroke();

  // Inner background
  ctx.beginPath();
  ctx.arc(x, y, radius - NODE_BORDER - 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(39, 50, 72, 0.95)";
  ctx.fill();

  // Icon
  ctx.font = ICON_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x, y - 4);

  // Value number
  ctx.font = VALUE_FONT;
  ctx.fillStyle = "#ffebd2";
  ctx.fillText(Math.round(value).toString(), x, y + 14);

  ctx.restore();

  // Label below
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.fillStyle = "rgba(255, 235, 210, 0.7)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, y + radius + 6);
  ctx.restore();
}

// ── main draw function ──────────────────────────────────────

export interface DrawOptions {
  elements: PoolElement[];
  connections: Connection[];
  tick: number;
  selectedElementId: string | null;
  /** Element currently being connected from (draw-mode). */
  connectingFrom: string | null;
  /** Current mouse position during connection drawing. */
  mousePos: { x: number; y: number } | null;
  dpr: number;
}

export function draw(ctx: CanvasRenderingContext2D, opts: DrawOptions) {
  const { elements, connections, tick, selectedElementId, connectingFrom, mousePos, dpr } = opts;

  const width = ctx.canvas.width / dpr;
  const height = ctx.canvas.height / dpr;

  // Clear
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Background gradient (subtle water feel)
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.6,
  );
  grad.addColorStop(0, "rgba(39, 50, 72, 1)");
  grad.addColorStop(1, "rgba(30, 39, 56, 1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid dots
  ctx.fillStyle = "rgba(255, 235, 210, 0.04)";
  const gridSize = 40;
  for (let gx = gridSize; gx < width; gx += gridSize) {
    for (let gy = gridSize; gy < height; gy += gridSize) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw connections first (below elements)
  for (const conn of connections) {
    drawConnection(ctx, conn, elements, tick);
  }

  // Draw in-progress connection line
  if (connectingFrom && mousePos) {
    const fromEl = elements.find((e) => e.id === connectingFrom);
    if (fromEl) {
      ctx.strokeStyle = "rgba(255, 235, 210, 0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fromEl.x, fromEl.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw elements
  for (const el of elements) {
    drawElement(ctx, el, tick, el.id === selectedElementId);
  }

  // Empty state hint
  if (elements.length === 0) {
    ctx.font = '400 16px "Inter", system-ui, sans-serif';
    ctx.fillStyle = "rgba(255, 235, 210, 0.3)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("drag elements from the palette to begin", width / 2, height / 2);
  }

  ctx.restore();
}

export { NODE_RADIUS };
