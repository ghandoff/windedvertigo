import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/harbour/vertigo-vault",
  poweredByHeader: false,
  // Required by OpenNext/CF Workers — produces .next/standalone for bundling.
  output: "standalone",
  transpilePackages: ["@windedvertigo/tokens", "@windedvertigo/auth", "@windedvertigo/stripe", "@windedvertigo/feedback"],

  // Required for Auth.js v5 on CF Workers: trusts the X-Forwarded-Host header
  // that CF's edge sets so that AUTH_URL doesn't need to match exactly.
  env: {
    AUTH_TRUST_HOST: process.env.CF_WORKERS_ENV ? "true" : (process.env.AUTH_TRUST_HOST ?? ""),
  },

  /**
   * Security headers — non-CSP headers live here as static config.
   * CSP is set per-request in proxy.ts with a nonce so we can
   * use `'strict-dynamic'` instead of `'unsafe-inline'` in script-src.
   */
  // Prevent @aws-sdk packages from being code-split into hashed webpack
  // chunks (e.g. "@aws-sdk/client-s3-6e8156e6832c031e") that OpenNext's
  // esbuild bundler cannot resolve. Marking them as webpack externals leaves
  // a plain require("@aws-sdk/client-s3") that esbuild CAN resolve from
  // standalone/node_modules and bundle into the CF Workers output.
  webpack: (config) => {
    config.externals = [
      ...((config.externals as unknown[]) ?? []),
      {
        "@aws-sdk/client-s3": "commonjs @aws-sdk/client-s3",
        "@aws-sdk/s3-request-presigner": "commonjs @aws-sdk/s3-request-presigner",
      },
    ];
    return config;
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
        ],
      },
    ];
  },
};

export default nextConfig;
