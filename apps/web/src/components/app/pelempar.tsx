"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CameraIcon, CheckCircleIcon, FileArrowUpIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Tombol } from "@/components/ui/tombol";
import { bacaBerkasAksi } from "@/app/app/lempar/actions";
import { KUALITAS_FOTO, lemparBerkas, mimeBerkas, ukuranKompres, type HasilLempar } from "@/lib/lempar";
import { bacaTeksFoto, perluOcr } from "@/lib/ocr";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Baris = { kunci: string; nama: string; tahap: "siap" | "unggah" | "baca" | "selesai"; hasil?: HasilLempar };

const TERIMA = "image/*,application/pdf,.pdf,.xlsx,.csv,text/csv";

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

function Status({ b }: { b: Baris }) {
  if (b.tahap === "siap" || b.tahap === "unggah") return <span className="text-tinta-2">Mengunggah...</span>;
  if (b.tahap === "baca") return <span className="text-tinta-2">Nadi sedang membaca...</span>;
  const h = b.hasil!;
  if (h.status === "usulan")
    return (
      <span className="inline-flex items-start gap-1.5 text-daun">
        <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <span>Siap disetujui: {h.judul ?? "usulan baru"}</span>
      </span>
    );
  if (h.status === "galat")
    return (
      <span className="inline-flex items-start gap-1.5 text-cap">
        <WarningCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
        <span>{h.pesan}</span>
      </span>
    );
  return <span className="text-tinta-2">{h.status === "sudah" ? h.pesan : "Terunggah."}</span>;
}

export function Pelempar({ antre = [] }: { antre?: string[] }) {
  const [baris, setBaris] = useState<Baris[]>([]);
  const [seret, setSeret] = useState(false);
  const kamera = useRef<HTMLInputElement>(null);
  const pilih = useRef<HTMLInputElement>(null);
  const antreDiproses = useRef(false);

  const ubah = (kunci: string, b: Partial<Baris>) => setBaris((x) => x.map((r) => (r.kunci === kunci ? { ...r, ...b } : r)));

  // Kiriman dari menu Bagikan sudah terunggah di server; tinggal dibaca.
  useEffect(() => {
    if (!antre.length || antreDiproses.current) return;
    antreDiproses.current = true;
    setBaris(antre.map((id, i) => ({ kunci: id, nama: `Kiriman ${i + 1}`, tahap: "baca" })));
    antre.forEach(async (id) => ubah(id, { tahap: "selesai", hasil: await bacaBerkasAksi(id) }));
  }, [antre]);

  async function lempar(daftar: FileList | File[]) {
    const sb = createBrowserSupabase();
    const baru = Array.from(daftar).map((f, i) => ({ f, kunci: `${Date.now()}-${i}-${f.name}` }));
    setBaris((x) => [...baru.map(({ f, kunci }) => ({ kunci, nama: f.name, tahap: "siap" as const })), ...x]);
    await Promise.all(
      baru.map(async ({ f, kunci }) => {
        let siap;
        try {
          siap = await siapkan(f);
        } catch (e) {
          const pesan = e instanceof Error && e.message === "jenis"
            ? "Jenis berkas ini belum bisa dibaca. Kirim foto, PDF, Excel, atau CSV."
            : "Foto ini belum bisa dibuka di browser ini. Ubah kamera ke format JPG, atau kirim lewat menu Bagikan.";
          ubah(kunci, { tahap: "selesai", hasil: { status: "galat", pesan } });
          return;
        }
        ubah(kunci, { tahap: "unggah" });
        const daftarHasil = await lemparBerkas(sb, siap, { baca: false });
        if (daftarHasil.status !== "diunggah") return ubah(kunci, { tahap: "selesai", hasil: daftarHasil });
        ubah(kunci, { tahap: "baca" });
        // Foto: baca teksnya di perangkat dulu, supaya tata letak yang sudah dikenal bisa dibaca tanpa AI.
        if (perluOcr(siap.mime)) {
          const ocr = await bacaTeksFoto(new Blob([siap.isi], { type: siap.mime }));
          if (ocr) await sb.rpc("simpan_ocr", { p_berkas: daftarHasil.berkasId, p_teks: ocr.teks, p_keyakinan: ocr.keyakinan });
        }
        ubah(kunci, { tahap: "selesai", hasil: await bacaBerkasAksi(daftarHasil.berkasId) });
      }),
    );
  }

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
            Foto berkas
          </Tombol>
          <Tombol ukuran="besar" ragam="kedua" onClick={() => pilih.current?.click()}>
            <FileArrowUpIcon size={22} aria-hidden />
            Pilih berkas
          </Tombol>
        </div>
        <p className="mt-3 text-sm text-tinta-2">Foto, PDF, Excel, atau CSV, maksimal 10 MB per berkas. Di komputer, seret berkas ke kotak ini.</p>
        <input ref={kamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.length && lempar(e.target.files)} />
        <input ref={pilih} type="file" accept={TERIMA} multiple className="sr-only" tabIndex={-1} aria-label="Pilih berkas untuk dilempar" data-testid="input-berkas" onChange={(e) => e.target.files?.length && lempar(e.target.files)} />
      </div>

      {baris.length ? (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" aria-live="polite" data-testid="daftar-lempar">
          {baris.map((b) => (
            <li key={b.kunci} className="py-3" data-tahap={b.tahap} data-status={b.hasil?.status}>
              <p className="truncate text-sm font-semibold">{b.nama}</p>
              <p className="mt-0.5 text-sm">
                <Status b={b} />
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {adaUsulan ? (
        <Link href="/app" className="mt-4 inline-block font-semibold underline underline-offset-4" data-testid="ke-feed">
          Buka Feed untuk menyetujui
        </Link>
      ) : null}
    </div>
  );
}
