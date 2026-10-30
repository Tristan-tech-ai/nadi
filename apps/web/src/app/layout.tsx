import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans (Tokotype, OFL): huruf antarmuka. Bricolage Grotesque (OFL): judul besar. IBM Plex Mono (OFL): nomor dokumen.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["600", "800"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap", weight: ["400", "500"] });

export const metadata: Metadata = {
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
    <html lang="id" className={`${jakarta.variable} ${bricolage.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
