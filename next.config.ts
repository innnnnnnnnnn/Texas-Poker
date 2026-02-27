import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/texas',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
