import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Halaman yang baru dikunjungi tampil seketika saat dibuka lagi (mis. pindah-pindah tab di HP).
    // Data berubah lewat aksi server atau router.refresh(), yang otomatis mengosongkan cache ini.
    staleTimes: { dynamic: 20, static: 180 },
  },
};

export default nextConfig;
