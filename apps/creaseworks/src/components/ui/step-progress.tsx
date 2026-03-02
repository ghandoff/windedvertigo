/**
 * Step progress indicator — reusable visual + text progress for multi-step flows.
 *
 * Shows animated dots + a "step X of Y" label with the current step name.
 * Includes proper ARIA attributes for screen readers.
 *
 * Usage:
 *   <StepProgress
 *     currentStep={1}
 *     totalSteps={3}
 *     stepLabels={["who's playing?", "where?", "energy level"]}
 *   />
 */

interface StepProgressProps {
  /** Zero-indexed current step */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Optional labels per step — shown alongside "step X of Y" */
  stepLabels?: string[];
}

export default function StepProgress({
  currentStep,
  totalSteps,
  stepLabels,
}: StepProgressProps) {
  const displayStep = currentStep + 1; // human-readable 1-indexed
  const label = stepLabels?.[currentStep];
  const srText = `step ${displayStep} of ${totalSteps}${label ? `: ${label}` : ""}`;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="progressbar"
      aria-valuenow={displayStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={srText}
    >
      {/* visual dots */}
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`block rounded-full transition-all duration-300 ${
              i === currentStep
                ? "w-8 h-2 bg-sienna"
                : i < currentStep
                  ? "w-2 h-2 bg-sienna/40"
                  : "w-2 h-2 bg-cadet/15"
            }`}
          />
        ))}
      </div>

      {/* text label */}
      <p className="text-xs text-cadet/40 tracking-wide">
        <span className="font-medium text-cadet/50">
          step {displayStep} of {totalSteps}
        </span>
        {label && (
          <span className="text-cadet/30">
            {" · "}
            {label}
          </span>
        )}
      </p>
    </div>
  );
}
