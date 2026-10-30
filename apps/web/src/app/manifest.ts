import type { MetadataRoute } from "next";

// Manifest PWA. share_target: dari menu Bagikan di HP (mis. foto nota di WhatsApp) langsung ke Lempar Saja.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Nadi",
    short_name: "Nadi",
    description: "Denyut usahamu, terasa dan tercatat.",
    lang: "id",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F6F2EA", // slop-ok: token kertas
    theme_color: "#F6F2EA", // slop-ok: token kertas
    icons: [
      { src: "/ikon/ikon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikon/ikon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/ikon/ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/app/lempar/terima",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "judul", text: "teks", url: "tautan", files: [{ name: "berkas", accept: ["image/*", "application/pdf", ".xlsx", ".csv", "text/csv"] }] },
    },
  } as MetadataRoute.Manifest;
}
