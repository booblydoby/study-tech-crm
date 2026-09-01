import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@study-crm/shared"],
  allowedDevOrigins: ["*.trycloudflare.com"]
};

export default nextConfig;
