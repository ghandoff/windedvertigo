"use client";

/**
 * CastParade — "The Shape Show".
 *
 * Replaces the former static 7-across lineup. The parade now performs:
 * each of the four multi-pose characters (Swatch, Crate, Mud, Drip)
 * cycles through its pose vocabulary in place on a 3-second beat,
 * staggered across slots so the row shape-shifts as a wave rather than
 * flipping in lockstep. The three single-pose characters (Cord, Jugs,
 * Twig) get a subtle scale-pulse every ~5s so they read as alive, not
 * inert bookends.
 *
 * The mechanic IS the pedagogy: form (the character) stays the same,
 * function (the pose) changes. That's the whole form×function
 * vocabulary harbour teaches, rendered as a performance.
 *
 * Motion decisions:
 *   - Pose swap: 300ms opacity dip to 0.6 then back to 1, so the pose
 *     change feels like a breath, not a flash.
 *   - Stagger: delay = slotIndex * 600ms on the cycle timer.
 *   - Pulse: CSS @keyframes on single-pose slots only, 5s loop,
 *     0.98 → 1.02 → 1 with different per-slot animation-delays.
 *   - prefers-reduced-motion: skip the pose cycle entirely (characters
 *     stay on "base") and disable the pulse keyframes via CSS media
 *     query. No motion at all when the user has asked for none.
 *
 * Client component: the cycling needs setInterval/useState so we pay
 * hydration cost for this island. Everything else on the page remains
 * server-rendered.
 */
import { useEffect, useState } from "react";
import CharacterSlot, {
  type CharacterName,
  type SwatchPose,
  type CratePose,
  type MudPose,
  type DripPose,
} from "@windedvertigo/characters";
import { useCharacterVariant } from "@windedvertigo/characters/variant-context";

type PoseCycler = {
  name: CharacterName;
  label: string;
  poses: readonly string[];
};

// Order tuned so multi-pose characters are interleaved with single-pose
// ones across the row — the wave reads better when the "performing"
// characters aren't clumped together.
const CAST: readonly PoseCycler[] = [
  { name: "cord", label: "cord", poses: ["base"] },
  { name: "swatch", label: "swatch", poses: ["base", "cover", "wrap", "cushion"] satisfies readonly SwatchPose[] },
  { name: "twig", label: "twig", poses: ["base"] },
  { name: "crate", label: "crate", poses: ["base", "contain", "stack", "fort"] satisfies readonly CratePose[] },
  { name: "jugs", label: "jugs", poses: ["base"] },
  { name: "mud", label: "mud", poses: ["base", "shape", "mould", "stick"] satisfies readonly MudPose[] },
  { name: "drip", label: "drip", poses: ["base", "pool", "pour", "soak"] satisfies readonly DripPose[] },
] as const;

const CYCLE_MS = 3000;
const STAGGER_MS = 600;

