import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed for the Docker image. Instead of requiring the whole node_modules
  // tree at runtime, Next traces which files the server actually reaches and
  // emits a self-contained bundle with its own server.js. That turns a
  // multi-hundred-megabyte image into a small one.
  //
  // It does NOT include public/ or .next/static — the Dockerfile copies those
  // in separately. That omission is by design, and forgetting it is why a
  // containerised Next app sometimes serves pages with no CSS.
  output: "standalone",

  async rewrites() {
    return [
      { source: "/login", destination: "/auth/login" },
      { source: "/register", destination: "/auth/register" },
    ];
  },
};

export default nextConfig;
