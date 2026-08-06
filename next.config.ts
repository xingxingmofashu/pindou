import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  experimental: {
    // Lets server components read the `[lang]` route segment via `next/root-params`.
    rootParams: true,
  },
};

export default nextConfig;
