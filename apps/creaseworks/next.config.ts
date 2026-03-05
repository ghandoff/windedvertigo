import type { NextConfig } from "next"; // trigger deploy

const nextConfig: NextConfig = {
  /* creaseworks is served at windedvertigo.com/harbor/creaseworks via Vercel
     multi-zone rewrites (see apps/site/vercel.json). basePath ensures Next.js
     generates correct asset URLs and internal links under that prefix. */
  basePath: "/harbor/creaseworks",
  poweredByHeader: false,
  transpilePackages: ["@windedvertigo/tokens"],

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
              "connect-src 'self' https://api.stripe.com https://vitals.vercel-insights.com",
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
