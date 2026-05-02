import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* creaseworks is served at windedvertigo.com/harbour/creaseworks via the
     site proxy rewrites. basePath ensures Next.js generates correct asset
     URLs and internal links under that prefix. */
  basePath: "/harbour/creaseworks",
  poweredByHeader: false,
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: "standalone",
  transpilePackages: ["@windedvertigo/tokens", "@windedvertigo/auth", "@windedvertigo/stripe", "@windedvertigo/feedback"],

  // CF Workers: Auth.js requires AUTH_TRUST_HOST=true so it doesn't reject
  // the x-forwarded-host header injected by Cloudflare's reverse proxy.
  env: {
    AUTH_TRUST_HOST: process.env.CF_WORKERS_ENV === "1" ? "true" : (process.env.AUTH_TRUST_HOST ?? ""),
  },

  /* Custom loader routes all next/image requests through Cloudflare CDN
     (cdn.creaseworks.co) instead of Vercel's /_next/image proxy.
     This avoids consuming the 5 000 transforms/mo Hobby quota. */
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudflare-image-loader.ts",
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
              // Note: unsafe-inline kept for Next.js hydration scripts/styles.
              // Dynamic code execution directive removed — not needed by app or Stripe.js.
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.stripe.com",
              "frame-src https://js.stripe.com",
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
