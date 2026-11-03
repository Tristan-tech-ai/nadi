import type { Metadata } from "next";
import { HalamanBagian } from "@/components/landing/halaman-bagian";
import { kamusId } from "@/lib/i18n/kamus/id";

export const metadata: Metadata = {
  title: kamusId.privasiHalaman.metaJudul,
  description: kamusId.privasiHalaman.metaDeskripsi,
  alternates: { canonical: "/privasi", languages: { id: "/privasi", en: "/en/privasi" } },
};

export default function Privasi() {
  return <HalamanBagian bahasa="id" isi={kamusId.privasiHalaman} />;
}
