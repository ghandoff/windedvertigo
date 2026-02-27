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
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "36px",
            fontWeight: 700,
            color: "var(--wv-redwood)",
          }}
        >
          community
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "16px",
            color: "var(--wv-cadet)",
            lineHeight: "1.5",
          }}
        >
          Celebrate creativity and consistency. See who's earning credits through reflection,
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
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            borderRadius: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            border: `1px solid var(--wv-champagne)`,
          }}
        >
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--wv-cadet)",
            }}
          >
            No leaders yet
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--wv-cadet)",
            }}
          >
            Be the first to join the leaderboard and share your creative journey!
          </p>
        </div>
      ) : (
        <div>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `2px solid var(--wv-champagne)`,
                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Rank
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Credits
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Streak
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Runs
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wv-cadet)",
                    }}
                  >
                    Shares
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.rank}
                    style={{
                      borderBottom: `1px solid var(--wv-champagne)`,
                      backgroundColor: entry.is_current_user
                        ? "rgba(206, 164, 130, 0.1)"
                        : undefined,
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "var(--wv-sienna)",
                      }}
                    >
                      #{entry.rank}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 500,
                        color: entry.is_current_user ? "var(--wv-redwood)" : "inherit",
                      }}
                    >
                      {entry.display_name}
                      {entry.is_current_user && " (you)"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        color: "var(--wv-redwood)",
                        fontWeight: 600,
                      }}
                    >
                      {entry.total_credits}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        color: "var(--wv-sienna)",
                      }}
                    >
                      {entry.current_streak > 0 ? `${entry.current_streak}d` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        color: "var(--wv-cadet)",
                      }}
                    >
                      {entry.total_runs}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        color: "var(--wv-cadet)",
                      }}
                    >
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
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid var(--wv-champagne)`,
                  backgroundColor: entry.is_current_user
                    ? "rgba(206, 164, 130, 0.1)"
                    : "rgba(255, 255, 255, 0.5)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: entry.is_current_user ? "var(--wv-redwood)" : "inherit",
                      }}
                    >
                      #{entry.rank} {entry.display_name}
                      {entry.is_current_user && " (you)"}
                    </h3>
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--wv-redwood)",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "4px",
                      fontWeight: 600,
                      fontSize: "14px",
                    }}
                  >
                    {entry.total_credits}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <p style={{ margin: "0 0 2px 0", color: "var(--wv-cadet)" }}>Streak</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--wv-sienna)",
                      }}
                    >
                      {entry.current_streak > 0 ? `${entry.current_streak}d` : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px 0", color: "var(--wv-cadet)" }}>Runs</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--wv-cadet)",
                      }}
                    >
                      {entry.total_runs}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px 0", color: "var(--wv-cadet)" }}>Shares</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--wv-cadet)",
                      }}
                    >
                      {entry.gallery_shares}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
