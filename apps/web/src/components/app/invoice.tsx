"use client";

import { useActionState, useState, useTransition } from "react";
import { aturBayar, batalkanInvoice, buatInvoice, catatPengingat, cocokkanMutasi, lunasDariMutasi, tandaiLunas, type HasilCocok, type HasilInvoice } from "@/app/app/invoice/actions";
import { formatTanggalKalender } from "@/lib/format";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { uraiQris } from "@/lib/invoice/qris";
import { totalBaris } from "@/lib/invoice/tagihan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type TF = Kamus["invoiceForm"];

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilInvoice }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

/** Baca isi QR dari foto stiker QRIS di peramban (jsQR dimuat hanya saat dibutuhkan). */
async function bacaQrDariFoto(berkas: File): Promise<string | null> {
  const gambar = await createImageBitmap(berkas);
  const skala = Math.min(1, 1200 / Math.max(gambar.width, gambar.height));
  const w = Math.round(gambar.width * skala);
  const t = Math.round(gambar.height * skala);
  const kanvas = document.createElement("canvas");
  kanvas.width = w;
  kanvas.height = t;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(gambar, 0, 0, w, t);
  const { default: jsQR } = await import("jsqr");
  return jsQR(ctx.getImageData(0, 0, w, t).data, w, t)?.data ?? null;
}

/** Tujuan bayar: QRIS statis pemilik (dibaca dari foto, tidak diubah) dan rekening transfer. Hanya pemilik. */
export function FormBayar({ awal, teks: t }: { awal: { qris: string | null; qris_nama: string | null; rekening: string | null }; teks: TF }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(aturBayar, null);
  const [qris, setQris] = useState(awal.qris ?? "");
  const [baca, setBaca] = useState<{ ok: boolean; teks: string } | null>(awal.qris_nama ? { ok: true, teks: isiTeks(t.qrisSekarang, { nama: awal.qris_nama }) } : null);
  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBaca({ ok: true, teks: t.membacaQr });
    const isi = await bacaQrDariFoto(f).catch(() => null);
    if (!isi) {
      setBaca({ ok: false, teks: t.qrGagal });
      return;
    }
    const r = uraiQris(isi);
    if (!r.ok) {
      setBaca({ ok: false, teks: r.galat });
      return;
    }
    setQris(isi);
    setBaca({ ok: true, teks: isiTeks(t.terbaca, { nama: `${r.nama}${r.kota ? `, ${r.kota}` : ""}${r.nmid ? ` (NMID ${r.nmid})` : ""}` }) });
  }
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label={t.tujuanAria}>
      <input type="hidden" name="qris" value={qris} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.fotoQris}</span>
        <input type="file" accept="image/*" onChange={pilih} className="text-sm" data-testid="foto-qris" /></label>
      {baca && <p className={`text-sm ${baca.ok ? "text-tinta-2" : "text-cap"}`} data-testid="baca-qris" aria-live="polite">{baca.teks}</p>}
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.rekening}</span>
        <input name="rekening" defaultValue={awal.rekening ?? ""} maxLength={200} placeholder={t.rekeningContoh} className={isian} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpanTujuan}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

type Baris = { uraian: string; jumlah: string; harga: string };
const kosong = (): Baris => ({ uraian: "", jumlah: "1", harga: "" });
const angka = (b: Baris) => ({ uraian: b.uraian, jumlah: Number(b.jumlah.replace(",", ".")) || 0, harga: Number(b.harga.replace(/[^\d]/g, "")) || 0 });

