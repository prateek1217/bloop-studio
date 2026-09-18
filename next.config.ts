import type { NextConfig } from "next";

// The Go auth backend (see backend/) runs as its own process on GO_BACKEND_URL
// (default http://localhost:8080). Proxying it through a rewrite instead of
// calling it directly from the browser keeps everything same-origin, so the
// backend's httpOnly session cookie works without any CORS configuration.
const GO_BACKEND_URL = process.env.GO_BACKEND_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/go/:path*",
        destination: `${GO_BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
