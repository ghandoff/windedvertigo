export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      worker: "wv-harbour-creaseworks",
      sha: process.env.BUILD_SHA ?? "dev",
      ref: process.env.BUILD_REF ?? "unknown",
      built: process.env.BUILD_TIME ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
