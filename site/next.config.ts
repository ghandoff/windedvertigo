import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Notion search for multi-source DB assets can take 30+ rounds (~90s)
  staticPageGenerationTimeout: 180,

  // External rewrites — proxy harbour apps to their Vercel deployments
  async rewrites() {
    return [
      // CRM
      {
        source: "/crm",
        destination: "https://wv-crm-ghandoffs-projects.vercel.app/crm",
      },
      {
        source: "/crm/",
        destination: "https://wv-crm-ghandoffs-projects.vercel.app/crm",
      },
      {
        source: "/crm/:path*",
        destination:
          "https://wv-crm-ghandoffs-projects.vercel.app/crm/:path*",
      },

      // creaseworks
      {
        source: "/harbour/creaseworks",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks",
      },
      {
        source: "/harbour/creaseworks/",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks",
      },
      {
        source: "/harbour/creaseworks/:path*",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks/:path*",
      },

      // vertigo vault
      {
        source: "/harbour/vertigo-vault",
        destination:
          "https://vertigo-vault-ghandoffs-projects.vercel.app/harbour/vertigo-vault",
      },
      {
        source: "/harbour/vertigo-vault/",
        destination:
          "https://vertigo-vault-ghandoffs-projects.vercel.app/harbour/vertigo-vault",
      },
      {
        source: "/harbour/vertigo-vault/:path*",
        destination:
          "https://vertigo-vault-ghandoffs-projects.vercel.app/harbour/vertigo-vault/:path*",
      },

      // deep deck
      {
        source: "/harbour/deep-deck",
        destination:
          "https://deep-deck-ghandoffs-projects.vercel.app/harbour/deep-deck",
      },
      {
        source: "/harbour/deep-deck/",
        destination:
          "https://deep-deck-ghandoffs-projects.vercel.app/harbour/deep-deck",
      },
      {
        source: "/harbour/deep-deck/:path*",
        destination:
          "https://deep-deck-ghandoffs-projects.vercel.app/harbour/deep-deck/:path*",
      },

      // depth chart
      {
        source: "/harbour/depth-chart",
        destination:
          "https://depth-chart-ghandoffs-projects.vercel.app/harbour/depth-chart",
      },
      {
        source: "/harbour/depth-chart/",
        destination:
          "https://depth-chart-ghandoffs-projects.vercel.app/harbour/depth-chart",
      },
      {
        source: "/harbour/depth-chart/:path*",
        destination:
          "https://depth-chart-ghandoffs-projects.vercel.app/harbour/depth-chart/:path*",
      },

      // raft house
      {
        source: "/harbour/raft-house",
        destination:
          "https://raft-house-ghandoffs-projects.vercel.app/harbour/raft-house",
      },
      {
        source: "/harbour/raft-house/",
        destination:
          "https://raft-house-ghandoffs-projects.vercel.app/harbour/raft-house",
      },
      {
        source: "/harbour/raft-house/:path*",
        destination:
          "https://raft-house-ghandoffs-projects.vercel.app/harbour/raft-house/:path*",
      },

      // admin (via creaseworks)
      {
        source: "/harbour/admin/login",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks/login?callbackUrl=%2Fadmin",
      },
      {
        source: "/harbour/admin",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks/admin",
      },
      {
        source: "/harbour/admin/:path*",
        destination:
          "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks/admin/:path*",
      },

      // harbour hub (catch-all — must be last)
      {
        source: "/harbour",
        destination: "https://harbour-ghandoffs-projects.vercel.app/harbour",
      },
      {
        source: "/harbour/",
        destination: "https://harbour-ghandoffs-projects.vercel.app/harbour",
      },
      {
        source: "/harbour/:path*",
        destination:
          "https://harbour-ghandoffs-projects.vercel.app/harbour/:path*",
      },
    ];
  },

  // Redirects — vertigo vault legacy URLs
  async redirects() {
    return [
      {
        source: "/vertigo-vault/:path*",
        destination: "/harbour/vertigo-vault/:path*",
        permanent: true,
      },
      {
        source: "/vertigo-vault",
        destination: "/harbour/vertigo-vault",
        permanent: true,
      },
      // conference experience — redirect to static HTML in public/
      {
        source: "/portfolio/assets/pedal-conference-experience",
        destination: "/portfolio/assets/pedal-conference-experience/index.html",
        permanent: false,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.notion.com https://wv-crm-ghandoffs-projects.vercel.app https://vitals.vercel-insights.com wss://*.partykit.dev wss://*.partykit.io",
              "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
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
