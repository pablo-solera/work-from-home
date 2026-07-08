import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION,
  // oracledb ships native binaries; keep it external so Next.js does not bundle
  // it and it is loaded from node_modules at runtime (thick mode for Oracle 11g).
  serverExternalPackages: ["oracledb"],
};

export default nextConfig;
