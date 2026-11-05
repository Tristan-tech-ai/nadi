"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { putuskan, type HasilPutusan } from "@/app/app/actions";
import { useCatatPutusan } from "@/components/app/halaman-feed";
import { Cap, type JenisCap } from "@/components/ui/cap";
import { KartuUsulan, TEKS_KARTU_ID, type TeksKartu, type Usulan } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { Tombol } from "@/components/ui/tombol";
import { RincianUsulan } from "@/components/app/rincian-usulan";

/** Lama jendela Batalkan sebelum keputusan dikirim (D-12, NN/g: aksi berulang = batalkan yang mencolok, bukan dialog). */
export const JENDELA_BATAL_MS = 4000;

type Tertunda = { setuju: boolean; sampai: number; dikirim?: boolean };

/**
 * Kartu Feed Keputusan (D-12). Setujui/Tolak langsung mengecap kartu dan menyusutkannya jadi satu baris dengan tombol Batalkan;
 * keputusan baru dikirim setelah jendela habis. Kartu berikutnya naik ke tempat jempol yang sama dan mendapat fokus.
 * Tanpa JavaScript tetap berupa formulir biasa yang langsung mengirim.
 */
export function KartuFeed({ usulanId, usulan, teks = TEKS_KARTU_ID, cap, bahasa = "id" }: { usulanId: string; usulan: Usulan; teks?: TeksKartu; cap?: Partial<Record<JenisCap, string>>; bahasa?: Bahasa }) {
  const isiLang = bahasa === "id" ? undefined : "id";
  const [hasil, aksi, sibuk] = useActionState<HasilPutusan, FormData>(putuskan, {});
  const [tertunda, setTertunda] = useState<Tertunda | null>(null);
  const [sisa, setSisa] = useState(0);
  const catat = useCatatPutusan();
  const kartu = useRef<HTMLElement>(null);
  const dibatalkan = useRef(false);

  useEffect(() => {
    if (hasil.status) catat();
  }, [hasil.status, catat]);

  // Hitung mundur dan kirim saat jendela habis. Bila halaman ditinggal lebih dulu, keputusan dikirim saat itu juga.
  useEffect(() => {
    if (!tertunda || tertunda.dikirim) return;
    const fd = new FormData();
    fd.set("usulan", usulanId);
    fd.set("keputusan", tertunda.setuju ? "setuju" : "tolak");
    let terkirim = false;
    const kirim = () => {
      if (terkirim) return;
      terkirim = true;
      startTransition(() => aksi(fd));
    };
    const detak = setInterval(() => setSisa(Math.max(0, Math.ceil((tertunda.sampai - Date.now()) / 1000))), 250);
    const waktu = setTimeout(() => { kirim(); setTertunda({ ...tertunda, dikirim: true }); }, Math.max(0, tertunda.sampai - Date.now()));
    const pergi = () => { if (!terkirim) { terkirim = true; void putuskan({}, fd); } };
    window.addEventListener("pagehide", pergi);
    return () => {
      clearInterval(detak);
      clearTimeout(waktu);
      window.removeEventListener("pagehide", pergi);
      // Dilepas (pindah layar) atau diganti sebelum jendela habis: kirim sekarang, kecuali pengguna menekan Batalkan.
      if (!dibatalkan.current) pergi();
    };
  }, [tertunda, usulanId, aksi]);

  const mulai = (setuju: boolean, yTombol: number | null) => {
    dibatalkan.current = false;
    setTertunda({ setuju, sampai: Date.now() + JENDELA_BATAL_MS });
    setSisa(Math.ceil(JENDELA_BATAL_MS / 1000));
    // Jempol tetap di tempat: setelah kartu menyusut, halaman digeser agar tombol Setujui kartu berikutnya berada di
    // posisi tombol yang baru ditekan, lalu tombol itu mendapat fokus.
    const ini = kartu.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const berikut = ini?.nextElementSibling?.querySelector<HTMLButtonElement>("[data-aksi=setuju]");
      if (!berikut) return;
      if (yTombol !== null) {
        const geser = berikut.getBoundingClientRect().top - yTombol;
        if (Math.abs(geser) > 4) window.scrollBy({ top: geser, behavior: "instant" });
      }
      berikut.focus({ preventScroll: true });
    }));
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tombol = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const setujui = e.currentTarget.querySelector<HTMLButtonElement>("[data-aksi=setuju]");
    mulai(tombol?.value === "setuju", setujui ? setujui.getBoundingClientRect().top : null);
  };

  const batal = () => {
    dibatalkan.current = true;
    setTertunda(null);
  };

  // Galat dari server setelah dikirim: kartu penuh kembali dengan pesan galatnya, tombol bisa ditekan lagi.
  const gagalKirim = Boolean(tertunda?.dikirim && hasil.galat);
  if (hasil.status || (tertunda && !gagalKirim)) {
    const status = hasil.status ?? (tertunda?.setuju ? "diterima" : "ditolak");
    return (
      <div ref={(el) => { kartu.current = el; }}>
        <article className="flex min-h-14 items-center gap-3 rounded-[var(--radius-kartu)] border border-garis bg-kertas px-4 py-2 text-sm" data-testid="kartu-diputuskan" data-tersimpan={hasil.status ? "ya" : "tidak"}>
          <p role="status" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1" data-testid="hasil-putusan">
            <span className="cap-turun"><Cap jenis={status} label={cap?.[status]} /></span>
            <span className="min-w-0 truncate font-semibold" lang={isiLang}>{usulan.judul}</span>
            <span className="text-tinta-2">{hasil.pesan ?? (tertunda?.setuju ? teks.disetujui : teks.ditolak)}</span>
            {status === "diterima" && hasil.status && usulan.tujuan ? (
              <a href={usulan.tujuan.href} className="font-semibold text-tinta underline underline-offset-4" data-testid="lihat-hasil">
                {(teks.lihatDi ?? "Lihat di {x}").replace("{x}", usulan.tujuan.tempat)}
              </a>
            ) : null}
          </p>
          {tertunda && !tertunda.dikirim && !hasil.status ? (
            <button type="button" onClick={batal} className="shrink-0 rounded-[var(--radius-isian)] px-3 py-2 font-semibold underline underline-offset-4" data-testid="batalkan-putusan">
              {teks.batalkan} <span className="angka text-tinta-2">({sisa})</span>
            </button>
          ) : null}
        </article>
      </div>
    );
  }

  return (
    <div ref={(el) => { kartu.current = el; }}>
      <KartuUsulan
        usulan={usulan}
        teks={teks}
        bahasa={bahasa}
        isiLang={isiLang}
        rincian={<RincianUsulan usulanId={usulanId} bahasa={bahasa} />}
        aksi={
          <form action={aksi} onSubmit={onSubmit} className="flex w-full flex-col gap-2">
            <input type="hidden" name="usulan" value={usulanId} />
            <div className="flex gap-2">
              <Tombol type="submit" name="keputusan" value="setuju" ukuran="besar" className="flex-1" data-aksi="setuju" disabled={sibuk}>
                {teks.setujui}
              </Tombol>
              <Tombol type="submit" name="keputusan" value="tolak" ukuran="besar" ragam="kedua" disabled={sibuk}>
                {teks.tolak}
              </Tombol>
            </div>
            {hasil.galat ? <p role="alert" className="text-sm text-cap">{hasil.galat}</p> : null}
          </form>
        }
      />
    </div>
  );
}
