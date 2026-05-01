"use client";

/**
 * FloatingBasket — persistent bottom tray showing what you've noticed.
 *
 * Lives at the bottom of the Room Explorer, always visible when
 * items are selected. Shows a count, mini emoji chips, and the
 * "let's see what these can become!" CTA.
 *
 * The language is intentional: not "submit" or "search" but
 * "what can these become?" — planting the seed that ordinary
 * objects hold latent potential. This is the bridge from
 * "find" into "fold."
 */

import { getMaterialEmoji, getMaterialIcon } from "./material-emoji";

interface FloatingBasketProps {
  selectedMaterials: Set<string>;
  selectedSlots: Set<string>;
  materialTitleMap: Map<string, string>;
  materialFormMap: Map<string, string>;
  materialEmojiMap: Map<string, string | null>;
  materialIconMap?: Map<string, string | null>;
  loading: boolean;
  onSubmit: () => void;
  onClear: () => void;
}

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const SLOT_EMOJI: Record<string, string> = {
  scissors: "✂️",
  glue: "🫗",
  markers: "🖍️",
  water: "💧",
  oven: "🔥",
  hammer: "🔨",
};

export function FloatingBasket({
  selectedMaterials,
  selectedSlots,
  materialTitleMap,
  materialFormMap,
  materialEmojiMap,
  materialIconMap,
  loading,
  onSubmit,
  onClear,
}: FloatingBasketProps) {
  const totalCount = selectedMaterials.size + selectedSlots.size;
  if (totalCount === 0) return null;

  /* show up to 8 emoji chips, then a "+N more" indicator */
  const materialIds = Array.from(selectedMaterials);
  const slotNames = Array.from(selectedSlots);
  const allEmoji: { key: string; emoji: string; iconSrc?: string }[] = [];

  for (const id of materialIds) {
    const title = materialTitleMap.get(id) ?? "";
    const form = materialFormMap.get(id) ?? "";
    const dbEmoji = materialEmojiMap.get(id) ?? null;
    const dbIcon = materialIconMap?.get(id) ?? null;
    const iconSrc = getMaterialIcon(title, form, dbEmoji, dbIcon) ?? undefined;
    allEmoji.push({ key: id, emoji: getMaterialEmoji(title, form, dbEmoji), iconSrc });
  }
  for (const slot of slotNames) {
    allEmoji.push({ key: `slot-${slot}`, emoji: SLOT_EMOJI[slot] ?? "🔧" });
  }

  const visible = allEmoji.slice(0, 8);
  const overflow = allEmoji.length - visible.length;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 sm:static sm:mt-6"
      style={{
        animation: `basketSlideUp 350ms ${SPRING}`,
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 sm:rounded-2xl sm:border-2 sm:border-dashed"
        style={{
          backgroundColor: "rgba(255, 246, 232, 0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "2px solid rgba(39, 50, 72, 0.1)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          // desktop: dashed border style
          borderColor: "rgba(39, 50, 72, 0.12)",
        }}
      >
        {/* emoji strip */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="text-lg mr-1">🎒</span>
          {visible.map((item) => (
            <span
              key={item.key}
              className="text-sm inline-flex items-center justify-center"
              style={{ lineHeight: 1, width: 20, height: 20 }}
            >
              {item.iconSrc ? (
                <img src={item.iconSrc} alt="" width={18} height={18} className="object-contain" />
              ) : (
                item.emoji
              )}
            </span>
          ))}
          {overflow > 0 && (
            <span
              className="text-xs font-bold ml-0.5"
              style={{ color: "var(--wv-sienna)", opacity: 0.6 }}
            >
              +{overflow}
            </span>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.97]"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            minHeight: 48,
            boxShadow: "0 3px 12px rgba(177, 80, 67, 0.25)",
            transition: `all 250ms ${SPRING}`,
          }}
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin mr-1.5">🔮</span>
              looking…
            </>
          ) : (
            <>what can these become?</>
          )}
        </button>

        {/* clear */}
        <button
          type="button"
          onClick={onClear}
          className="flex-shrink-0 text-xs font-medium active:scale-95"
          style={{
            color: "var(--wv-cadet)",
            opacity: 0.65,
            minHeight: 48,
            padding: "0 8px",
          }}
        >
          clear
        </button>
      </div>

      <style>{`
        @keyframes basketSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes basketSlideUp { from, to { opacity: 1; transform: none; } }
        }
      `}</style>
    </div>
  );
}
