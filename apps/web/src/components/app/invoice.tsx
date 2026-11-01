"use client";

import { useActionState, useState, useTransition } from "react";
import { aturBayar, batalkanInvoice, buatInvoice, catatPengingat, tandaiLunas, type HasilInvoice } from "@/app/app/invoice/actions";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { uraiQris } from "@/lib/invoice/qris";
import { totalBaris } from "@/lib/invoice/tagihan";

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
export function FormBayar({ awal }: { awal: { qris: string | null; qris_nama: string | null; rekening: string | null } }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(aturBayar, null);
  const [qris, setQris] = useState(awal.qris ?? "");
  const [baca, setBaca] = useState<{ ok: boolean; teks: string } | null>(awal.qris_nama ? { ok: true, teks: `QRIS sekarang: ${awal.qris_nama}` } : null);
  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBaca({ ok: true, teks: "Membaca QR..." });
    const isi = await bacaQrDariFoto(f).catch(() => null);
    if (!isi) {
      setBaca({ ok: false, teks: "QR tidak terbaca. Foto stiker QRIS dari dekat, lurus, dan terang." });
      return;
    }
    const r = uraiQris(isi);
    if (!r.ok) {
      setBaca({ ok: false, teks: r.galat });
      return;
    }
    setQris(isi);
    setBaca({ ok: true, teks: `Terbaca: ${r.nama}${r.kota ? `, ${r.kota}` : ""}${r.nmid ? ` (NMID ${r.nmid})` : ""}. Simpan untuk memakainya.` });
  }
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label="Tujuan bayar">
      <input type="hidden" name="qris" value={qris} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Foto stiker QRIS usahamu</span>
        <input type="file" accept="image/*" onChange={pilih} className="text-sm" data-testid="foto-qris" /></label>
      {baca && <p className={`text-sm ${baca.ok ? "text-tinta-2" : "text-cap"}`} data-testid="baca-qris" aria-live="polite">{baca.teks}</p>}
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Rekening transfer (opsional)</span>
        <input name="rekening" defaultValue={awal.rekening ?? ""} maxLength={200} placeholder="BCA 1234567890 a.n. Warung Sari" className={isian} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan tujuan bayar"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

type Baris = { uraian: string; jumlah: string; harga: string };
const kosong = (): Baris => ({ uraian: "", jumlah: "1", harga: "" });
const angka = (b: Baris) => ({ uraian: b.uraian, jumlah: Number(b.jumlah.replace(",", ".")) || 0, harga: Number(b.harga.replace(/[^\d]/g, "")) || 0 });

