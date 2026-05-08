import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // lightweight dockerization -dehan
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
