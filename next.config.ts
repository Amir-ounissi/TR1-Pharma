import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  env: {
    TR1_HUBSPOT_MODE:
      process.env.VERCEL_ENV === "production"
        ? "write"
        : process.env.TR1_HUBSPOT_MODE ?? "dry_run",
    TR1_HUBSPOT_WRITE_ENABLED:
      process.env.VERCEL_ENV === "production"
        ? "true"
        : process.env.TR1_HUBSPOT_WRITE_ENABLED ?? "false",
  },
  typescript: {
    ignoreBuildErrors: process.env.E2E_SKIP_TYPECHECK === "true",
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
