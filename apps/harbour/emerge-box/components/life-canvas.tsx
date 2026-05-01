"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CELL_SIZE = 16;
const GRID_GAP = 1;

function getGridSize(width: number): number {
  if (width < 400) return 20;
  if (width < 600) return 25;
  return 30;
}

function createGrid(size: number, fill = false): boolean[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => (fill ? Math.random() < 0.3 : false))
  );
}

function countNeighbours(grid: boolean[][], row: number, col: number): number {
  const size = grid.length;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size && grid[r][c]) {
        count++;
      }
    }
  }
  return count;
}

function nextGeneration(grid: boolean[][]): boolean[][] {
  const size = grid.length;
  return grid.map((row, r) =>
    row.map((alive, c) => {
      const n = countNeighbours(grid, r, c);
      if (alive) return n === 2 || n === 3;
      return n === 3;
    })
  );
}

export default function LifeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(30);
  const gridRef = useRef<boolean[][]>(createGrid(30));
  const [generation, setGeneration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const lastTickRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const grid = gridRef.current;
    const size = grid.length;
    const cellTotal = CELL_SIZE + GRID_GAP;
    const canvasSize = size * cellTotal + GRID_GAP;

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const styles = getComputedStyle(document.documentElement);
    const aliveColour = styles.getPropertyValue("--wv-champagne").trim() || "#ffebd2";
    const deadColour = styles.getPropertyValue("--color-surface-raised").trim() || "#1e1e2e";

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = GRID_GAP + c * cellTotal;
        const y = GRID_GAP + r * cellTotal;
        ctx.fillStyle = grid[r][c] ? aliveColour : deadColour;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }
  }, []);

  // resize handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const newSize = getGridSize(w);
        if (newSize !== gridRef.current.length) {
          setGridSize(newSize);
          gridRef.current = createGrid(newSize);
          setGeneration(0);
          setPlaying(false);
          draw();
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  // game loop
  useEffect(() => {
    let animId: number;
    const loop = (time: number) => {
      animId = requestAnimationFrame(loop);
      if (!playingRef.current) return;
      const interval =
        speedRef.current === "slow" ? 300 : speedRef.current === "medium" ? 150 : 60;
      if (time - lastTickRef.current < interval) return;
      lastTickRef.current = time;
      gridRef.current = nextGeneration(gridRef.current);
      setGeneration((g) => g + 1);
      draw();
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      e.preventDefault();
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const cellTotal = CELL_SIZE + GRID_GAP;
    const col = Math.floor((x - GRID_GAP) / cellTotal);
    const row = Math.floor((y - GRID_GAP) / cellTotal);
    const size = gridRef.current.length;
    if (row >= 0 && row < size && col >= 0 && col < size) {
      gridRef.current[row][col] = !gridRef.current[row][col];
      draw();
    }
  };

  const step = () => {
    gridRef.current = nextGeneration(gridRef.current);
    setGeneration((g) => g + 1);
    draw();
  };

  const clear = () => {
    gridRef.current = createGrid(gridRef.current.length);
    setGeneration(0);
    setPlaying(false);
    draw();
  };

  const randomise = () => {
    gridRef.current = createGrid(gridRef.current.length, true);
    setGeneration(0);
    draw();
  };

  const btnClass =
    "px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-[var(--color-text-on-dark)] cursor-pointer";
  const activeBtnClass =
    "px-3 py-1.5 text-sm rounded-lg border border-[var(--wv-sienna)]/50 bg-[var(--wv-sienna)]/20 text-[var(--wv-sienna)] transition-colors cursor-pointer";

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setPlaying(!playing)} className={playing ? activeBtnClass : btnClass}>
          {playing ? "pause" : "play"}
        </button>
        <button onClick={step} className={btnClass} disabled={playing}>
          step
        </button>
        <button onClick={clear} className={btnClass}>
          clear
        </button>
        <button onClick={randomise} className={btnClass}>
          randomise
        </button>
        <span className="ml-auto text-sm text-[var(--color-text-on-dark-muted)]">
          generation: {generation}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[var(--color-text-on-dark-muted)]">speed:</span>
        {(["slow", "medium", "fast"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={speed === s ? activeBtnClass : btnClass}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="max-w-full cursor-crosshair"
          style={{ touchAction: "none", imageRendering: "pixelated" }}
        />
      </div>

      <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-3 text-center">
        click or tap cells to toggle them alive or dead
      </p>
    </div>
  );
}
