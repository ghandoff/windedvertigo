import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // URL slug uses hyphens (co-rubric); display name uses the lowercase
  // dot (co.rubric) — same convention as winded.vertigo → windedvertigo.com.
  // Old path /harbour/rubric-co-builder 308-redirects to /harbour/co-rubric
  // via site/next.config.ts so existing room links keep working.
  basePath: "/harbour/co-rubric",
  reactStrictMode: true,
  poweredByHeader: false,
  // headers() is intentionally omitted — OpenNext-on-CF does not honour
  // next.config.ts headers(). Security headers are injected via worker.ts
  // using @windedvertigo/security instead.
};

export default nextConfig;
