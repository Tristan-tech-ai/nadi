import type { Metadata } from "next";
import { KerangkaAuth } from "@/components/auth/kerangka-auth";
import { FormStaf } from "./form-staf";

export const metadata: Metadata = { title: "Masuk staf" };

export default function MasukStaf() {
  return (
    <KerangkaAuth isi={(t) => ({ judul: t.stafJudul, sub: t.stafSub, badan: <FormStaf teks={t} /> })} />
  );
}
