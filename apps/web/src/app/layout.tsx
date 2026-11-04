import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Bricolage_Grotesque, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { DaftarSw } from "@/components/app/daftar-sw";
import "./globals.css";

// Plus Jakarta Sans (Tokotype, OFL): huruf antarmuka dan teks. Big Shoulders (OFL): judul permukaan Persuade (landing, halaman fitur;
// docs/design/DESIGN.md). Bricolage Grotesque (OFL): judul aplikasi. IBM Plex Mono (OFL): nomor dokumen. Dua yang terakhir tidak
// dipramuat agar landing hanya mengunduh dua keluarga huruf.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const papan = Big_Shoulders({ subsets: ["latin"], variable: "--font-big-shoulders", display: "swap", axes: ["opsz"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["600", "800"], preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500"], preload: false });

// Dasar URL metadata (canonical, hreflang): domain produksi proyek dari env sistem Vercel saat build, lokal bila tidak ada.
const DASAR_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(DASAR_URL),
  title: "Nadi",
  description: "Denyut usahamu, terasa dan tercatat.",
};

export const viewport: Viewport = {
  // slop-ok: themeColor butuh nilai literal; sama dengan token --kertas terang dan gelap.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F2EA" }, // slop-ok: token kertas
    { media: "(prefers-color-scheme: dark)", color: "#141311" }, // slop-ok: token kertas gelap
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${papan.variable} ${bricolage.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <DaftarSw />
      </body>
    </html>
  );
}
