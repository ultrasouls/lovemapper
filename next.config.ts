import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Suppress the middleware deprecation warning (Next.js 16 migration)
  // We'll migrate to proxy when it's stable
};

export default nextConfig;
