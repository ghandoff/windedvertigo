import { useCurrentFrame, interpolate, Easing } from "remotion";
import { brand } from "./remotion-tokens";

export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();

  const wordmarkOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // SVG underline: strokeDashoffset animates from 200 to 0 starting at frame 20
  const lineLength = 200;
  const strokeDashoffset = interpolate(frame, [20, 55], [lineLength, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: brand.cadet,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity: wordmarkOpacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 48,
            color: brand.white,
            letterSpacing: "0.04em",
            fontWeight: 300,
          }}
        >
          winded.vertigo
        </span>
        <svg width={lineLength} height={4} style={{ marginTop: 10, overflow: "visible" }}>
          <line
            x1={0}
            y1={2}
            x2={lineLength}
            y2={2}
            stroke={brand.white}
            strokeWidth={1.5}
            strokeDasharray={lineLength}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
      </div>
    </div>
  );
};
