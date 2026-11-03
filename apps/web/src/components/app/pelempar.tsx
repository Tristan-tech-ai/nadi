"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowClockwiseIcon, CameraIcon, CheckCircleIcon, FileArrowUpIcon, WarningCircleIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";
import { KartuFeed } from "@/components/app/kartu-feed";
import type { JenisCap } from "@/components/ui/cap";
import type { TeksKartu } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import type { Kamus } from "@/lib/i18n/kamus";
import { Tombol } from "@/components/ui/tombol";
import { bacaBerkasAksi } from "@/app/app/lempar/actions";
import { KUALITAS_FOTO, lemparBerkas, mimeBerkas, ukuranKompres, type HasilLempar } from "@/lib/lempar";
import { tahapLempar, type TahapLempar } from "@/lib/lempar-tahap";
import { bacaTeksFoto, perluOcr } from "@/lib/ocr";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { sisip } from "@/lib/i18n/sisip";

// Lempar Saja (D-13): setiap berkas berjalan lewat empat langkah yang terlihat, usulan hasilnya langsung bisa diputuskan di sini,
// berkas yang gagal terkirim karena sinyal ditahan di halaman ini dan dikirim lagi otomatis begitu sinyal kembali.
type Baris = { kunci: string; nama: string; tahap: TahapLempar; hasil?: HasilLempar };

const TERIMA = "image/*,application/pdf,.pdf,.xlsx,.csv,text/csv";
const URUT = ["siap", "unggah", "baca", "selesai"] as const;

/** Teks layar Lempar dari kamus, dikirim halaman server lewat prop (kamus tidak masuk bundel klien). */
export type TeksPelempar = { ui: Kamus["lempar"]; pesan: Kamus["lemparPesan"]; kartu: TeksKartu; cap: Partial<Record<JenisCap, string>>; sumber: string };

/** Foto besar diperkecil dan diubah ke JPEG di HP sebelum diunggah: hemat kuota dan tetap terbaca. */
async function siapkanFoto(f: File): Promise<{ isi: ArrayBuffer; nama: string; mime: string }> {
  const bitmap = await createImageBitmap(f);
  const { lebar, tinggi } = ukuranKompres(bitmap.width, bitmap.height);
  const kanvas = document.createElement("canvas");
  kanvas.width = lebar;
  kanvas.height = tinggi;
  kanvas.getContext("2d")!.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, gagal) => kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error("kompres"))), "image/jpeg", KUALITAS_FOTO));
  return { isi: await blob.arrayBuffer(), nama: f.name.replace(/\.\w+$/, "") + ".jpg", mime: "image/jpeg" };
}

async function siapkan(f: File) {
  const mime = mimeBerkas(f.name, f.type);
  const perluKompres = f.type.startsWith("image/") && (!mime || f.size > 1_500_000);
  if (perluKompres) return siapkanFoto(f);
  if (!mime) throw new Error("jenis");
  return { isi: await f.arrayBuffer(), nama: f.name, mime };
}

/** Langkah kecil di bawah nama berkas: teks + tanda, bukan warna saja. */
function Langkah({ tahap, t }: { tahap: TahapLempar; t: Kamus["lempar"] }) {
  if (tahap === "luring") return null;
  const ke = URUT.indexOf(tahap);
  return (
    <ol className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label={t.langkahLabel}>
      {URUT.map((tahapIni) => ({ tahap: tahapIni, label: t.langkah[tahapIni] })).map((l, i) => {
        const lewat = i < ke || tahap === "selesai";
        const kini = i === ke && tahap !== "selesai";
        return (
          <li key={l.tahap} className={`inline-flex items-center gap-1 ${lewat ? "text-tinta" : kini ? "font-semibold text-tinta" : "text-tinta-2"}`} aria-current={kini ? "step" : undefined}>
            <span aria-hidden className={`inline-block size-2 rounded-full ${lewat ? "bg-daun" : kini ? "denyut bg-kunyit" : "bg-garis-kuat"}`} />
            {l.label}
          </li>
        );
      })}
    </ol>
  );
}

