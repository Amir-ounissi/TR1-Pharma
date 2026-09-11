import type { NextConfig } from "next";

const isProduction = process.env.VERCEL_ENV === "production";
const hubSpotWriteReady = isProduction && Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  env: {
    TR1_HUBSPOT_MODE: isProduction
      ? hubSpotWriteReady
        ? "write"
        : "dry_run"
      : process.env.TR1_HUBSPOT_MODE ?? "dry_run",
    TR1_HUBSPOT_WRITE_ENABLED: isProduction
      ? hubSpotWriteReady
        ? "true"
        : "false"
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