function IsiInvoice({ awal, besok, hariIni, kunci, sibuk, t, bahasa }: { awal: Record<string, string>; besok: string; hariIni: string; kunci: string; sibuk: boolean; t: TF; bahasa: Bahasa }) {
  const n = Number(awal.n ?? 0);
  const [baris, setBaris] = useState<Baris[]>(n > 0 ? Array.from({ length: n }, (_, i) => ({ uraian: awal[`uraian.${i}`] ?? "", jumlah: awal[`jumlah.${i}`] ?? "1", harga: awal[`harga.${i}`] ?? "" })) : [kosong()]);
  const ubah = (i: number, k: keyof Baris, v: string) => setBaris((s) => s.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const total = totalBaris(baris.map(angka));
  return (
    <>
      <input type="hidden" name="kunci" value={awal.kunci ?? kunci} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.pelanggan}</span>
        <input name="pelanggan" required maxLength={100} defaultValue={awal.pelanggan ?? ""} placeholder={t.pelangganContoh} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.waPelanggan}</span>
        <input name="hp" type="tel" inputMode="tel" maxLength={20} defaultValue={awal.hp ?? ""} placeholder="0812 3456 7890" className={isian} /></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-tinta-2">{t.barang}</legend>
        <ul className="mt-1 grid gap-2">
          {baris.map((b, i) => (
            <li key={i} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-end gap-2 border-b border-garis pb-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_auto] sm:border-0 sm:pb-0" data-testid="baris-invoice">
              <label className="col-span-3 flex flex-col gap-1 sm:col-span-1"><span className="text-xs text-tinta-2 sm:sr-only">{t.uraian}</span>
                <input name="uraian" value={b.uraian} onChange={(e) => ubah(i, "uraian", e.target.value)} maxLength={120} placeholder={t.uraianContoh} aria-label={isiTeks(t.uraianAria, { n: i + 1 })} className={`${isian} w-full min-w-0`} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs text-tinta-2 sm:sr-only">{t.jumlah}</span>
                <input name="jumlah" value={b.jumlah} onChange={(e) => ubah(i, "jumlah", e.target.value)} inputMode="decimal" aria-label={isiTeks(t.jumlahAria, { n: i + 1 })} className={`${isian} angka w-full min-w-0 text-right`} /></label>
              <label className="flex min-w-0 flex-col gap-1"><span className="text-xs text-tinta-2 sm:sr-only">{t.harga}</span>
                <input name="harga" value={b.harga} onChange={(e) => ubah(i, "harga", e.target.value)} inputMode="numeric" placeholder="25.000" aria-label={isiTeks(t.hargaAria, { n: i + 1 })} className={`${isian} angka w-full min-w-0 text-right`} /></label>
              <button type="button" onClick={() => setBaris((s) => s.filter((_, j) => j !== i))} disabled={baris.length === 1}
                className="h-10 px-1 text-sm text-tinta-2 underline underline-offset-4 disabled:invisible" aria-label={isiTeks(t.hapusAria, { n: i + 1 })}>{t.hapus}</button>
            </li>
          ))}
        </ul>
        {baris.length < 30 && <button type="button" onClick={() => setBaris((s) => [...s, kosong()])} className="mt-2 text-sm underline underline-offset-4">{t.tambahBaris}</button>}
      </fieldset>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.jatuhTempo}</span>
        <input type="date" name="jatuh_tempo" required min={hariIni} defaultValue={awal.jatuh_tempo ?? besok} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.catatan}</span>
        <input name="catatan" maxLength={300} defaultValue={awal.catatan ?? ""} placeholder={t.catatanContoh} className={isian} /></label>
      <p className="sm:col-span-2 text-base font-semibold" data-testid="total-invoice">{t.total} <Rupiah nilai={total} bahasa={bahasa} /></p>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? t.menerbitkan : t.terbitkan}</Tombol>
      </div>
    </>
  );
}

/** Invoice baru: langsung terbit bernomor. Isian dikembalikan saat galat; formulir kosong lagi setelah berhasil. */
export function FormInvoice({ kunci, jatuhTempo, hariIni, teks: t, bahasa = "id" }: { kunci: string; jatuhTempo: string; hariIni: string; teks: TF; bahasa?: Bahasa }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(buatInvoice, null);
  const awal = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.baruAria}>
      <IsiInvoice key={JSON.stringify(h)} awal={awal} besok={jatuhTempo} hariIni={hariIni} kunci={kunci} sibuk={sibuk} t={t} bahasa={bahasa} />
      <div className="sm:col-span-2"><Hasil h={h} /></div>
    </form>
  );
}

export function FormLunas({ invoice, hariIni, label, teks: t }: { invoice: string; hariIni: string; label: string; teks: TF }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(tandaiLunas, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={isiTeks(t.lunasAria, { label })}>
      <input type="hidden" name="invoice" value={invoice} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.dibayarLewat}</span>
        <select name="cara" defaultValue="qris" className={isian}>
          <option value="qris">QRIS</option><option value="transfer">{t.transfer}</option><option value="tunai">{t.tunai}</option>
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tanggalBayar}</span>
        <input type="date" name="tanggal" defaultValue={hariIni} max={hariIni} className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.mencatat : t.tandaiLunas}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalInvoice({ invoice, label, teks: t }: { invoice: string; label: string; teks: TF }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(batalkanInvoice, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.batalJudul}</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={isiTeks(t.batalAria, { label })}>
        <input type="hidden" name="invoice" value={invoice} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.alasan}</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder={t.alasanContoh} className={isian} /></label>
        <Tombol type="submit" ragam="bahaya" disabled={sibuk}>{t.batalkan}</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}

/** Buka wa.me berisi pesan pengingat; Nadi hanya mencatat bahwa pemilik membukanya (pesan dikirim pemilik sendiri). */
export function TombolPengingat({ id, href, label }: { id: string; href: string; label: string }) {
  const [, mulai] = useTransition();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => mulai(() => catatPengingat(id))}
      className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold hover:bg-kertas-2" data-testid="kirim-pengingat">
      {label}
    </a>
  );
}

