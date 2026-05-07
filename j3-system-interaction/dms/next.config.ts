import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // lightweight dockerization -dehan
  eslint: {
    ignoreDuringBuilds: true, // lint runs as a dedicated CI step with continue-on-error
  },
};

export default nextConfig;
