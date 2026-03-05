import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/harbor/vertigo-vault",
  poweredByHeader: false,
  transpilePackages: ["@windedvertigo/tokens"],

  /**
   * Security headers — non-CSP headers live here as static config.
   * CSP is set per-request in middleware.ts with a nonce so we can
   * use `'strict-dynamic'` instead of `'unsafe-inline'` in script-src.
   */
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
