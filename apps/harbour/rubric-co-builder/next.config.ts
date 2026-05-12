import type { NextConfig } from "next";
import path from "path";

// basePath is only applied in production (via NEXT_PUBLIC_BASE_PATH set in
// wrangler.jsonc vars). local dev serves at `/` so the preview panel just works.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const config: NextConfig = {
  basePath,
  // Anchor standalone output to apps/harbour/ (the harbour sub-monorepo root)
  // so Next.js sets relativeAppDir:"rubric-co-builder" instead of the longer
  // path from windedvertigo/ root. Without this, OpenNext fails to find
  // pages-manifest.json under .next/standalone/.
  outputFileTracingRoot: path.join(__dirname, "../"),
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default config;
