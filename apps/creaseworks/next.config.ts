import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* basePath removed — creaseworks is served on its own subdomain
     (creaseworks.windedvertigo.com). The /reservoir/creaseworks path on
     windedvertigo.com is handled via Vercel rewrites in apps/site/vercel.json,
     which proxies to the subdomain without needing a basePath. Re-add basePath
     only if/when we drop the subdomain and serve exclusively under /reservoir/. */
  transpilePackages: ["@windedvertigo/tokens"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.stripe.com https://vitals.vercel-insights.com",
              "frame-src https://js.stripe.com",
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