function Status({ b, ulangi, t, isiLang }: { b: Baris; ulangi: (kunci: string) => void; t: Kamus["lempar"]; isiLang?: string }) {
  if (b.tahap === "luring")
    return (
      <span className="inline-flex items-start gap-1.5 text-tinta">
        <WifiSlashIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
        <span>{t.luring}</span>
      </span>
    );
  if (b.tahap !== "selesai") return <span className="text-tinta-2">{b.tahap === "baca" ? t.membaca : t.mengirim}</span>;
  const h = b.hasil!;
  if (h.status === "usulan")
    return (
      <span className="inline-flex items-start gap-1.5 text-daun">
        <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <span>{sisip(t.siapDisetujui, { judul: h.judul ? <span lang={isiLang}>{h.judul}</span> : t.usulanBaru })}{h.usulan ? "" : t.diFeed}</span>
      </span>
    );
  if (h.status === "galat")
    return (
      <span className="flex flex-wrap items-start gap-x-3 gap-y-2 text-cap">
        <span className="inline-flex items-start gap-1.5">
          <WarningCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          <span>{h.pesan}</span>
        </span>
        {h.kode !== "jenis" ? (
          <button type="button" onClick={() => ulangi(b.kunci)} className="inline-flex items-center gap-1 font-semibold text-tinta underline underline-offset-4" data-testid="coba-lagi">
            <ArrowClockwiseIcon size={16} aria-hidden /> {t.cobaLagi}
          </button>
        ) : null}
      </span>
    );
  return <span className="text-tinta-2">{h.status === "sudah" ? h.pesan : t.terunggah}</span>;
}

