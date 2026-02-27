/**
 * Community leaderboard page
 *
 * Displays the top community members ranked by credits earned.
 * Users can opt in to appear on the leaderboard.
 * Server component that fetches leaderboard data for public display.
 */

import { getSession } from "@/lib/auth-helpers";
import { getLeaderboard, getLeaderboardStatus } from "@/lib/queries/leaderboard";
import LeaderboardOptIn from "@/components/leaderboard-opt-in";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const session = await getSession();

  // Fetch leaderboard and user's opt-in status
  const leaderboard = await getLeaderboard(session?.userId, 20);
  const userStatus = session ? await getLeaderboardStatus(session.userId) : null;

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-12 sm:pb-12 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2 text-redwood">
          community
        </h1>
        <p className="text-base text-cadet leading-relaxed">
          Celebrate creativity and consistency. See who&apos;s earning credits through reflection,
          sharing, and sustained practice.
        </p>
      </div>

      {/* Opt-in toggle (only show if logged in) */}
      {session && userStatus && (
        <LeaderboardOptIn
          initialOptedIn={userStatus.opted_in}
          initialDisplayName={userStatus.display_name}
        />
      )}

      {/* Leaderboard content */}
      {leaderboard.length === 0 ? (
        <div className="text-center py-16 rounded-lg bg-white/50 border border-champagne">
          <p className="text-lg font-semibold text-cadet mb-2">
            no leaders yet
          </p>
          <p className="text-sm text-cadet/60">
            be the first to join the leaderboard and share your creative journey!
          </p>
        </div>
      ) : (
        <div>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-champagne bg-white/30">
                  <th className="px-4 py-3 text-left font-semibold text-cadet">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold text-cadet">Name</th>
                  <th className="px-4 py-3 text-center font-semibold text-cadet">Credits</th>
                  <th className="px-4 py-3 text-center font-semibold text-cadet">Streak</th>
                  <th className="px-4 py-3 text-center font-semibold text-cadet">Runs</th>
                  <th className="px-4 py-3 text-center font-semibold text-cadet">Shares</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.rank}
                    className={`border-b border-champagne ${
                      entry.is_current_user ? "bg-sienna/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-sienna">
                      #{entry.rank}
                    </td>
                    <td className={`px-4 py-3 font-medium ${
                      entry.is_current_user ? "text-redwood" : ""
                    }`}>
                      {entry.display_name}
                      {entry.is_current_user && " (you)"}
                    </td>
                    <td className="px-4 py-3 text-center text-redwood font-semibold">
                      {entry.total_credits}
                    </td>
                    <td className="px-4 py-3 text-center text-sienna">
                      {entry.current_streak > 0 ? `${entry.current_streak}d` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-cadet">
                      {entry.total_runs}
                    </td>
                    <td className="px-4 py-3 text-center text-cadet">
                      {entry.gallery_shares}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`p-4 rounded-lg border border-champagne ${
                  entry.is_current_user ? "bg-sienna/10" : "bg-white/50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`text-base font-semibold ${
                    entry.is_current_user ? "text-redwood" : ""
                  }`}>
                    #{entry.rank} {entry.display_name}
                    {entry.is_current_user && " (you)"}
                  </h3>
                  <span className="bg-redwood text-white px-3 py-1 rounded font-semibold text-sm">
                    {entry.total_credits}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-cadet/60 mb-0.5">Streak</p>
                    <p className="text-sm font-semibold text-sienna">
                      {entry.current_streak > 0 ? `${entry.current_streak}d` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-cadet/60 mb-0.5">Runs</p>
                    <p className="text-sm font-semibold text-cadet">
                      {entry.total_runs}
                    </p>
                  </div>
                  <div>
                    <p className="text-cadet/60 mb-0.5">Shares</p>
                    <p className="text-sm font-semibold text-cadet">
                      {entry.gallery_shares}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
