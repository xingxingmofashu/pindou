import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  env: {
    // Build-time epoch, inlined into the client bundle. Every `next build`
    // produces a fresh value, so the persisted SWR cache only stays valid
    // within one deployment generation — data changes (db:migrate, palette
    // reorders) ship with a new build and invalidate it automatically.
    NEXT_PUBLIC_BUILD_TIME: String(Date.now()),
  },
  experimental: {
    // Lets server components read the `[lang]` route segment via `next/root-params`.
    rootParams: true,
  },
};

export default nextConfig;
