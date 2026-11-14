import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Avatars on workspace cards are Clerk profile images.
    remotePatterns: [new URL("https://img.clerk.com/**")],
  },
};

export default nextConfig;
