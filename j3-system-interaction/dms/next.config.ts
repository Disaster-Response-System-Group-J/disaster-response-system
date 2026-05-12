import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone", // lightweight dockerization -dehan
  async rewrites() {
    const eventBridgeUrl = process.env.EVENT_BRIDGE_URL ?? 'http://localhost:3001';
    return {
      beforeFiles: [
        { source: "/socket.io", destination: `${eventBridgeUrl}/socket.io` },
        { source: "/socket.io/:path*", destination: `${eventBridgeUrl}/socket.io/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
