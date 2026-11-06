import type { Metadata } from "next";
import { HalamanDemo } from "@/components/demo/halaman-demo";

export const metadata: Metadata = {
  title: "Coba Nadi tanpa daftar",
  description: "Lihat Feed Keputusan Nadi di usaha contoh: warung makan dan toko grosir dengan data karangan.",
};

export default function DemoWarung({ searchParams }: PageProps<"/demo">) {
  return <HalamanDemo kunci="fnb" galat={searchParams.then((sp) => (typeof sp.galat === "string" ? sp.galat : undefined))} />;
}
