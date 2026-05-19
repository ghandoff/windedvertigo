import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // URL slug uses hyphens; display name is "co.rubric companion".
  // Old /harbour/rubric-co-builder-companion 308-redirects to this path.
  basePath: "/harbour/co-rubric-companion",
  reactStrictMode: true,
  poweredByHeader: false,
  // Security headers are injected via worker.ts using @windedvertigo/security.
};

export default nextConfig;
