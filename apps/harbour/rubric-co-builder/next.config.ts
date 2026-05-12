import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  // Hardcoded — basePath is a BUILD-time setting in Next.js. Reading from
  // process.env at this scope means the value is captured during `next build`,
  // and NEXT_PUBLIC_BASE_PATH in wrangler.jsonc vars is only available at
  // RUNTIME — so the build always produced basePath="" and routes 404'd at
  // /harbour/rubric-co-builder/*. Matches the creaseworks/next.config.ts
  // hardcode pattern.
  basePath: "/harbour/rubric-co-builder",
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
