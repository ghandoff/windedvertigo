"use client";

/**
 * RoomScene — the individual room exploration view.
 *
 * When a kid taps a room card, they enter this scene: a grid of
 * emoji tiles representing materials found in that room, plus a
 * row of tools ("things you might need here").
 *
 * The prompt at top invites noticing: "what's hiding in the kitchen?"
 * Each tap is a discovery. The kid can just tick boxes if that's
 * where they are today — or they can look with fresh eyes.
 */

import { useMemo } from "react";
import { RoomConfig } from "./room-config";
import { EmojiTile } from "./emoji-tile";
import { Material } from "./types";
import { getMaterialEmoji, getMaterialIcon } from "./material-emoji";
import { resolveCharacterFromForm } from "@windedvertigo/characters";

interface RoomSceneProps {
  room: RoomConfig;
  materials: Material[];
  /** pre-built slug → Material index */
  slugIndex: Map<string, Material>;
  selectedMaterials: Set<string>;
  selectedSlots: Set<string>;
  onMaterialTap: (id: string) => void;
  onSlotTap: (slot: string) => void;
  onBack: () => void;
}

const SLOT_EMOJI: Record<string, string> = {
  scissors: "✂️",
  glue: "🫗",
  markers: "🖍️",
  water: "💧",
  oven: "🔥",
  hammer: "🔨",
};

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function RoomScene({
  room,
  slugIndex,
  selectedMaterials,
  selectedSlots,
  onMaterialTap,
  onSlotTap,
  onBack,
}: RoomSceneProps) {
  /* resolve room slugs to actual Material objects */
  const roomMaterials = useMemo(() => {
    const seen = new Set<string>();
    const resolved: Material[] = [];
    for (const slug of room.materialSlugs) {
      const mat = slugIndex.get(slug);
      if (mat && !seen.has(mat.id)) {
        seen.add(mat.id);
        resolved.push(mat);
      }
    }
    return resolved;
  }, [room.materialSlugs, slugIndex]);

  return (
    <div
      className="room-scene rounded-2xl p-4"
      style={{
        animation: `roomSlideIn 300ms ${SPRING}`,
        /* A gentle room-colour wash makes the scene feel like you're
           actually inside this space, not just looking at a list.      */
        background: `color-mix(in srgb, ${room.color} 6%, var(--wv-cream))`,
        border: `1.5px solid color-mix(in srgb, ${room.color} 20%, rgba(39,50,72,0.08))`,
      }}
    >
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-3 py-2 text-sm font-medium active:scale-95"
          style={{
            color: "var(--wv-cadet)",
            opacity: 0.6,
            transition: `all 180ms ease`,
            border: "1.5px solid rgba(39, 50, 72, 0.12)",
          }}
          aria-label="back to rooms"
        >
          ← back
        </button>
        <span className="text-xl">{room.emoji}</span>
        <span
          className="text-sm font-bold tracking-wider"
          style={{ color: room.color }}
        >
          {room.label}
        </span>
      </div>

      {/* room prompt — the invitation to notice */}
      <p
        className="text-base font-bold mb-4"
        style={{ color: "var(--wv-cadet)" }}
      >
        {room.prompt}
      </p>

      {/* materials grid — bigger tiles than classic picker so the room
          feels spatial, not like a list you're scrolling through.      */}
      {roomMaterials.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {roomMaterials.map((mat, i) => (
            <EmojiTile
              key={mat.id}
              emoji={getMaterialEmoji(mat.title, mat.form_primary, mat.emoji)}
              emojiSrc={getMaterialIcon(mat.title, mat.form_primary, mat.emoji, mat.icon) ?? undefined}
              characterName={resolveCharacterFromForm(mat.form_primary, mat.title)}
              label={mat.title}
              selected={selectedMaterials.has(mat.id)}
              onClick={() => onMaterialTap(mat.id)}
              accentColor={room.color}
              size="lg"
              fluid
              index={i}
            />
          ))}
        </div>
      ) : (
        <p
          className="text-sm py-8 text-center"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          nothing here yet — try another room!
        </p>
      )}

      {/* tools row */}
      {room.slotSlugs.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 mb-3 mt-2"
            style={{
              borderTop: "1px solid rgba(39, 50, 72, 0.08)",
              paddingTop: 12,
            }}
          >
            <span className="text-xs" aria-hidden="true" style={{ opacity: 0.4 }}>🔧</span>
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "var(--color-text-on-cream-muted)" }}
            >
              tools you might need here
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {room.slotSlugs.map((slot, i) => (
              <EmojiTile
                key={slot}
                emoji={SLOT_EMOJI[slot] ?? "🔧"}
                label={slot}
                selected={selectedSlots.has(slot)}
                onClick={() => onSlotTap(slot)}
                accentColor={room.color}
                size="md"
                index={i}
              />
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes roomSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes roomSlideIn { from, to { opacity: 1; transform: none; } }
        }
      `}</style>
    </div>
  );
}
