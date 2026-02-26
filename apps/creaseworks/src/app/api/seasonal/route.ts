/**
 * API route: /api/seasonal
 *
 * GET — fetch seasonal playdates for the current season.
 * Returns JSON with season info, theme, and matching playdates.
 *
 * This endpoint is public (no auth required) as seasonal recommendations
 * are suitable for all users.
 *
 * Response shape:
 * {
 *   season: "winter" | "spring" | "summer" | "fall",
 *   theme: { emoji, label, color, description },
 *   playdates: PlaydateRow[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSeasonalPlaydates } from "@/lib/queries/seasonal";
import { getSeasonalTheme, getCurrentSeason } from "@/lib/seasonal";

export async function GET(_req: NextRequest) {
  try {
    const season = getCurrentSeason();
    const theme = getSeasonalTheme();
    const playdates = await getSeasonalPlaydates(6);

    return NextResponse.json({
      season,
      theme,
      playdates,
    });
  } catch (error) {
    console.error("Error fetching seasonal playdates:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasonal playdates" },
      { status: 500 },
    );
  }
}
