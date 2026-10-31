import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gerbang loop membangun ke folder terpisah (NEXT_DIST_DIR=.next-gate) agar tidak menimpa build lokal untuk e2e.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  // Header keamanan untuk service worker (docs bawaan Next 02-guides/progressive-web-apps.md).
  async headers() {
    return [
      // Q-01: halaman tidak boleh dimuat dalam iframe (clickjacking halaman izin OAuth, Setujui di Feed). CSP sengaja tanpa
      // script-src/form-action: MediaPipe dari jsDelivr dan pengalihan izin OAuth ke redirect_uri klien harus tetap jalan
      // (docs bawaan Next 02-guides/content-security-policy.md, "Without Nonces").
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Content-Type", value: "application/javascript; charset=utf-8" }, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }] },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