export function Pelempar({ antre = [], teks, bahasa = "id" }: { antre?: string[]; teks: TeksPelempar; bahasa?: Bahasa }) {
  const t = teks.ui;
  const isiLang = bahasa === "id" ? undefined : "id";
  const [baris, setBaris] = useState<Baris[]>([]);
  const [seret, setSeret] = useState(false);
  const kamera = useRef<HTMLInputElement>(null);
  const pilih = useRef<HTMLInputElement>(null);
  const antreDiproses = useRef(false);
  const berkasAsli = useRef(new Map<string, File>());
  const barisRef = useRef<Baris[]>([]);
  useEffect(() => {
    barisRef.current = baris;
  }, [baris]);

  const ubah = useCallback((kunci: string, b: Partial<Baris>) => setBaris((x) => x.map((r) => (r.kunci === kunci ? { ...r, ...b } : r))), []);

  // Kiriman dari menu Bagikan sudah terunggah di server; tinggal dibaca.
  useEffect(() => {
    if (!antre.length || antreDiproses.current) return;
    antreDiproses.current = true;
    setBaris(antre.map((id, i) => ({ kunci: id, nama: isiTeks(t.kiriman, { n: i + 1 }), tahap: "baca" })));
    antre.forEach(async (id) => ubah(id, { tahap: "selesai", hasil: await bacaBerkasAksi(id) }));
  }, [antre, ubah, t.kiriman]);

  const proses = useCallback(async (kunci: string, f: File) => {
    ubah(kunci, { tahap: "siap", hasil: undefined });
    let siap;
    try {
      siap = await siapkan(f);
    } catch (e) {
      const jenis = e instanceof Error && e.message === "jenis";
      ubah(kunci, { tahap: "selesai", hasil: jenis ? { status: "galat", pesan: teks.pesan.jenis, kode: "jenis" } : { status: "galat", pesan: t.galatFoto } });
      return;
    }
    if (!navigator.onLine) return ubah(kunci, { tahap: "luring" });
    ubah(kunci, { tahap: "unggah" });
    const sb = createBrowserSupabase();
    const daftarHasil = await lemparBerkas(sb, siap, { baca: false, teks: teks.pesan });
    if (daftarHasil.status === "galat" && !navigator.onLine) return ubah(kunci, { tahap: "luring" });
    if (daftarHasil.status !== "diunggah") return ubah(kunci, { tahap: "selesai", hasil: daftarHasil });
    ubah(kunci, { tahap: "baca" });
    // Foto: baca teksnya di perangkat dulu, supaya tata letak yang sudah dikenal bisa dibaca tanpa AI.
    if (perluOcr(siap.mime)) {
      const ocr = await bacaTeksFoto(new Blob([siap.isi], { type: siap.mime }));
      if (ocr) await sb.rpc("simpan_ocr", { p_berkas: daftarHasil.berkasId, p_teks: ocr.teks, p_keyakinan: ocr.keyakinan });
    }
    const hasil = await bacaBerkasAksi(daftarHasil.berkasId);
    ubah(kunci, { tahap: "selesai", hasil });
    // Usulan siap: bawa kartunya ke layar supaya tombol Setujui langsung terjangkau tanpa menggulir.
    if (hasil.status === "usulan" && hasil.usulan)
      requestAnimationFrame(() => document.querySelector(`[data-kunci="${CSS.escape(kunci)}"] [data-testid=usulan-lempar]`)?.scrollIntoView({ block: "nearest" }));
  }, [ubah, teks.pesan, t.galatFoto]);

  async function lempar(daftar: FileList | File[]) {
    const baru = Array.from(daftar).map((f, i) => ({ f, kunci: `${Date.now()}-${i}-${f.name}` }));
    for (const { f, kunci } of baru) berkasAsli.current.set(kunci, f);
    setBaris((x) => [...baru.map(({ f, kunci }) => ({ kunci, nama: f.name, tahap: "siap" as const })), ...x]);
    await Promise.all(baru.map(({ f, kunci }) => proses(kunci, f)));
  }

  const ulangi = (kunci: string) => {
    const f = berkasAsli.current.get(kunci);
    if (f) void proses(kunci, f);
  };

  // Sinyal kembali: kirim lagi semua yang tertahan.
  useEffect(() => {
    const kembali = () => {
      for (const b of barisRef.current) if (tahapLempar(b.tahap).tertahan) { const f = berkasAsli.current.get(b.kunci); if (f) void proses(b.kunci, f); }
    };
    window.addEventListener("online", kembali);
    return () => window.removeEventListener("online", kembali);
  }, [proses]);

  const adaUsulan = baris.some((b) => b.hasil?.status === "usulan");

  return (
    <div>
      <div
        className={`mt-6 rounded-[var(--radius-kartu)] border-2 border-dashed p-5 transition-[background-color,border-color] duration-150 ${seret ? "border-tinta bg-kertas-2" : "border-garis-kuat"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setSeret(true);
        }}
        onDragLeave={() => setSeret(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSeret(false);
          if (e.dataTransfer.files.length) lempar(e.dataTransfer.files);
        }}
        data-testid="area-lempar"
      >
        <div className="flex flex-wrap gap-3">
          <Tombol ukuran="besar" onClick={() => kamera.current?.click()}>
            <CameraIcon size={22} aria-hidden />
            {t.fotoBerkas}
          </Tombol>
          <Tombol ukuran="besar" ragam="kedua" onClick={() => pilih.current?.click()}>
            <FileArrowUpIcon size={22} aria-hidden />
            {t.pilihBerkas}
          </Tombol>
        </div>
        <p className="mt-3 text-sm text-tinta-2">{t.petunjuk}</p>
        <input ref={kamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.length && lempar(e.target.files)} />
        <input ref={pilih} type="file" accept={TERIMA} multiple className="sr-only" tabIndex={-1} aria-label={t.inputLabel} data-testid="input-berkas" onChange={(e) => e.target.files?.length && lempar(e.target.files)} />
      </div>

      {baris.length ? (
        <ul className="mt-6 space-y-4" aria-live="polite" data-testid="daftar-lempar">
          {baris.map((b) => (
            <li key={b.kunci} className="border-b border-garis pb-4" data-kunci={b.kunci} data-tahap={b.tahap} data-status={b.hasil?.status}>
              <p className="truncate text-sm font-semibold">{b.nama}</p>
              <Langkah tahap={b.tahap} t={t} />
              <p className="mt-1.5 text-sm">
                <Status b={b} ulangi={ulangi} t={t} isiLang={isiLang} />
              </p>
              {b.hasil?.status === "usulan" && b.hasil.usulan ? (
                <div className="mt-3" data-testid="usulan-lempar">
                  <KartuFeed
                    usulanId={b.hasil.usulan.id}
                    teks={teks.kartu}
                    cap={teks.cap}
                    bahasa={bahasa}
                    usulan={{ judul: b.hasil.usulan.judul, penjelasan: b.hasil.usulan.penjelasan, sumber: teks.sumber, keyakinan: b.hasil.usulan.keyakinan, dampakRp: b.hasil.usulan.dampakRp }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {adaUsulan ? (
        <Link href="/app" className="mt-4 inline-block font-semibold underline underline-offset-4" data-testid="ke-feed">
          {t.keFeed}
        </Link>
      ) : null}
    </div>
  );
}
