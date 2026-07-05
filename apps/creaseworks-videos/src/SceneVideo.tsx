// SceneVideo — illustrated playdate scenes, built for image-slot workflow.
//
// Each shot accepts an optional `imageSrc`. When provided, the real
// illustration (from Imagen 3 / any generator) renders with a Ken Burns zoom.
// When absent, an SVG placeholder describes the scene clearly enough to show
// Payton the framing intent.
//
// Architecture notes:
// - All motion via useCurrentFrame() + interpolate() — no CSS animations
// - Ken Burns: scale 1.0→1.08 over shot duration; pan direction alternates
// - Captions fade in at frame 30 of each shot
// - Image slots are <img> tags — swap Higgsfield video clips in later
//   by replacing <img> with <video autoPlay muted loop>

import React from "react";
import {
  Sequence,
  useCurrentFrame,
  interpolate,
  AbsoluteFill,
  Img,
} from "remotion";
import { brand } from "./remotion-tokens";

// ─── palette ─────────────────────────────────────────────────────────────────
const PAPER = "#faf7f2";  // warm off-white — craft paper feel
const WARM_MID = "#e8e0d5";
const CADET = brand.cadet;
const REDWOOD = brand.redwood;
const ROPE_GOLD = "#d89f3a";
const TWIG_GREEN = "#5a7a4a";
const INK = "#241c1e";
const CREAM = brand.cream;

const SHOT_FRAMES = 150; // 5 s per shot
const TOTAL_FRAMES = SHOT_FRAMES * 5; // 750 frames = 25 s

