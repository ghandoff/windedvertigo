import { useCurrentFrame, interpolate, Easing } from "remotion";
import { brand } from "./remotion-tokens";

export const BrandOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const creaseworksOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const wordmarkOpacity = interpolate(frame, [10, 30], [0, 1], {
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
        gap: 16,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 64,
          color: brand.white,
          letterSpacing: "0.02em",
          fontWeight: 300,
          opacity: creaseworksOpacity,
        }}
      >
        creaseworks.
      </span>
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 24,
          color: brand.white,
          letterSpacing: "0.06em",
          fontWeight: 300,
          opacity: wordmarkOpacity,
        }}
      >
        winded.vertigo
      </span>
    </div>
  );
};
