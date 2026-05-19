import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/harbour/rubric-co-builder-companion",
  reactStrictMode: true,
  poweredByHeader: false,
  // Security headers are injected via worker.ts using @windedvertigo/security.
};

export default nextConfig;
