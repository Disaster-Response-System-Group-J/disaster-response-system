import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone", // lightweight dockerization -dehan
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/socket.io", destination: "http://j3-event-bridge:3001/socket.io" },
        { source: "/socket.io/:path*", destination: "http://j3-event-bridge:3001/socket.io/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
