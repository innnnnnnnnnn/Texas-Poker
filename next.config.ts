import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Texas-Poker',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