// ─── caption bar ─────────────────────────────────────────────────────────────
const Caption: React.FC<{ text: string; subtext?: string }> = ({ text, subtext }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [20, 40], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "40px 80px 56px",
        background: "linear-gradient(to top, rgba(36,28,30,0.72) 0%, transparent 100%)",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 40,
          fontWeight: 500,
          color: CREAM,
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
      {subtext && (
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 26,
            color: "rgba(247,245,242,0.65)",
            marginTop: 8,
            fontWeight: 400,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};

// ─── Ken Burns wrapper ────────────────────────────────────────────────────────
// panDir: "right" pans left→right; "left" pans right→left; "up" zooms in from top
const KenBurns: React.FC<{
  imageSrc: string;
  panDir?: "right" | "left" | "up";
  children?: React.ReactNode;
}> = ({ imageSrc, panDir = "right", children }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, SHOT_FRAMES], [1.0, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panX =
    panDir === "right"
      ? interpolate(frame, [0, SHOT_FRAMES], [0, -3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : panDir === "left"
      ? interpolate(frame, [0, SHOT_FRAMES], [-3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  const panY =
    panDir === "up"
      ? interpolate(frame, [0, SHOT_FRAMES], [2, -2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: INK }}>
      <Img
        src={imageSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
          transformOrigin: "center",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

// ─── SVG placeholder illustrations ───────────────────────────────────────────
// These are actual scene sketches, not gray boxes.
// Each one describes framing + subject so Payton can see the shot intent.

// Scene A: kids gathered around a craft table (aerial view)
const TableSceneSVG: React.FC = () => (
  <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute" }}>
    {/* background */}
    <rect width={1920} height={1080} fill={PAPER} />

    {/* table — warm wood rectangle */}
    <rect x={560} y={300} width={800} height={480} rx={32} fill={WARM_MID} stroke="#c8bdb0" strokeWidth={3} />

    {/* table grain lines */}
    {[340, 380, 420, 460, 500, 540, 580, 620, 660, 700].map((y, i) => (
      <line key={i} x1={560} y1={y} x2={1360} y2={y} stroke="#d5cdc4" strokeWidth={1} />
    ))}

    {/* materials on the table */}
    {/* tissue paper stack — layers of coloured rectangles */}
    <rect x={760} y={430} width={120} height={80} rx={6} fill="#f9a8d4" transform="rotate(-5 820 470)" />
    <rect x={764} y={426} width={120} height={80} rx={6} fill="#fdba74" transform="rotate(-2 824 466)" />
    <rect x={768} y={422} width={120} height={80} rx={6} fill="#86efac" transform="rotate(3 828 462)" />
    <rect x={772} y={418} width={120} height={80} rx={6} fill="#93c5fd" transform="rotate(-1 832 458)" />

    {/* scissors */}
    <g transform="translate(1000 480) rotate(25)">
      <ellipse cx={0} cy={-20} rx={8} ry={12} fill="none" stroke={INK} strokeWidth={3} />
      <ellipse cx={0} cy={20} rx={8} ry={12} fill="none" stroke={INK} strokeWidth={3} />
      <line x1={0} y1={-8} x2={0} y2={8} stroke={INK} strokeWidth={3} />
      <line x1={0} y1={8} x2={0} y2={50} stroke={INK} strokeWidth={3} />
      <line x1={0} y1={8} x2={16} y2={50} stroke={INK} strokeWidth={3} />
    </g>

    {/* pipe cleaners */}
    <path d="M 1060 400 Q 1080 450 1060 500 Q 1040 550 1060 580" fill="none" stroke="#60a5fa" strokeWidth={5} strokeLinecap="round" />
    <path d="M 1080 410 Q 1100 460 1080 510 Q 1060 560 1080 590" fill="none" stroke="#f472b6" strokeWidth={5} strokeLinecap="round" />

    {/* finished flower in corner of table */}
    {[0, 60, 120, 180, 240, 300].map((angle, i) => (
      <ellipse
        key={i}
        cx={1160} cy={530}
        rx={22} ry={14}
        fill={["#f9a8d4","#fdba74","#86efac","#93c5fd","#f9a8d4","#fdba74"][i]}
        transform={`rotate(${angle} 1160 530) translate(0, -24) rotate(${-angle} 1160 506)`}
        opacity={0.9}
      />
    ))}
    <circle cx={1160} cy={530} r={14} fill={ROPE_GOLD} />

    {/* four kids sitting around the table — circles + shoulder arcs */}
    {/* top — two kids */}
    <g transform="translate(760 305)">
      <ellipse cx={0} cy={0} rx={44} ry={24} fill={CADET} opacity={0.9} />
      <circle cx={0} cy={-54} r={36} fill={CADET} />
    </g>
    <g transform="translate(1000 295)">
      <ellipse cx={0} cy={0} rx={44} ry={24} fill={REDWOOD} opacity={0.9} />
      <circle cx={0} cy={-54} r={36} fill={REDWOOD} />
    </g>

    {/* bottom — two kids */}
    <g transform="translate(760 775)">
      <ellipse cx={0} cy={0} rx={44} ry={24} fill={TWIG_GREEN} opacity={0.9} />
      <circle cx={0} cy={54} r={36} fill={TWIG_GREEN} />
    </g>
    <g transform="translate(1000 785)">
      <ellipse cx={0} cy={0} rx={44} ry={24} fill={ROPE_GOLD} opacity={0.9} />
      <circle cx={0} cy={54} r={36} fill={ROPE_GOLD} />
    </g>

    {/* left kid */}
    <g transform="translate(560 530)">
      <ellipse cx={0} cy={0} rx={24} ry={44} fill="#7c6d5e" opacity={0.9} />
      <circle cx={-54} cy={0} r={36} fill="#7c6d5e" />
    </g>

    {/* placeholder label */}
    <rect x={40} y={40} width={320} height={44} rx={8} fill={CADET} opacity={0.8} />
    <text x={56} y={70} fontFamily="Inter, sans-serif" fontSize={20} fill={CREAM} letterSpacing="0.04em">
      📸 image slot: table scene
    </text>
  </svg>
);

// Scene B: close-up of hands holding tissue paper
const HandsSceneSVG: React.FC = () => (
  <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute" }}>
    <rect width={1920} height={1080} fill={PAPER} />

    {/* soft radial vignette suggestion */}
    <ellipse cx={960} cy={540} rx={800} ry={500} fill={WARM_MID} opacity={0.3} />

    {/* tissue paper stack — fan of coloured sheets */}
    {[
      { fill: "#93c5fd", rotate: -15 },
      { fill: "#f9a8d4", rotate: -8 },
      { fill: "#fdba74", rotate: -2 },
      { fill: "#86efac", rotate: 5 },
      { fill: "#d8b4fe", rotate: 12 },
    ].map(({ fill, rotate }, i) => (
      <rect
        key={i}
        x={760} y={340}
        width={400} height={400}
        rx={8}
        fill={fill}
        opacity={0.85}
        transform={`rotate(${rotate} 960 540)`}
      />
    ))}

    {/* left hand — simple rounded palm + finger lines */}
    <g>
      {/* palm */}
      <ellipse cx={680} cy={620} rx={90} ry={110} fill="#f5c5a3" transform="rotate(-20 680 620)" />
      {/* thumb */}
      <ellipse cx={600} cy={560} rx={30} ry={50} fill="#f5c5a3" transform="rotate(-40 600 560)" />
      {/* fingers */}
      {[0,1,2,3].map(i => (
        <ellipse key={i} cx={660 + i*34} cy={488} rx={20} ry={60} fill="#f5c5a3"
          transform={`rotate(${-10 + i*6} ${660 + i*34} 488)`} />
      ))}
      {/* knuckle lines */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={652 + i*34} y1={505} x2={668 + i*34} y2={510}
          stroke="#d4a07a" strokeWidth={2} />
      ))}
    </g>

    {/* right hand */}
    <g transform="scale(-1,1) translate(-1920, 0)">
      <ellipse cx={680} cy={620} rx={90} ry={110} fill="#f5c5a3" transform="rotate(-20 680 620)" />
      <ellipse cx={600} cy={560} rx={30} ry={50} fill="#f5c5a3" transform="rotate(-40 600 560)" />
      {[0,1,2,3].map(i => (
        <ellipse key={i} cx={660 + i*34} cy={488} rx={20} ry={60} fill="#f5c5a3"
          transform={`rotate(${-10 + i*6} ${660 + i*34} 488)`} />
      ))}
      {[0,1,2,3].map(i => (
        <line key={i} x1={652 + i*34} y1={505} x2={668 + i*34} y2={510}
          stroke="#d4a07a" strokeWidth={2} />
      ))}
    </g>

    <rect x={40} y={40} width={360} height={44} rx={8} fill={CADET} opacity={0.8} />
    <text x={56} y={70} fontFamily="Inter, sans-serif" fontSize={20} fill={CREAM} letterSpacing="0.04em">
      📸 image slot: hands close-up
    </text>
  </svg>
);

// Scene C: folding — fan-fold in progress
const FoldingSceneSVG: React.FC<{ frame: number }> = ({ frame }) => {
  // animate the fold unfolding over this shot
  const foldCount = Math.floor(interpolate(frame, [0, 80], [1, 7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  return (
    <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute" }}>
      <rect width={1920} height={1080} fill={PAPER} />

      {/* accordion folds — builds up over time */}
      {Array.from({ length: foldCount }).map((_, i) => (
        <rect
          key={i}
          x={760 + i * 60}
          y={340}
          width={56}
          height={400}
          rx={4}
          fill={["#93c5fd","#f9a8d4","#fdba74","#86efac","#d8b4fe","#93c5fd","#f9a8d4"][i % 7]}
          opacity={0.88}
        />
      ))}

      {/* fold crease lines */}
      {Array.from({ length: foldCount }).map((_, i) => (
        <line
          key={i}
          x1={760 + i * 60}
          y1={340}
          x2={760 + i * 60}
          y2={740}
          stroke="#c8bdb0"
          strokeWidth={1.5}
        />
      ))}

      {/* hands holding the accordion */}
      <ellipse cx={740} cy={540} rx={50} ry={80} fill="#f5c5a3" transform="rotate(-10 740 540)" />
      <ellipse cx={760 + foldCount * 60 + 50} cy={540} rx={50} ry={80}
        fill="#f5c5a3" transform={`rotate(10 ${760 + foldCount * 60 + 50} 540)`} />

      <rect x={40} y={40} width={360} height={44} rx={8} fill={CADET} opacity={0.8} />
      <text x={56} y={70} fontFamily="Inter, sans-serif" fontSize={20} fill={CREAM} letterSpacing="0.04em">
        📸 image slot: folding step
      </text>
    </svg>
  );
};

// Scene D: finished tissue paper flower held up
const FlowerSceneSVG: React.FC = () => (
  <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute" }}>
    {/* warm gradient background */}
    <defs>
      <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#fff8f0" />
        <stop offset="100%" stopColor={WARM_MID} />
      </radialGradient>
    </defs>
    <rect width={1920} height={1080} fill="url(#bg-grad)" />

    {/* stem — pipe cleaner */}
    <path d="M 960 960 Q 940 800 960 640" fill="none" stroke="#60a5fa" strokeWidth={8} strokeLinecap="round" />

    {/* petals — tissue paper layers radiating from centre */}
    {[0,40,80,120,160,200,240,280,320].map((angle, i) => {
      const colors = ["#f9a8d4","#fdba74","#86efac","#93c5fd","#d8b4fe","#fde68a","#f9a8d4","#fdba74","#86efac"];
      return (
        <g key={i} transform={`rotate(${angle} 960 580)`}>
          <ellipse cx={960} cy={480} rx={48} ry={80} fill={colors[i]} opacity={0.82} />
        </g>
      );
    })}
    {/* petal layer 2 — offset for depth */}
    {[20,60,100,140,180,220,260,300,340].map((angle, i) => {
      const colors = ["#fde68a","#f9a8d4","#fdba74","#86efac","#93c5fd","#d8b4fe","#fde68a","#f9a8d4","#fdba74"];
      return (
        <g key={i} transform={`rotate(${angle} 960 580)`}>
          <ellipse cx={960} cy={490} rx={40} ry={68} fill={colors[i]} opacity={0.72} />
        </g>
      );
    })}
    {/* centre knot */}
    <circle cx={960} cy={580} r={32} fill={ROPE_GOLD} />
    <circle cx={960} cy={580} r={20} fill="#c47e1c" />

    {/* hand holding it */}
    <ellipse cx={960} cy={960} rx={80} ry={60} fill="#f5c5a3" />
    {[0,1,2,3].map(i => (
      <ellipse key={i} cx={900 + i*42} cy={900} rx={18} ry={52} fill="#f5c5a3"
        transform={`rotate(${-8 + i*4} ${900 + i*42} 900)`} />
    ))}

    <rect x={40} y={40} width={360} height={44} rx={8} fill={CADET} opacity={0.8} />
    <text x={56} y={70} fontFamily="Inter, sans-serif" fontSize={20} fill={CREAM} letterSpacing="0.04em">
      📸 image slot: finished flower
    </text>
  </svg>
);

// ─── Shot components ──────────────────────────────────────────────────────────

const TitleCard: React.FC<{ activityName: string; imageSrc?: string }> = ({
  activityName,
  imageSrc,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [20, 50], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // fade to black on exit
  const exitOpacity = interpolate(frame, [120, 150], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CADET }}>
      {/* subtle texture */}
      <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", opacity: 0.04 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={i} x1={0} y1={i * 36} x2={1920} y2={i * 36} stroke={CREAM} strokeWidth={1} />
        ))}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* creaseworks label */}
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 500,
            color: "rgba(247,245,242,0.5)",
            letterSpacing: "0.18em",
            textTransform: "lowercase",
            opacity: subtitleOpacity,
          }}
        >
          creaseworks playdate
        </div>

        {/* activity name */}
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 96,
            fontWeight: 600,
            color: CREAM,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 1200,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {activityName}
        </div>

        {/* redwood underline */}
        <div
          style={{
            width: interpolate(frame, [60, 100], [0, 320], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 4,
            backgroundColor: REDWOOD,
            borderRadius: 2,
          }}
        />
      </div>

      {/* exit fade */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: INK, opacity: exitOpacity }} />
    </AbsoluteFill>
  );
};

const SceneShot: React.FC<{
  imageSrc?: string;
  placeholder: React.ReactNode;
  caption: string;
  subtext?: string;
  panDir?: "right" | "left" | "up";
}> = ({ imageSrc, placeholder, caption, subtext, panDir = "right" }) => {
  const frame = useCurrentFrame();

  // entrance: short fade from black
  const entranceOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: entranceOpacity }}>
      {imageSrc ? (
        <KenBurns imageSrc={imageSrc} panDir={panDir}>
          <Caption text={caption} subtext={subtext} />
        </KenBurns>
      ) : (
        <>
          {placeholder}
          <Caption text={caption} subtext={subtext} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ─── Scene Video composition ──────────────────────────────────────────────────
// To swap in real images, add the paths here:
// const sceneImages = {
//   table:   "/path/to/generated/table-scene.jpg",
//   hands:   "/path/to/generated/hands.jpg",
//   folding: "/path/to/generated/folding.jpg",
//   flower:  "/path/to/generated/flower.jpg",
// };

type SceneImages = {
  table?: string;
  hands?: string;
  folding?: string;
  flower?: string;
};

const FoldingShot: React.FC<{ imageSrc?: string }> = ({ imageSrc }) => {
  const frame = useCurrentFrame();
  return (
    <SceneShot
      imageSrc={imageSrc}
      placeholder={<FoldingSceneSVG frame={frame} />}
      caption="fold it like a fan — back and forth"
      subtext="each crease is part of it"
      panDir="up"
    />
  );
};

export const SceneVideo: React.FC<SceneImages> = ({
  table,
  hands,
  folding,
  flower,
}) => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={SHOT_FRAMES}>
        <TitleCard activityName="tissue paper flowers" />
      </Sequence>

      <Sequence from={SHOT_FRAMES} durationInFrames={SHOT_FRAMES}>
        <SceneShot
          imageSrc={table}
          placeholder={<TableSceneSVG />}
          caption="everyone gathers — tissue paper in the middle"
          subtext="five sheets, any colours"
          panDir="right"
        />
      </Sequence>

      <Sequence from={SHOT_FRAMES * 2} durationInFrames={SHOT_FRAMES}>
        <SceneShot
          imageSrc={hands}
          placeholder={<HandsSceneSVG />}
          caption="pick up the stack"
          subtext="hold the edges — doesn't need to be perfect"
          panDir="left"
        />
      </Sequence>

      <Sequence from={SHOT_FRAMES * 3} durationInFrames={SHOT_FRAMES}>
        <FoldingShot imageSrc={folding} />
      </Sequence>

      <Sequence from={SHOT_FRAMES * 4} durationInFrames={SHOT_FRAMES}>
        <SceneShot
          imageSrc={flower}
          placeholder={<FlowerSceneSVG />}
          caption="pinch the middle, twist a pipe cleaner, pull each layer up"
          subtext="ta-da."
          panDir="up"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
