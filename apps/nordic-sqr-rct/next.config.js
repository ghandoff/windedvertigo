const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: 'standalone',
  // Turbopack root — set to the monorepo root so Turbopack's security sandbox
  // includes the hoisted node_modules at the workspace root, where `next` lives.
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  // Wave 7.2 Phase 2 — URL reorganization redirect shims.
  // SQR-RCT reviewer routes moved under /reviews/*.
  // PCS research routes will move under /research/pcs/* in Phase 2b.
  // All legacy paths 301-redirect to their new canonical homes. These
  // redirects run before middleware, so external bookmarks and old hrefs
  // keep working regardless of whether internal refs have been updated.
  async redirects() {
    return [
      // PCS research surface (Phase 2b)
      { source: '/pcs', destination: '/research/pcs', permanent: true },
      { source: '/pcs/:path*', destination: '/research/pcs/:path*', permanent: true },
      // SQR-RCT surface — reviewer routes
      { source: '/dashboard', destination: '/reviews/dashboard', permanent: true },
      { source: '/dashboard/:path*', destination: '/reviews/dashboard/:path*', permanent: true },
      { source: '/intake', destination: '/reviews/intake', permanent: true },
      { source: '/intake/:path*', destination: '/reviews/intake/:path*', permanent: true },
      { source: '/score', destination: '/reviews/score', permanent: true },
      { source: '/score/:path*', destination: '/reviews/score/:path*', permanent: true },
      { source: '/credibility', destination: '/reviews/credibility', permanent: true },
      { source: '/credibility/:path*', destination: '/reviews/credibility/:path*', permanent: true },
      { source: '/network', destination: '/reviews/network', permanent: true },
      { source: '/network/:path*', destination: '/reviews/network/:path*', permanent: true },
      { source: '/profile', destination: '/reviews/profile', permanent: true },
      { source: '/profile/:path*', destination: '/reviews/profile/:path*', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // static.cloudflareinsights.com hosts the Web Analytics beacon
              // CF auto-injects into HTML responses on the wv-nordic worker
              // since the F.5 cutover. Without this allowance the beacon is
              // blocked and every page load surfaces a CSP violation.
              "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://cloudflareinsights.com",
              "frame-src 'none'",
              "worker-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
