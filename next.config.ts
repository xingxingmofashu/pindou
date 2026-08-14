import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * `ANALYZE=true pnpm build` writes bundle analysis reports to `.next/analyze`.
 * Uses `createRequire` so the config stays CJS-compatible (Next transpiles
 * `next.config.ts` to CommonJS — top-level await is not allowed).
 */
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

/** Allow `next/image` to optimize thumbnails served from the R2 public host. */
function r2ImageHosts(): Array<{ protocol: "https"; hostname: string }> {
  const url = process.env.NEXT_R2_PUBLIC_URL;
  if (!url) return [];
  try {
    return [{ protocol: "https", hostname: new URL(url).hostname }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  images: {
    remotePatterns: r2ImageHosts(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            // Baseline CSP. `unsafe-inline` for script/style is required by
            // Next's RSC payload + inline styles; tighten later with nonces.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "worker-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // The service worker must never be cached by the browser: an old
        // cached script would keep the app on stale assets indefinitely.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
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

export default withBundleAnalyzer(nextConfig);
