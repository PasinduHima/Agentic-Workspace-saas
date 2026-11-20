import type { NextConfig } from "next";

// Baseline headers for every route. A Content-Security-Policy isn't set yet: tldraw, Clerk,
// Supabase Realtime and the tldraw sync server each need allowances that should be tuned and
// tested on their own.
const securityHeaders = [
  // Nothing should frame the app (clickjacking on the workspace and share pages).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Share links carry their token in the path, so don't send full URLs to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The mic button uses speech recognition; nothing else needs device access.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  images: {
    // Avatars on workspace cards are Clerk profile images.
    remotePatterns: [new URL("https://img.clerk.com/**")],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
