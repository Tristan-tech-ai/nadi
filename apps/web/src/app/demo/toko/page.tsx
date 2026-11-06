import type { Metadata } from "next";
import { HalamanDemo } from "@/components/demo/halaman-demo";

export const metadata: Metadata = {
  title: "Coba Nadi: toko grosir contoh",
  description: "Lihat Feed Keputusan Nadi di toko grosir contoh dengan data karangan.",
};

export default function DemoToko({ searchParams }: PageProps<"/demo/toko">) {
  return <HalamanDemo kunci="toko" galat={searchParams.then((sp) => (typeof sp.galat === "string" ? sp.galat : undefined))} />;
}
