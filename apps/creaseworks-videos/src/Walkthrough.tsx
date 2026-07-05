// render time estimate: ~30s on M-series Mac for 345 frames at 1080p
// file size estimate: ~2-4 MB at default quality (jpeg frames)
// to render: npm run render (from this directory)

import { Composition, AbsoluteFill, Sequence } from "remotion";
import { BrandIntro } from "./BrandIntro";
import { BrandOutro } from "./BrandOutro";
import { StepCard } from "./StepCard";

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

const WalkthroughComp: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <BrandIntro />
      </Sequence>

      {steps.map((step, i) => {
        const from = INTRO_FRAMES + i * STEP_FRAMES;
        return (
          <Sequence key={step.stepNumber} from={from} durationInFrames={STEP_FRAMES}>
            <StepCard
              stepNumber={step.stepNumber}
              instruction={step.instruction}
              materials={"materials" in step ? step.materials : undefined}
              startFrame={0}
              durationFrames={STEP_FRAMES}
            />
          </Sequence>
        );
      })}

      <Sequence from={INTRO_FRAMES + STEP_COUNT * STEP_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <BrandOutro />
      </Sequence>
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
