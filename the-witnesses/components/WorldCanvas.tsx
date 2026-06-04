'use client';

import { useEffect, useRef, useState } from 'react';
import { drawScene } from '@/lib/canvas/drawScene';

interface Props {
  imageUrl?: string;
  isLoading?: boolean;
  erasedElements?: string[];
  onElementClick?: (element: string) => void;
  showGhostOverlay?: boolean;
}

const GHOST_ZONES: Array<{ key: string; label: string; x: number; y: number; w: number; h: number }> = [
  { key: 'bench', label: 'the bench', x: 122 * 6, y: 85 * 6, w: 22 * 6, h: 14 * 6 },
  { key: 'left window', label: 'the left window', x: 60 * 6, y: 63 * 6, w: 18 * 6, h: 18 * 6 },
  { key: 'door', label: 'the door', x: 81 * 6, y: 79 * 6, w: 10 * 6, h: 17 * 6 },
  { key: 'tree', label: 'the tree', x: 9 * 6, y: 51 * 6, w: 32 * 6, h: 48 * 6 },
  { key: 'book box', label: 'the book box', x: 99 * 6, y: 83 * 6, w: 12 * 6, h: 18 * 6 },
  { key: 'bicycle', label: 'the bicycle', x: 32 * 6, y: 90 * 6, w: 14 * 6, h: 10 * 6 },
];

export default function WorldCanvas({ imageUrl, isLoading, erasedElements, onElementClick, showGhostOverlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    if (imageUrl) return; // Don't draw canvas if we have an image
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx);
    setCanvasReady(true);
  }, [imageUrl]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showGhostOverlay || !onElementClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 720 / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    for (const zone of GHOST_ZONES) {
      if (
        cx >= zone.x && cx <= zone.x + zone.w &&
        cy >= zone.y && cy <= zone.y + zone.h
      ) {
        onElementClick(zone.key);
        return;
      }
    }
  };

  return (
    <div
      className="relative w-full max-w-3xl mx-auto"
      style={{ aspectRatio: '960/720' }}
      onClick={handleCanvasClick}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="The world"
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={960}
          height={720}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Ghost overlay zones */}
      {showGhostOverlay && !imageUrl && GHOST_ZONES.map((zone) => {
        const isErased = erasedElements?.includes(zone.key);
        return (
          <div
            key={zone.key}
            className={`absolute border-2 cursor-pointer transition-all ${
              isErased
                ? 'border-white bg-white/20'
                : 'border-white/0 hover:border-white/60 hover:bg-white/10'
            }`}
            style={{
              left: `${(zone.x / 960) * 100}%`,
              top: `${(zone.y / 720) * 100}%`,
              width: `${(zone.w / 960) * 100}%`,
              height: `${(zone.h / 720) * 100}%`,
            }}
            title={zone.label}
          />
        );
      })}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center text-white">
            <div className="text-4xl mb-2 animate-pulse">◈</div>
            <div className="text-sm font-mono opacity-70">the world is shifting…</div>
          </div>
        </div>
      )}
    </div>
  );
}
