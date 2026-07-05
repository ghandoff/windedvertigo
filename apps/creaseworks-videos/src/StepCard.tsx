import { useCurrentFrame, interpolate, Easing } from "remotion";
import { brand } from "./remotion-tokens";

type StepCardProps = {
  stepNumber: number;
  instruction: string;
  materials?: string[];
  startFrame: number;
  durationFrames?: number;
};

export const StepCard: React.FC<StepCardProps> = ({
  stepNumber,
  instruction,
  materials,
  startFrame,
  durationFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const translateY = interpolate(localFrame, [0, 15], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // hide before startFrame and after durationFrames
  if (localFrame < 0 || localFrame >= durationFrames) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: brand.cadet,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "80%",
          backgroundColor: brand.white,
          borderRadius: 12,
          padding: "40px 48px",
          opacity,
          transform: `translateY(${translateY}px)`,
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
          {stepNumber}
        </div>
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 24,
            color: brand.cadet,
            fontWeight: 400,
            letterSpacing: "0.01em",
            marginBottom: materials && materials.length > 0 ? 20 : 0,
          }}
        >
          {instruction}
        </div>
        {materials && materials.length > 0 && (
          <ul
            style={{
              margin: 0,
              padding: "0 0 0 20px",
              listStyle: "disc",
            }}
          >
            {materials.map((m) => (
              <li
                key={m}
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 16,
                  color: "#888",
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
  );
};
