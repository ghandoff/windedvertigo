import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@windedvertigo/auth", "@windedvertigo/tokens"],

  // Required for Auth.js v5 on CF Workers: trusts the X-Forwarded-Host header
  // injected by Cloudflare's edge so AUTH_URL doesn't need to match exactly.
  env: {
    AUTH_TRUST_HOST: process.env.CF_WORKERS_ENV ? "true" : (process.env.AUTH_TRUST_HOST ?? ""),
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
        ],
      },
    ];
  },
};

export default nextConfig;
