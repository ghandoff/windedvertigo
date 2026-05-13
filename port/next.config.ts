import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // basePath removed — port is on its own subdomain (port.windedvertigo.com)
  poweredByHeader: false,
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: "standalone",
  transpilePackages: ["@windedvertigo/booking", "@windedvertigo/job-queue"],

  env: {
    BUILD_SHA:
      process.env.WORKERS_CI_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.GIT_SHA ||
      "dev",
    BUILD_REF: process.env.WORKERS_CI_COMMIT_REF || "unknown",
    BUILD_TIME: new Date().toISOString(),
  },

  async redirects() {
    return [
      // Phase 2 restructure — permanent redirects from old routes
      { source: "/deals", destination: "/opportunities?tab=deals", permanent: true },
      { source: "/rfp-radar", destination: "/opportunities?tab=rfps", permanent: true },
      { source: "/work/contracts", destination: "/projects?type=contracts", permanent: true },
      { source: "/work/studios", destination: "/projects?type=studios", permanent: true },
      { source: "/email", destination: "/campaigns?tab=email", permanent: true },
      // Phase 10: /events is now a standalone page — old redirect removed.
      // /campaigns?tab=events is handled by a server-side redirect inside campaigns/page.tsx.
      { source: "/social", destination: "/campaigns?tab=social", permanent: true },
      // /analytics folded into /strategy?tab=pipeline (formerly Phase 11 promotion to top-level)
      { source: "/analytics",          destination: "/strategy?tab=pipeline", permanent: true },
      { source: "/settings/analytics", destination: "/strategy?tab=pipeline", permanent: true },
      // Phase 11 settings refactor — ai-hub/competitors promoted to top-level
      { source: "/settings/ai", destination: "/ai-hub", permanent: true },
      { source: "/settings/competitors", destination: "/competitors", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.notion.com https://api.anthropic.com",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "worker-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