/** Pilih manual saat pencocok ragu: catat lunas invoice ini dengan tanggal mutasi. */
function PilihKandidat({ invoice, nomor, pelanggan, tanggal, t }: { invoice: string; nomor: string; pelanggan: string; tanggal: string; t: TF }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(tandaiLunas, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="invoice" value={invoice} />
      <input type="hidden" name="cara" value="transfer" />
      <input type="hidden" name="tanggal" value={tanggal} />
      <button type="submit" disabled={sibuk} className="text-sm underline underline-offset-4">{isiTeks(t.iniUntuk, { nomor, pelanggan })}</button>
      <Hasil h={h} />
    </form>
  );
}

/** F4-06: unggah CSV mutasi, lihat yang cocok beserta alasannya, lunasi dengan satu tombol. */
export function CocokMutasi({ teks: t, bahasa = "id" }: { teks: TF; bahasa?: Bahasa }) {
  // Keterangan mutasi dan alasan cocok disusun pencocok dalam bahasa Indonesia: di bahasa lain ditandai lang="id".
  const isiLang = bahasa === "id" ? undefined : "id";
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const [csv, setCsv] = useState("");
  const [h, aksi, sibuk] = useActionState<HasilCocok, FormData>(cocokkanMutasi, null);
  const [l, aksiLunas, sibukLunas] = useActionState<HasilCocok, FormData>(lunasDariMutasi, null);
  const r = h && "cocok" in h ? h : null;
  const selesai = l && "selesai" in l ? l : null;
  return (
    <div className="mt-3 text-sm">
      <form action={aksi} className="flex flex-wrap items-end gap-3" aria-label={t.cocokAria}>
        <input type="hidden" name="csv" value={csv} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.csv}</span>
          <input type="file" accept=".csv,text/csv" onChange={async (e) => setCsv((await e.target.files?.[0]?.text()) ?? "")} data-testid="csv-mutasi" /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk || !csv}>{sibuk ? t.mencocokkan : t.cocokkan}</Tombol>
        {h && "galat" in h && <p role="alert" className="text-cap">{h.galat}</p>}
      </form>
      {r && !selesai && (
        <div className="mt-3" data-testid="hasil-cocok">
          <p>{isiTeks(t.hasilBaca, { kredit: r.kredit, n: r.cocok.length })}</p>
          {r.cocok.length > 0 && (
            <>
              <ul className="mt-2 divide-y divide-garis border-y border-garis">
                {r.cocok.map((c) => (
                  <li key={c.invoice} className="py-2" data-testid="baris-cocok">
                    <p><span className="font-mono text-xs">{c.nomor}</span> <span data-pengguna>{c.pelanggan}</span>: <Rupiah nilai={c.jumlah} bahasa={bahasa} />{isiTeks(t.masuk, { tanggal: tgl(c.tanggal) })}</p>
                    <p className="text-tinta-2"><span data-pengguna>{c.keterangan}</span>. {t.dasar} <span lang={isiLang}>{c.alasan}</span>.</p>
                  </li>
                ))}
              </ul>
              <form action={aksiLunas} className="mt-2">
                <input type="hidden" name="daftar" value={JSON.stringify(r.cocok.map((c) => ({ invoice: c.invoice, nomor: c.nomor, tanggal: c.tanggal })))} />
                <Tombol type="submit" ragam="kedua" disabled={sibukLunas}>{sibukLunas ? t.mencatat : isiTeks(t.lunasN, { n: r.cocok.length })}</Tombol>
              </form>
            </>
          )}
          {r.ragu.length > 0 && (
            <div className="mt-3" data-testid="cocok-ragu">
              <p className="font-semibold">{t.perluPilih}</p>
              {r.ragu.map((g, i) => (
                <div key={i} className="mt-2 border-t border-garis pt-2">
                  <p><Rupiah nilai={g.jumlah} bahasa={bahasa} />{isiTeks(t.masuk, { tanggal: tgl(g.tanggal) })}: <span data-pengguna>{g.keterangan}</span>. {t.ragu}</p>
                  {g.kandidat.map((k) => <PilihKandidat key={k.id} invoice={k.id} nomor={k.nomor} pelanggan={k.pelanggan} tanggal={g.tanggal} t={t} />)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {selesai && (
        <div className="mt-3" data-testid="hasil-lunas-mutasi">
          <p role="status" className="text-daun">{selesai.selesai}</p>
          {selesai.gagal.length > 0 && <ul className="mt-1 list-disc pl-5 text-cap">{selesai.gagal.map((g) => <li key={g}>{g}</li>)}</ul>}
        </div>
      )}
      {l && "galat" in l && <p role="alert" className="mt-2 text-cap">{l.galat}</p>}
    </div>
  );
}
