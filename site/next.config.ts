import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Notion search for multi-source DB assets can take 30+ rounds (~90s)
  staticPageGenerationTimeout: 180,

  // External rewrites — proxy harbour apps to CF Workers (or Vercel for blocked apps).
  // Returned as `beforeFiles` so rewrites are evaluated BEFORE the site app's
  // own filesystem routes. Without this, paths under /harbour/{app}/api/auth/...
  // get intercepted by the site's not-found.tsx (and worse, the 404 response
  // gets prerendered + cached in R2 ISR), 404'ing real OAuth callbacks instead
  // of proxying them to the harbour app workers.
  async rewrites() {
    return { beforeFiles: [
      // systems-thinking — portfolio route (CF Pages)
      {
        source: "/portfolio/assets/systems-thinking",
        destination: "https://systems-thinking.pages.dev/",
      },
      {
        source: "/portfolio/assets/systems-thinking/",
        destination: "https://systems-thinking.pages.dev/",
      },
      {
        source: "/portfolio/assets/systems-thinking/:path*",
        destination: "https://systems-thinking.pages.dev/:path*",
      },

      // systems-thinking — proxy root-relative /api/session/* calls from HTML pages (CF Pages Functions)
      {
        source: "/api/session/:path*",
        destination: "https://systems-thinking.pages.dev/api/session/:path*",
      },

      // values-auction — portfolio route (CF Pages, base: /portfolio/assets/values-auction/)
      {
        source: "/portfolio/assets/values-auction",
        destination: "https://values-auction-d9m.pages.dev/",
      },
      {
        source: "/portfolio/assets/values-auction/",
        destination: "https://values-auction-d9m.pages.dev/",
      },
      {
        source: "/portfolio/assets/values-auction/:path*",
        destination: "https://values-auction-d9m.pages.dev/:path*",
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
          "https://wv-harbour-deep-deck.windedvertigo.workers.dev/harbour/deep-deck",
      },
      {
        source: "/harbour/deep-deck/",
        destination:
          "https://wv-harbour-deep-deck.windedvertigo.workers.dev/harbour/deep-deck",
      },
      {
        source: "/harbour/deep-deck/:path*",
        destination:
          "https://wv-harbour-deep-deck.windedvertigo.workers.dev/harbour/deep-deck/:path*",
      },

      // depth chart
      {
        source: "/harbour/depth-chart",
        destination:
          "https://wv-harbour-depth-chart.windedvertigo.workers.dev/harbour/depth-chart",
      },
      {
        source: "/harbour/depth-chart/",
        destination:
          "https://wv-harbour-depth-chart.windedvertigo.workers.dev/harbour/depth-chart",
      },
      {
        source: "/harbour/depth-chart/:path*",
        destination:
          "https://wv-harbour-depth-chart.windedvertigo.workers.dev/harbour/depth-chart/:path*",
      },

      // raft house
      {
        source: "/harbour/raft-house",
        destination:
          "https://wv-harbour-raft-house.windedvertigo.workers.dev/harbour/raft-house",
      },
      {
        source: "/harbour/raft-house/",
        destination:
          "https://wv-harbour-raft-house.windedvertigo.workers.dev/harbour/raft-house",
      },
      {
        source: "/harbour/raft-house/:path*",
        destination:
          "https://wv-harbour-raft-house.windedvertigo.workers.dev/harbour/raft-house/:path*",
      },

      // tidal pool
      {
        source: "/harbour/tidal-pool",
        destination:
          "https://wv-harbour-tidal-pool.windedvertigo.workers.dev/harbour/tidal-pool",
      },
      {
        source: "/harbour/tidal-pool/",
        destination:
          "https://wv-harbour-tidal-pool.windedvertigo.workers.dev/harbour/tidal-pool",
      },
      {
        source: "/harbour/tidal-pool/:path*",
        destination:
          "https://wv-harbour-tidal-pool.windedvertigo.workers.dev/harbour/tidal-pool/:path*",
      },

      // paper trail
      {
        source: "/harbour/paper-trail",
        destination:
          "https://wv-harbour-paper-trail.windedvertigo.workers.dev/harbour/paper-trail",
      },
      {
        source: "/harbour/paper-trail/",
        destination:
          "https://wv-harbour-paper-trail.windedvertigo.workers.dev/harbour/paper-trail",
      },
      {
        source: "/harbour/paper-trail/:path*",
        destination:
          "https://wv-harbour-paper-trail.windedvertigo.workers.dev/harbour/paper-trail/:path*",
      },

      // mirror log
      {
        source: "/harbour/mirror-log",
        destination:
          "https://wv-harbour-mirror-log.windedvertigo.workers.dev/harbour/mirror-log",
      },
      {
        source: "/harbour/mirror-log/",
        destination:
          "https://wv-harbour-mirror-log.windedvertigo.workers.dev/harbour/mirror-log",
      },
      {
        source: "/harbour/mirror-log/:path*",
        destination:
          "https://wv-harbour-mirror-log.windedvertigo.workers.dev/harbour/mirror-log/:path*",
      },

      // orbit lab
      {
        source: "/harbour/orbit-lab",
        destination:
          "https://wv-harbour-orbit-lab.windedvertigo.workers.dev/harbour/orbit-lab",
      },
      {
        source: "/harbour/orbit-lab/",
        destination:
          "https://wv-harbour-orbit-lab.windedvertigo.workers.dev/harbour/orbit-lab",
      },
      {
        source: "/harbour/orbit-lab/:path*",
        destination:
          "https://wv-harbour-orbit-lab.windedvertigo.workers.dev/harbour/orbit-lab/:path*",
      },

      // proof garden
      {
        source: "/harbour/proof-garden",
        destination:
          "https://wv-harbour-proof-garden.windedvertigo.workers.dev/harbour/proof-garden",
      },
      {
        source: "/harbour/proof-garden/",
        destination:
          "https://wv-harbour-proof-garden.windedvertigo.workers.dev/harbour/proof-garden",
      },
      {
        source: "/harbour/proof-garden/:path*",
        destination:
          "https://wv-harbour-proof-garden.windedvertigo.workers.dev/harbour/proof-garden/:path*",
      },

      // bias lens
      {
        source: "/harbour/bias-lens",
        destination:
          "https://wv-harbour-bias-lens.windedvertigo.workers.dev/harbour/bias-lens",
      },
      {
        source: "/harbour/bias-lens/",
        destination:
          "https://wv-harbour-bias-lens.windedvertigo.workers.dev/harbour/bias-lens",
      },
      {
        source: "/harbour/bias-lens/:path*",
        destination:
          "https://wv-harbour-bias-lens.windedvertigo.workers.dev/harbour/bias-lens/:path*",
      },

      // scale shift
      {
        source: "/harbour/scale-shift",
        destination:
          "https://wv-harbour-scale-shift.windedvertigo.workers.dev/harbour/scale-shift",
      },
      {
        source: "/harbour/scale-shift/",
        destination:
          "https://wv-harbour-scale-shift.windedvertigo.workers.dev/harbour/scale-shift",
      },
      {
        source: "/harbour/scale-shift/:path*",
        destination:
          "https://wv-harbour-scale-shift.windedvertigo.workers.dev/harbour/scale-shift/:path*",
      },

      // pattern weave
      {
        source: "/harbour/pattern-weave",
        destination:
          "https://wv-harbour-pattern-weave.windedvertigo.workers.dev/harbour/pattern-weave",
      },
      {
        source: "/harbour/pattern-weave/",
        destination:
          "https://wv-harbour-pattern-weave.windedvertigo.workers.dev/harbour/pattern-weave",
      },
      {
        source: "/harbour/pattern-weave/:path*",
        destination:
          "https://wv-harbour-pattern-weave.windedvertigo.workers.dev/harbour/pattern-weave/:path*",
      },

      // market mind
      {
        source: "/harbour/market-mind",
        destination:
          "https://wv-harbour-market-mind.windedvertigo.workers.dev/harbour/market-mind",
      },
      {
        source: "/harbour/market-mind/",
        destination:
          "https://wv-harbour-market-mind.windedvertigo.workers.dev/harbour/market-mind",
      },
      {
        source: "/harbour/market-mind/:path*",
        destination:
          "https://wv-harbour-market-mind.windedvertigo.workers.dev/harbour/market-mind/:path*",
      },

      // rhythm lab
      {
        source: "/harbour/rhythm-lab",
        destination:
          "https://wv-harbour-rhythm-lab.windedvertigo.workers.dev/harbour/rhythm-lab",
      },
      {
        source: "/harbour/rhythm-lab/",
        destination:
          "https://wv-harbour-rhythm-lab.windedvertigo.workers.dev/harbour/rhythm-lab",
      },
      {
        source: "/harbour/rhythm-lab/:path*",
        destination:
          "https://wv-harbour-rhythm-lab.windedvertigo.workers.dev/harbour/rhythm-lab/:path*",
      },

      // code weave
      {
        source: "/harbour/code-weave",
        destination:
          "https://wv-harbour-code-weave.windedvertigo.workers.dev/harbour/code-weave",
      },
      {
        source: "/harbour/code-weave/",
        destination:
          "https://wv-harbour-code-weave.windedvertigo.workers.dev/harbour/code-weave",
      },
      {
        source: "/harbour/code-weave/:path*",
        destination:
          "https://wv-harbour-code-weave.windedvertigo.workers.dev/harbour/code-weave/:path*",
      },

      // time prism
      {
        source: "/harbour/time-prism",
        destination:
          "https://wv-harbour-time-prism.windedvertigo.workers.dev/harbour/time-prism",
      },
      {
        source: "/harbour/time-prism/",
        destination:
          "https://wv-harbour-time-prism.windedvertigo.workers.dev/harbour/time-prism",
      },
      {
        source: "/harbour/time-prism/:path*",
        destination:
          "https://wv-harbour-time-prism.windedvertigo.workers.dev/harbour/time-prism/:path*",
      },

      // liminal pass
      {
        source: "/harbour/liminal-pass",
        destination:
          "https://wv-harbour-liminal-pass.windedvertigo.workers.dev/harbour/liminal-pass",
      },
      {
        source: "/harbour/liminal-pass/",
        destination:
          "https://wv-harbour-liminal-pass.windedvertigo.workers.dev/harbour/liminal-pass",
      },
      {
        source: "/harbour/liminal-pass/:path*",
        destination:
          "https://wv-harbour-liminal-pass.windedvertigo.workers.dev/harbour/liminal-pass/:path*",
      },

      // emerge box
      {
        source: "/harbour/emerge-box",
        destination:
          "https://wv-harbour-emerge-box.windedvertigo.workers.dev/harbour/emerge-box",
      },
      {
        source: "/harbour/emerge-box/",
        destination:
          "https://wv-harbour-emerge-box.windedvertigo.workers.dev/harbour/emerge-box",
      },
      {
        source: "/harbour/emerge-box/:path*",
        destination:
          "https://wv-harbour-emerge-box.windedvertigo.workers.dev/harbour/emerge-box/:path*",
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

      // rubric co-builder
      {
        source: "/harbour/rubric-co-builder",
        destination:
          "https://rubric-co-builder.vercel.app/harbour/rubric-co-builder",
      },
      {
        source: "/harbour/rubric-co-builder/",
        destination:
          "https://rubric-co-builder.vercel.app/harbour/rubric-co-builder",
      },
      {
        source: "/harbour/rubric-co-builder/:path*",
        destination:
          "https://rubric-co-builder.vercel.app/harbour/rubric-co-builder/:path*",
      },

      // values-auction (Vite app — no basePath, serves from root)
      // wordmark.svg uses root-relative /wordmark.svg, proxy it to the app origin
      {
        source: "/wordmark.svg",
        destination: "https://values-auction-pi.vercel.app/wordmark.svg",
      },
      {
        source: "/harbour/values-auction",
        destination: "https://values-auction-pi.vercel.app/",
      },
      {
        source: "/harbour/values-auction/",
        destination: "https://values-auction-pi.vercel.app/",
      },
      {
        source: "/harbour/values-auction/:path*",
        destination: "https://values-auction-pi.vercel.app/:path*",
      },

      // cuts catalogue
      {
        source: "/harbour/cuts-catalogue",
        destination: "https://cuts-catalogue.vercel.app/",
      },
      {
        source: "/harbour/cuts-catalogue/",
        destination: "https://cuts-catalogue.vercel.app/",
      },
      {
        source: "/harbour/cuts-catalogue/:path*",
        destination: "https://cuts-catalogue.vercel.app/:path*",
      },

      // feel cards
      {
        source: "/harbour/feel-cards",
        destination: "https://feel-cards.vercel.app/",
      },
      {
        source: "/harbour/feel-cards/",
        destination: "https://feel-cards.vercel.app/",
      },
      {
        source: "/harbour/feel-cards/:path*",
        destination: "https://feel-cards.vercel.app/:path*",
      },

      // values auction
      {
        source: "/harbour/values-auction",
        destination:
          "https://values-auction-pi.vercel.app/harbour/values-auction",
      },
      {
        source: "/harbour/values-auction/",
        destination:
          "https://values-auction-pi.vercel.app/harbour/values-auction",
      },
      {
        source: "/harbour/values-auction/:path*",
        destination:
          "https://values-auction-pi.vercel.app/harbour/values-auction/:path*",
      },

      // harbour hub (catch-all — must be last)
      // NOTE: three-intelligence-workbook is a static HTML tool that lives at
      // /tools/three-intelligence-workbook/. Mounted via redirects() below
      // (NOT here) because OpenNext-on-CF's internal rewrite to a static
      // asset directory doesn't resolve cleanly — it 307s to the slash form
      // which the rewriter treats as the rewrite's final response.
      {
        source: "/harbour",
        destination:
          "https://wv-harbour-harbour.windedvertigo.workers.dev/harbour",
      },
      {
        source: "/harbour/",
        destination:
          "https://wv-harbour-harbour.windedvertigo.workers.dev/harbour",
      },
      {
        source: "/harbour/:path*",
        destination:
          "https://wv-harbour-harbour.windedvertigo.workers.dev/harbour/:path*",
      },
    ] };
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
      // whirlpool tools — redirect clean URLs to static HTML in public/
      {
        source: "/tools/the-mashup",
        destination: "/tools/the-mashup/index.html",
        permanent: false,
      },
      {
        source: "/tools/ppcs-launch",
        destination: "/tools/ppcs-launch/index.html",
        permanent: false,
      },
      // three-intelligence-workbook — static HTML tool. /harbour/* prefix
      // redirects to the static-tool URL since OpenNext-on-CF's internal
      // rewrite to a directory doesn't resolve cleanly. Same pattern as
      // /tools/the-mashup and /tools/writers-room above.
      {
        source: "/harbour/three-intelligence-workbook",
        destination: "/tools/three-intelligence-workbook/index.html",
        permanent: false,
      },
      {
        source: "/harbour/three-intelligence-workbook/",
        destination: "/tools/three-intelligence-workbook/index.html",
        permanent: false,
      },
      {
        source: "/tools/writers-room",
        destination: "/tools/writers-room/index.html",
        permanent: false,
      },
      // conference experience — redirect to static HTML in public/
      {
        source: "/portfolio/assets/pedal-conference-experience",
        destination: "/portfolio/assets/pedal-conference-experience/index.html",
        permanent: false,
      },
      // route restructure: /portfolio → /do, /do/explore → /quadrants/explore
      {
        source: "/portfolio",
        destination: "/do/",
        permanent: true,
      },
      {
        source: "/portfolio/conference-experience",
        destination: "/do/conference-experience/",
        permanent: true,
      },
      {
        source: "/do/explore",
        destination: "/quadrants/explore/",
        permanent: true,
      },
      // port (fka CRM) — redirect to its own domain
      {
        source: "/crm",
        destination: "https://port.windedvertigo.com",
        permanent: true,
      },
      {
        source: "/crm/:path*",
        destination: "https://port.windedvertigo.com/:path*",
        permanent: true,
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
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://unpkg.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.notion.com https://port.windedvertigo.com https://vitals.vercel-insights.com wss://*.partykit.dev wss://*.partykit.io https://script.google.com https://script.googleusercontent.com https://*.windedvertigo.workers.dev wss://*.windedvertigo.workers.dev",
              "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
              "frame-ancestors 'none'",
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
