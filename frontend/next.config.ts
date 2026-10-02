import type { NextConfig } from "next";

const gateway = (process.env.GATEWAY_URL || "http://localhost:8000").replace(/\/$/, "");
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${gateway}/:path*` }];
  },
};
export default config;
