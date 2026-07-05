import React from "react";
import { Sequence, useCurrentFrame, interpolate, AbsoluteFill } from "remotion";
import { Cord } from "./Cord";
import { PaperBackground, PAPER_BG, GRID_COLOR, INK_WARM, TERRACOTTA } from "./PaperBackground";

const BG = PAPER_BG;
const ROPE = "#d89f3a";
const INK = INK_WARM;

const textStyle: React.CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 36,
  color: INK_WARM,
  textAlign: "center",
  maxWidth: 900,
  lineHeight: 1.4,
};

// ——— Shot 1: cord wakes up ———
const Shot1: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = interpolate(
    frame,
    [0, 30, 45, 55, 60],
    [0.6, 0.6, 1.1, 0.95, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const textOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}><PaperBackground />
      <div style={{ transform: `scale(${scale})` }}>
        <Cord expression="excited" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <span style={textStyle}>oh — hello. let's make something.</span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Shot 2: two ends ———
const Shot2: React.FC = () => {
  const frame = useCurrentFrame();

  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // two small loop shapes, one left and one right
  const loopPath = "M 0 0 Q 20 -30 40 0 Q 20 30 0 0";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}><PaperBackground />
      {/* left loop */}
      <svg
        viewBox="-10 -40 60 80"
        width={80}
        height={80}
        style={{ position: "absolute", left: 400, top: 440 }}
      >
        <path d={loopPath} fill="none" stroke={ROPE} strokeWidth={3} />
      </svg>
      {/* centre cord */}
      <div style={{ transform: "scale(1.05)" }}>
        <Cord expression="neutral" />
      </div>
      {/* right loop */}
      <svg
        viewBox="-10 -40 60 80"
        width={80}
        height={80}
        style={{ position: "absolute", right: 400, top: 440 }}
      >
        <path d={loopPath} fill="none" stroke={ROPE} strokeWidth={3} />
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <span style={textStyle}>you've got two ends. let's try a square knot.</span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Shot 3: left over right ———
const Shot3: React.FC = () => {
  const frame = useCurrentFrame();

  // strokeDashoffset from 500 → 0 over frames 0–60 (shot-local)
  const dashOffset = interpolate(frame, [0, 60], [500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const text1Opacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const text2Opacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill><PaperBackground />
      {/* crossing path */}
      <svg
        viewBox="0 0 1920 1080"
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d="M 800 400 Q 960 300 1120 400 Q 960 500 800 400"
          fill="none"
          stroke={ROPE}
          strokeWidth={6}
          strokeDasharray={500}
          strokeDashoffset={dashOffset}
        />
      </svg>
      {/* cord tilted left */}
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 300,
          transform: "rotate(-10deg)",
        }}
      >
        <Cord expression="thinking" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text1Opacity,
        }}
      >
        <span style={textStyle}>left over right — then under. pull.</span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text2Opacity,
        }}
      >
        <span style={{ ...textStyle, fontSize: 28, color: "rgba(42,35,24,0.5)" }}>
          see? it's just a loop that holds itself.
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Shot 4: right over left ———
const Shot4: React.FC = () => {
  const frame = useCurrentFrame();

  const dashOffset = interpolate(frame, [0, 60], [500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill><PaperBackground />
      {/* mirrored crossing path */}
      <svg
        viewBox="0 0 1920 1080"
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d="M 1120 400 Q 960 300 800 400 Q 960 500 1120 400"
          fill="none"
          stroke={ROPE}
          strokeWidth={6}
          strokeDasharray={500}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", left: 760, top: 340 }}>
        <Cord expression="excited" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <span style={textStyle}>now right over left — then under again. and pull.</span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Shot 5: celebration ———
const Shot5: React.FC = () => {
  const frame = useCurrentFrame();

  const cordScale = interpolate(
    frame,
    [0, 15, 25, 35, 45, 60],
    [1.0, 1.3, 0.95, 1.1, 1.0, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cordRotation = interpolate(frame, [0, 60], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const text1Opacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const text2Opacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const overlayOpacity = interpolate(frame, [120, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // square knot SVG: two interlocked loop paths
  const knotOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}><PaperBackground />
      {/* square knot illustration */}
      <svg
        viewBox="0 0 300 150"
        width={300}
        height={150}
        style={{ position: "absolute", top: 200, left: 810, opacity: knotOpacity }}
      >
        <path
          d="M 50 75 Q 75 30 150 75 Q 225 120 250 75"
          fill="none"
          stroke={ROPE}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <path
          d="M 250 75 Q 225 30 150 75 Q 75 120 50 75"
          fill="none"
          stroke={ROPE}
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.7}
        />
      </svg>

      {/* cord with spring + spin */}
      <div
        style={{
          transform: `rotate(${cordRotation}deg) scale(${cordScale})`,
        }}
      >
        <Cord expression="excited" />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text1Opacity,
        }}
      >
        <span style={textStyle}>that's it. left over right, right over left.</span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text2Opacity,
        }}
      >
        <span style={{ ...textStyle, fontSize: 28, color: "rgba(42,35,24,0.5)" }}>
          if it tangles up — that just means you're practising.
        </span>
      </div>

      {/* brand fade — parchment washes in, ink wordmark */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: PAPER_BG,
          opacity: overlayOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 48,
            color: INK_WARM,
            letterSpacing: "0.08em",
          }}
        >
          creaseworks.
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const CordCartoon: React.FC = () => {
  return (
    <AbsoluteFill><PaperBackground />
      <Sequence from={0} durationInFrames={180}>
        <Shot1 />
      </Sequence>
      <Sequence from={180} durationInFrames={180}>
        <Shot2 />
      </Sequence>
      <Sequence from={360} durationInFrames={210}>
        <Shot3 />
      </Sequence>
      <Sequence from={570} durationInFrames={180}>
        <Shot4 />
      </Sequence>
      <Sequence from={750} durationInFrames={150}>
        <Shot5 />
      </Sequence>
    </AbsoluteFill>
  );
};
