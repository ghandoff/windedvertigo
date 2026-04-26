/**
 * /api/generate-pdfs — REMOVED
 *
 * PDF generation has been moved to the port (port.windedvertigo.com) cron
 * at /api/cron/generate-pdfs. This route existed on the site when it was
 * hosted on Vercel (Node.js), but Cloudflare Pages Workers cannot run
 * @react-pdf/renderer.
 *
 * The port's Monday 6am UTC cron now handles generation directly.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { error: "PDF generation has moved to the port cron — see port/app/api/cron/generate-pdfs" },
    { status: 404 },
  );
}
