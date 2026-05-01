"use client";

/**
 * RoomGrid — the entry screen for Room Explorer.
 *
 * Shows 5-6 illustrated room cards as big, tappable tiles. Each card
 * is an invitation to explore: "what's hiding in the kitchen?"
 *
 * Kid refresh (2026-04): cream tiles on the light find-phase bg.
 * Irregular squircle corners, per-room accent, idle wobble, tap squish.
 */

import { RoomConfig } from "./room-config";

interface RoomGridProps {
  rooms: RoomConfig[];
  visitedRooms: Set<string>;
  selectedCountByRoom: Map<string, number>;
  onRoomTap: (room: RoomConfig) => void;
}

const CORNERS = [
  "22px 28px 18px 26px",
  "26px 20px 28px 22px",
  "20px 26px 24px 28px",
  "28px 22px 26px 20px",
] as const;
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function RoomGrid({ rooms, visitedRooms, selectedCountByRoom, onRoomTap }: RoomGridProps) {
  return (
    <div>
      <p className="text-sm mb-5 text-center" style={{ color: "var(--color-text-on-cream-muted)" }}>
        pick a place and see what you notice
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rooms.map((room, i) => {
          const count = selectedCountByRoom.get(room.id) ?? 0;
          const visited = visitedRooms.has(room.id);
          const corners = CORNERS[i % CORNERS.length];
          const restRot = i % 4 === 0 ? -2 : i % 4 === 3 ? 2 : 0;
          const wobDelay = `${(i * 0.37) % 3.6}s`;
          const inDelay = `${i * 60}ms`;

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onRoomTap(room)}
              className="room-card relative flex flex-col items-center justify-center text-center p-4 select-none"
              style={{
                minHeight: 130,
                WebkitTapHighlightColor: "transparent",
                borderRadius: corners,
                ["--room-color" as string]: room.color,
                ["--corners" as string]: corners,
                ["--rest-rotation" as string]: `${restRot}deg`,
                ["--wobble-delay" as string]: wobDelay,
                ["--in-delay" as string]: inDelay,
              } as React.CSSProperties}
              data-count={count > 0 ? "true" : undefined}
              data-visited={visited && count === 0 ? "true" : undefined}
            >
              {count > 0 && (
                <span
                  className="absolute -top-2 -right-2 rounded-full flex items-center justify-center font-bold"
                  style={{
                    width: 24, height: 24, fontSize: "0.7rem",
                    backgroundColor: room.color, color: "var(--wv-cadet)",
                    animation: `roomBadgePop 300ms ${SPRING}`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  }}
                >
                  {count}
                </span>
              )}
              <span className="text-3xl mb-1.5 leading-none">{room.emoji}</span>
              <span className="text-xs font-bold tracking-wider"
                style={{
                  fontFamily: "var(--font-nunito), ui-sans-serif, system-ui, sans-serif",
                  color: count > 0 ? room.color : "var(--wv-cadet)",
                }}>
                {room.label}
              </span>
              <span className="text-xs mt-0.5 leading-snug"
                style={{ color: "var(--wv-cadet)", opacity: 0.4, fontSize: "0.6rem" }}>
                {room.description}
              </span>
              {visited && count === 0 && (
                <span className="absolute top-2 right-2 text-xs" style={{ opacity: 0.3 }} aria-label="visited">
                  👀
                </span>
              )}
              {count === 0 && (
                <span className="absolute top-2 left-2 rounded-full" aria-hidden="true"
                  style={{ width: 7, height: 7, background: "var(--room-color)", opacity: 0.6 }} />
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        .room-card {
          background: var(--wv-cream);
          border: 1px solid rgba(39, 50, 72, 0.08);
          box-shadow: 0 2px 0 rgba(39, 50, 72, 0.08);
          rotate: var(--rest-rotation);
          translate: 0 0;
          scale: 1;
          transition:
            translate 180ms ${SPRING},
            scale 180ms ${SPRING},
            background 140ms ease,
            box-shadow 180ms ease;
          animation:
            roomIn 420ms ${SPRING} var(--in-delay) both,
            roomWobble 3.6s ease-in-out var(--wobble-delay) infinite;
        }
        .room-card:hover {
          translate: 0 -2px; scale: 1.03;
          box-shadow: 0 6px 0 rgba(39, 50, 72, 0.1), 0 0 0 2px var(--room-color);
        }
        .room-card:active {
          scale: 0.94;
          background: color-mix(in srgb, var(--room-color) 18%, var(--wv-cream));
          transition: scale 80ms ease, background 80ms ease;
        }
        .room-card:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
        .room-card[data-count] {
          background: color-mix(in srgb, var(--room-color) 12%, var(--wv-cream));
          border: 2px solid var(--room-color);
          box-shadow: 0 2px 0 rgba(39, 50, 72, 0.06), 0 0 0 2px color-mix(in srgb, var(--room-color) 25%, transparent);
        }
        .room-card[data-visited] {
          border-color: color-mix(in srgb, var(--room-color) 30%, rgba(39, 50, 72, 0.08));
        }
        @keyframes roomIn {
          from { opacity: 0; translate: 0 8px; scale: 0.85; }
          to   { opacity: 1; translate: 0 0; scale: 1; }
        }
        @keyframes roomWobble {
          0%, 100% { rotate: var(--rest-rotation); }
          50%      { rotate: calc(var(--rest-rotation) + 1.2deg); }
        }
        @keyframes roomBadgePop {
          from { transform: scale(0); }
          60%  { transform: scale(1.3); }
          to   { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .room-card { animation: none; transition: background 120ms ease; rotate: 0deg; translate: 0 0; scale: 1; }
          .room-card:hover { translate: 0 0; scale: 1; }
          .room-card:active { scale: 1; }
          .room-card[data-count] { scale: 1; }
          @keyframes roomBadgePop { from, to { transform: scale(1); } }
        }
      `}</style>
    </div>
  );
}
