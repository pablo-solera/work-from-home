import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION,
  // oracledb ships native binaries; keep it external so Next.js does not bundle
  // it and it is loaded from node_modules at runtime (thick mode for Oracle 11g).
  serverExternalPackages: ["oracledb"],
  // The oracledb native .node binary is loaded dynamically at runtime, so
  // Next.js' output file tracing doesn't detect it and excludes it from the
  // standalone build. Force-include it so `oracledb` works in the Docker image.
  outputFileTracingIncludes: {
    "/*": ["node_modules/oracledb/build/Release/*.node"],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
