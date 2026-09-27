import { resolve } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  outputFileTracingIncludes: {
    "/api/chat/**": ["./drizzle/*.sql"]
  },
  transpilePackages: ["@lobehub/icons"]
};

export default nextConfig;
