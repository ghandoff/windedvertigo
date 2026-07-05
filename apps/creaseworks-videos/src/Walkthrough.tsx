// render time estimate: ~30s on M-series Mac for 345 frames at 1080p
// file size estimate: ~2-4 MB at default quality (jpeg frames)
// to render: npm run render (from this directory)

import { Composition, AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { BrandIntro } from "./BrandIntro";
import { BrandOutro } from "./BrandOutro";
import { StepCard } from "./StepCard";
import { Cord } from "./Cord";
import { brand } from "./remotion-tokens";

const INTRO_FRAMES = 60;   // 2s
const STEP_FRAMES = 45;    // 1.5s per step
const OUTRO_FRAMES = 60;   // 2s
const STEP_COUNT = 5;
const TOTAL_FRAMES = INTRO_FRAMES + STEP_COUNT * STEP_FRAMES + OUTRO_FRAMES; // 345

const steps = [
  {
    stepNumber: 1,
    instruction: "gather your materials",
    materials: ["tissue paper", "pipe cleaners", "scissors"],
  },
  {
    stepNumber: 2,
    instruction: "stack five sheets of tissue paper on top of each other",
  },
  {
    stepNumber: 3,
    instruction: "fold the stack like a fan — back and forth, crease each fold",
  },
  {
    stepNumber: 4,
    instruction: "pinch the middle and twist a pipe cleaner around it",
  },
  {
    stepNumber: 5,
    instruction: "gently pull each layer up to make the petals",
  },
];

const CordPanel: React.FC<{ totalSteps: number }> = ({ totalSteps }) => {
  const frame = useCurrentFrame();

  // slide in from left
  const slideX = interpolate(frame, [0, 20], [-200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // nod on each new step: figure out which step we're in and nod at start
  const stepIndex = Math.max(
    0,
    Math.min(totalSteps - 1, Math.floor((frame - INTRO_FRAMES) / STEP_FRAMES))
  );
  const stepStart = INTRO_FRAMES + stepIndex * STEP_FRAMES;
  const localStepFrame = frame - stepStart;

  const nodDeg = interpolate(localStepFrame, [0, 5, 10], [-5, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "40%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div style={{ transform: `rotate(${nodDeg}deg)` }}>
        <Cord expression="excited" />
      </div>
    </div>
  );
};

const WalkthroughComp: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: brand.cadet }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <BrandIntro />
      </Sequence>

      {steps.map((step, i) => {
        const from = INTRO_FRAMES + i * STEP_FRAMES;
        return (
          <Sequence key={step.stepNumber} from={from} durationInFrames={STEP_FRAMES}>
            {/* right 60% step card — dark-mode styled */}
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "60%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "88%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  padding: "40px 48px",
                }}
              >
                <div
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 72,
                    fontWeight: 700,
                    color: brand.redwood,
                    lineHeight: 1,
                    marginBottom: 16,
                  }}
                >
                  {step.stepNumber}
                </div>
                <div
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 28,
                    color: brand.cream,
                    fontWeight: 400,
                    letterSpacing: "0.01em",
                    marginBottom: "materials" in step && step.materials ? 20 : 0,
                  }}
                >
                  {step.instruction}
                </div>
                {"materials" in step && step.materials && step.materials.length > 0 && (
                  <ul style={{ margin: 0, padding: "0 0 0 20px", listStyle: "disc" }}>
                    {step.materials.map((m) => (
                      <li
                        key={m}
                        style={{
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: 20,
                          color: "#a8b0bf",
                          marginBottom: 4,
                        }}
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Sequence>
        );
      })}

      <Sequence from={INTRO_FRAMES + STEP_COUNT * STEP_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <BrandOutro />
      </Sequence>

      {/* Cord panel always visible from frame 0 */}
      <CordPanel totalSteps={STEP_COUNT} />
    </AbsoluteFill>
  );
};

export const Walkthrough: React.FC = () => {
  return (
    <>
      <Composition
        id="Walkthrough"
        component={WalkthroughComp}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