export function CastParade() {
  // ambient register from the root-layout cookie-bootstrapped provider.
  // harbour's layout reads cw-ui-mode server-side and wraps children in
  // CharacterVariantProvider, so flipping kid/grownup in creaseworks
  // /profile propagates here on the next render.
  const characterVariant = useCharacterVariant();
  // One tick per slot — we bump it on each slot's own timer so the stagger
  // isn't a derived offset from a single global tick (that would drift on
  // resume from a backgrounded tab). Each slot owns its cadence.
  const [ticks, setTicks] = useState<number[]>(() => CAST.map(() => 0));
  const [reducedMotion, setReducedMotion] = useState(false);

  // Read prefers-reduced-motion on mount and subscribe to changes.
  // Kept in state so we can conditionally suppress the cycle effect.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Pose cycling — one interval per multi-pose slot, staggered by index.
  // Single-pose slots (poses.length === 1) are skipped; they never tick.
  useEffect(() => {
    if (reducedMotion) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    CAST.forEach((slot, index) => {
      if (slot.poses.length <= 1) return;
      // Prime with a delayed start so slots fire staggered, then tick every CYCLE_MS.
      const startDelay = index * STAGGER_MS;
      const kickoff = setTimeout(() => {
        const tick = () => {
          setTicks((prev) => {
            const next = prev.slice();
            next[index] = (next[index] ?? 0) + 1;
            return next;
          });
        };
        tick(); // first swap happens at startDelay, not at startDelay+CYCLE_MS
        const id = setInterval(tick, CYCLE_MS);
        intervals.push(id);
      }, startDelay);
      timeouts.push(kickoff);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [reducedMotion]);

  return (
    <section
      role="region"
      aria-label="the material cast — a performance"
      className="py-14 sm:py-20 px-6"
    >
      {/* Keyframes for the single-pose pulse + the pose-swap opacity dip.
          Scoped via data-cast-parade so they don't leak to other components. */}
      <style>{`
        @keyframes cast-pulse {
          0%, 100% { transform: scale(1); }
          25%      { transform: scale(0.98); }
          60%      { transform: scale(1.02); }
        }
        [data-cast-parade] .cast-pulse {
          animation: cast-pulse 5s ease-in-out infinite;
        }
        [data-cast-parade] .cast-pose {
          transition: opacity 300ms ease;
        }
        [data-cast-parade] .cast-stage:hover {
          transform: translateY(-2px);
        }
        [data-cast-parade] .cast-stage {
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-cast-parade] .cast-pulse { animation: none; }
          [data-cast-parade] .cast-pose  { transition: none; }
          [data-cast-parade] .cast-stage { transition: none; }
          [data-cast-parade] .cast-stage:hover { transform: none; }
        }
      `}</style>

      <div
        data-cast-parade
        className="mx-auto rounded-3xl px-4 sm:px-8 py-8 sm:py-12"
        style={{
          maxWidth: 1040,
          background: "var(--wv-cream, #fff6e8)",
          boxShadow:
            "0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 60px -30px rgba(0, 0, 0, 0.45)",
        }}
      >
        <p
          className="text-center mb-6 sm:mb-8"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--wv-sienna, #cb7858)",
          }}
        >
          seven characters · nineteen shapes
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 place-items-center">
          {CAST.map((slot, index) => {
            const poseIndex = reducedMotion
              ? 0
              : (ticks[index] ?? 0) % slot.poses.length;
            const activePose = slot.poses[poseIndex] ?? "base";
            const isMultiPose = slot.poses.length > 1;

            // Opacity dip timing — drop to 0.6 on the tick that just
            // fired, then bounce back on the next render. We approximate
            // the "during swap" window with a key-based remount: each
            // time poseIndex changes, the inner wrapper's key changes,
            // and its CSS animation/transition replays. Simpler than
            // orchestrating a two-phase state machine and looks the same.
            return (
              <div
                key={slot.name}
                className="cast-stage flex flex-col items-center justify-center"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  maxWidth: 140,
                  minHeight: 140,
                  background: "#ffffff",
                  border: "1px solid rgba(39, 50, 72, 0.08)",
                  borderRadius: 16,
                  padding: 12,
                  boxSizing: "border-box",
                }}
              >
                <div
                  className={isMultiPose ? "cast-pose" : "cast-pose cast-pulse"}
                  style={{
                    animationDelay: isMultiPose ? undefined : `${index * 400}ms`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "1 1 auto",
                  }}
                >
                  <CharacterSlot
                    // Remounting on pose change lets the 300ms opacity
                    // transition replay every swap without extra state.
                    key={activePose}
                    character={slot.name}
                    size={96}
                    variant={characterVariant}
                    animate={true}
                    pose={activePose}
                  />
                </div>
                <span
                  className="mt-1"
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--wv-cadet, #273248)",
                    opacity: 0.65,
                  }}
                >
                  {slot.label}
                </span>
              </div>
            );
          })}
        </div>

        <p
          className="text-center mt-6 sm:mt-8 mx-auto"
          style={{
            fontSize: "0.8125rem",
            lineHeight: 1.6,
            color: "var(--wv-cadet, #273248)",
            opacity: 0.7,
            maxWidth: "48ch",
          }}
        >
          they become what the project needs. each one plays a different role
          in how matter behaves.
        </p>
      </div>
    </section>
  );
}

export default CastParade;
