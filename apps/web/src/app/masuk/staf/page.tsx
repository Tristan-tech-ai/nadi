import type { Metadata } from "next";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { PilihMasuk } from "@/components/auth/pilih-masuk";
import { FormStaf } from "./form-staf";

export const metadata: Metadata = { title: "Masuk staf" };

export default function MasukStaf() {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.stafJudul, sub: t.stafSub, badan: <><PilihMasuk aktif="staf" teks={t} /><FormStaf teks={t} /></> })} />
  );
}
