/**
 * Streak badge — shows current streak with flame emoji.
 *
 * Server component. Displays "🔥 N day streak" with warm styling.
 * Shows nothing if streak is 0. Adds sparkle visual if streak >= 7.
 */

interface StreakBadgeProps {
  currentStreak: number
}

export default function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null

  const isBonus = currentStreak >= 7

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
      style={{
        color: "var(--wv-sienna)",
        backgroundColor: "rgba(140, 110, 80, 0.08)",
        border: "1px solid rgba(140, 110, 80, 0.15)",
      }}
    >
      <span className="text-base">🔥</span>
      <span>{currentStreak} day streak</span>
      {isBonus && <span className="text-xs ml-1">✨</span>}
    </div>
  )
}
