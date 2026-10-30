import type { Metadata } from "next";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { FormStaf } from "./form-staf";

export const metadata: Metadata = { title: "Masuk staf" };

export default function MasukStaf() {
  return (
    <KerangkaAuth judul="Masuk staf" sub="Pakai kode usaha, ID, dan PIN dari pemilik. Tidak perlu email.">
      <FormStaf />
    </KerangkaAuth>
  );
}
