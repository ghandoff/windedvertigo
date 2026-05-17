import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/harbour/rubric-co-builder",
  reactStrictMode: true,
  poweredByHeader: false,
  // headers() is intentionally omitted — OpenNext-on-CF does not honour
  // next.config.ts headers(). Security headers are injected via worker.ts
  // using @windedvertigo/security instead.
};

export default nextConfig;
