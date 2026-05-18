import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), "content/harbour-launch-map.html"),
    "utf-8"
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
