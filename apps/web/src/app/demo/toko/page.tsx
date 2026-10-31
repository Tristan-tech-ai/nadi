import type { Metadata } from "next";
import { HalamanDemo } from "@/components/demo/halaman-demo";

export const metadata: Metadata = {
  title: "Coba Nadi: toko grosir contoh",
  description: "Lihat Feed Keputusan Nadi di toko grosir contoh dengan data karangan.",
};

export default function DemoToko() {
  return <HalamanDemo kunci="toko" />;
}
