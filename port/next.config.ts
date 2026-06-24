import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // basePath removed — port is on its own subdomain (port.windedvertigo.com)
  poweredByHeader: false,

  env: {
    BUILD_SHA:
      process.env.WORKERS_CI_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.GIT_SHA ||
      "dev",
    BUILD_REF: process.env.WORKERS_CI_COMMIT_REF || "unknown",
    BUILD_TIME: new Date().toISOString(),
  },

  async rewrites() {
    return [
      // OAuth discovery — Next ignores dot-folders, so map the well-known URLs
      // onto API routes. Claude Desktop fetches these to find the auth server.
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata/authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/metadata/authorization-server" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/metadata/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/metadata/protected-resource" },
    ];
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
      // /social redirect removed — social tab retired from campaigns page.
      // /strategy → /mo (2026-06 IA reorg: Mo's dashboard renamed for consistency
      // with the other agent routes /pam /carl /ops /finn). Old bookmarks + the
      // ?tab= deep-links keep working via this permanent redirect.
      { source: "/strategy",           destination: "/mo", permanent: true },
      // /analytics folded into /mo?tab=pipeline (formerly Phase 11 promotion to top-level)
      { source: "/analytics",          destination: "/mo?tab=pipeline", permanent: true },
      { source: "/settings/analytics", destination: "/mo?tab=pipeline", permanent: true },
      // Phase 11 settings refactor — ai-hub/competitors promoted to top-level
      { source: "/settings/ai", destination: "/ai-hub", permanent: true },
      { source: "/settings/competitors", destination: "/competitors", permanent: true },
      { source: "/finances", destination: "/finn", permanent: true },
    ];
  },

  async headers() {
    // Strict CSP for the whole app.
    const STRICT_CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.notion.com https://api.anthropic.com",
      // listen library: <audio> chunks are served from the port-assets R2 bucket.
      "media-src 'self' https://pub-ae6933715be744649a1f2fd99346225a.r2.dev",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "worker-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    // Relaxed CSP scoped to /voice only: the Vapi browser SDK uses Daily.co for
    // WebRTC, which needs api.vapi.ai + *.daily.co/*.pluot.blue (https + wss),
    // blob: workers, and an eval path for its call-machine. Kept off every
    // other route so the strict policy still protects the rest of the app.
    const VOICE_CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.vapi.ai wss://api.vapi.ai https://*.vapi.ai https://*.daily.co wss://*.daily.co https://*.pluot.blue",
      "media-src 'self' blob: mediastream:",
      "frame-src https://*.daily.co",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // microphone=(self) lets same-origin pages (e.g. /transcribe, /voice)
      // request mic access via getUserMedia. camera + geolocation stay disabled.
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      // Non-CSP security headers everywhere.
      { source: "/(.*)", headers: securityHeaders },
      // Strict CSP everywhere except /voice.
      {
        source: "/((?!voice).*)",
        headers: [{ key: "Content-Security-Policy", value: STRICT_CSP }],
      },
      // Relaxed CSP for the voice playground only.
      {
        source: "/voice",
        headers: [{ key: "Content-Security-Policy", value: VOICE_CSP }],
      },
    ];
  },
};

export default nextConfig;
