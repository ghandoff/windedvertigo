import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/reservoir/vertigo-vault",

  // Images from Notion's S3 bucket — cached 24h to survive signed URL expiry (~1hr)
  images: {
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "www.notion.so" },
    ],
  },
};

export default nextConfig;
