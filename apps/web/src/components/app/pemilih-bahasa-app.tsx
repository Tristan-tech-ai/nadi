"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { aturBahasa } from "@/app/bahasa-actions";
import type { Bahasa } from "@/lib/i18n/bahasa";

/** Pemilih bahasa di kepala aplikasi; pilihan disimpan ke akun pengguna (berlaku di semua perangkatnya). */
export function PemilihBahasaApp({ bahasa }: { bahasa: Bahasa }) {
  const router = useRouter();
  const [menunggu, mulai] = useTransition();
  const tujuan: Bahasa = bahasa === "id" ? "en" : "id";
  return (
    <button
      type="button"
      lang={tujuan}
      disabled={menunggu}
      data-testid="pemilih-bahasa-app"
      onClick={() => mulai(async () => { await aturBahasa(tujuan); router.refresh(); })}
      className="text-sm text-tinta-2 underline-offset-4 hover:underline disabled:opacity-60"
    >
      {tujuan === "en" ? "English" : "Bahasa Indonesia"}
    </button>
  );
}