function IsiInvoice({ awal, besok, hariIni, kunci, sibuk }: { awal: Record<string, string>; besok: string; hariIni: string; kunci: string; sibuk: boolean }) {
  const n = Number(awal.n ?? 0);
  const [baris, setBaris] = useState<Baris[]>(n > 0 ? Array.from({ length: n }, (_, i) => ({ uraian: awal[`uraian.${i}`] ?? "", jumlah: awal[`jumlah.${i}`] ?? "1", harga: awal[`harga.${i}`] ?? "" })) : [kosong()]);
  const ubah = (i: number, k: keyof Baris, v: string) => setBaris((s) => s.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const total = totalBaris(baris.map(angka));
  return (
    <>
      <input type="hidden" name="kunci" value={awal.kunci ?? kunci} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Pelanggan</span>
        <input name="pelanggan" required maxLength={100} defaultValue={awal.pelanggan ?? ""} placeholder="Bu Rina (arisan RT 03)" className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">WhatsApp pelanggan (opsional)</span>
        <input name="hp" type="tel" inputMode="tel" maxLength={20} defaultValue={awal.hp ?? ""} placeholder="0812 3456 7890" className={isian} /></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-tinta-2">Barang atau jasa</legend>
        <ul className="mt-1 grid gap-2">
          {baris.map((b, i) => (
            <li key={i} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-end gap-2 border-b border-garis pb-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_auto] sm:border-0 sm:pb-0" data-testid="baris-invoice">
              <label className="col-span-3 flex flex-col gap-1 sm:col-span-1"><span className="text-xs text-tinta-2 sm:sr-only">Uraian</span>
                <input name="uraian" value={b.uraian} onChange={(e) => ubah(i, "uraian", e.target.value)} maxLength={120} placeholder="Nasi kotak" aria-label={`Uraian baris ${i + 1}`} className={`${isian} w-full min-w-0`} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs text-tinta-2 sm:sr-only">Jumlah</span>
                <input name="jumlah" value={b.jumlah} onChange={(e) => ubah(i, "jumlah", e.target.value)} inputMode="decimal" aria-label={`Jumlah baris ${i + 1}`} className={`${isian} angka w-full min-w-0 text-right`} /></label>
              <label className="flex min-w-0 flex-col gap-1"><span className="text-xs text-tinta-2 sm:sr-only">Harga satuan</span>
                <input name="harga" value={b.harga} onChange={(e) => ubah(i, "harga", e.target.value)} inputMode="numeric" placeholder="25.000" aria-label={`Harga satuan baris ${i + 1}`} className={`${isian} angka w-full min-w-0 text-right`} /></label>
              <button type="button" onClick={() => setBaris((s) => s.filter((_, j) => j !== i))} disabled={baris.length === 1}
                className="h-10 px-1 text-sm text-tinta-2 underline underline-offset-4 disabled:invisible" aria-label={`Hapus baris ${i + 1}`}>Hapus</button>
            </li>
          ))}
        </ul>
        {baris.length < 30 && <button type="button" onClick={() => setBaris((s) => [...s, kosong()])} className="mt-2 text-sm underline underline-offset-4">Tambah baris</button>}
      </fieldset>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Jatuh tempo</span>
        <input type="date" name="jatuh_tempo" required min={hariIni} defaultValue={awal.jatuh_tempo ?? besok} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Catatan (opsional)</span>
        <input name="catatan" maxLength={300} defaultValue={awal.catatan ?? ""} placeholder="Pesanan arisan 12 Nov" className={isian} /></label>
      <p className="sm:col-span-2 text-base font-semibold" data-testid="total-invoice">Total <Rupiah nilai={total} /></p>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="utama" disabled={sibuk}>{sibuk ? "Menerbitkan..." : "Terbitkan invoice"}</Tombol>
      </div>
    </>
  );
}

/** Invoice baru: langsung terbit bernomor. Isian dikembalikan saat galat; formulir kosong lagi setelah berhasil. */
export function FormInvoice({ kunci, jatuhTempo, hariIni }: { kunci: string; jatuhTempo: string; hariIni: string }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(buatInvoice, null);
  const awal = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label="Invoice baru">
      <IsiInvoice key={JSON.stringify(h)} awal={awal} besok={jatuhTempo} hariIni={hariIni} kunci={kunci} sibuk={sibuk} />
      <div className="sm:col-span-2"><Hasil h={h} /></div>
    </form>
  );
}

export function FormLunas({ invoice, hariIni, label }: { invoice: string; hariIni: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(tandaiLunas, null);
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={`Tandai lunas ${label}`}>
      <input type="hidden" name="invoice" value={invoice} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Dibayar lewat</span>
        <select name="cara" defaultValue="qris" className={isian}>
          <option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="tunai">Tunai</option>
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Tanggal bayar</span>
        <input type="date" name="tanggal" defaultValue={hariIni} max={hariIni} className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Mencatat..." : "Tandai lunas"}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalInvoice({ invoice, label }: { invoice: string; label: string }) {
  const [h, aksi, sibuk] = useActionState<HasilInvoice, FormData>(batalkanInvoice, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">Batalkan invoice</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label={`Batalkan ${label}`}>
        <input type="hidden" name="invoice" value={invoice} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">Alasan</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder="Pesanan dibatalkan pelanggan" className={isian} /></label>
        <Tombol type="submit" ragam="bahaya" disabled={sibuk}>Batalkan</Tombol>
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
