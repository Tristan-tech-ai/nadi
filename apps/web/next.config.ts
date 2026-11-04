import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gerbang loop membangun ke folder terpisah (NEXT_DIST_DIR=.next-gate) agar tidak menimpa build lokal untuk e2e.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  cacheComponents: true,
  // Q-20: penanda uji cek wajah selalu terdefinisi saat build ("0" kecuali build lokal e2e menyetel 1), sehingga cabang uji di
  // cek-wajah.tsx dihapus minifier di produksi (docs bawaan Next 05-config/01-next-config-js/env.md). Vercel tidak pernah menyetelnya.
  env: { NEXT_PUBLIC_NADI_UJI_WAJAH: process.env.NEXT_PUBLIC_NADI_UJI_WAJAH === "1" ? "1" : "0" },
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
      // F2-03: hanya halaman lamar yang boleh memakai mikrofon (rekaman wawancara suara). Header yang sama di aturan
      // berikutnya menimpa aturan umum di atas (docs bawaan Next 05-config/01-next-config-js/headers.md).
      // F3-07C: orang yang berhenti merekam penjelasan Rekam Ilmu di /app/ilmu.
      // M-12: halaman absen staf boleh membaca lokasi HP untuk geofence tempat absen.
      { source: "/absen", headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" }] },
      { source: "/app/ilmu", headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" }] },
      { source: "/lamar/:kode", headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" }] },
      { source: "/sw.js", headers: [{ key: "Content-Type", value: "application/javascript; charset=utf-8" }, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }] },
    ];
  },
  partialPrefetching: true,
  // F3-01: tombol Mulai/Tunggu/Selesai staf saat luring diantre dan dikirim ulang otomatis saat sinyal kembali; useOffline()
  // dari next/offline menampilkan tanda luring (docs bawaan Next 05-config/01-next-config-js/useOffline.md).
  experimental: { useOffline: true },
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
