import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/reservoir",
  transpilePackages: ["@windedvertigo/tokens"],
};

export default nextConfig;
