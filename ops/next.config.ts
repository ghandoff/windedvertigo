import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: "standalone",
  transpilePackages: ["@windedvertigo/auth", "@windedvertigo/tokens"],

  // CF Workers: Auth.js requires AUTH_TRUST_HOST=true so it doesn't reject
  // the x-forwarded-host header injected by Cloudflare's reverse proxy.
  // AUTH_URL must also be set as a wrangler secret (https://ops.windedvertigo.com).
  env: {
    AUTH_TRUST_HOST: process.env.CF_WORKERS_ENV === "1" ? "true" : (process.env.AUTH_TRUST_HOST ?? ""),
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
              "connect-src 'self'",
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
