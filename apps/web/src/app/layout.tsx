import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
