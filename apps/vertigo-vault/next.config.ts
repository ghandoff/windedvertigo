import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images from Notion's S3 bucket
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "www.notion.so" },
    ],
  },
};

export default nextConfig;
