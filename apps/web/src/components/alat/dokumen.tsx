"use client";

import { useState } from "react";
import { CSS_CETAK } from "@/components/alat/cetak";
import { susunSurat, tanggalPanjang, type JenisSurat } from "@/lib/surat/kalimat";

// L-13 templat dokumen kerja tanpa akun (setara dokumen HR Talenta). Tiga jenis memakai susunSurat yang sama dengan Surat
// keluar di aplikasi; tiga lainnya ditulis di sini tanpa angka aturan. Semua di peramban, dicetak lewat dialog cetak.
type Jenis = JenisSurat | "peringatan" | "izin" | "serah";
export const JENIS_DOKUMEN: { id: Jenis; judul: string }[] = [
  { id: "keterangan_kerja", judul: "Surat keterangan kerja" },
  { id: "surat_tugas", judul: "Surat tugas" },
  { id: "sk_mutasi", judul: "Surat keputusan mutasi" },
  { id: "peringatan", judul: "Surat peringatan" },
  { id: "izin", judul: "Formulir izin atau cuti" },
  { id: "serah", judul: "Berita acara serah terima" },
];

const isian = "mt-1 h-11 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

export function susunDokumen(jenis: Jenis, d: { usaha: string; nama: string; tujuan: string; keperluan: string; mulai: string; lama: number; tingkat: string; alasan: string; penerima: string }) {
  if (jenis === "keterangan_kerja" || jenis === "surat_tugas" || jenis === "sk_mutasi")
    return susunSurat(jenis, { usaha: d.usaha, nama: d.nama, tujuan: d.tujuan, keperluan: d.keperluan, mulai: d.mulai || null, lamaHari: d.lama });
  if (jenis === "peringatan") return { judul: `Surat peringatan ${d.tingkat}`, isi: [
    `Pimpinan ${d.usaha} memberikan surat peringatan ${d.tingkat} kepada Saudara ${d.nama} karena ${d.alasan || "pelanggaran aturan kerja"}.`,
    "Saudara diminta memperbaiki hal tersebut. Bila pelanggaran yang sama terulang, usaha dapat memberikan peringatan berikutnya sesuai peraturan perusahaan atau perjanjian kerja.",
    "Saudara berhak memberikan penjelasan tertulis atas surat peringatan ini.",
  ] };
  if (jenis === "izin") return { judul: "Formulir izin atau cuti", isi: [
    `Nama: ${d.nama}. Usaha: ${d.usaha}.`,
    `Jenis: ${d.keperluan || "izin"}. Mulai ${d.mulai ? tanggalPanjang(d.mulai) : "-"}, selama ${d.lama} hari.`,
    `Alasan: ${d.alasan || "-"}.`,
    "Disetujui atau ditolak oleh atasan, dengan tanda tangan dan tanggal di bawah.",
  ] };
  return { judul: "Berita acara serah terima", isi: [
    `Pada ${d.mulai ? tanggalPanjang(d.mulai) : "tanggal di bawah"}, Saudara ${d.nama} menyerahkan kepada Saudara ${d.penerima || "-"} di ${d.usaha}: ${d.keperluan || "barang atau pekerjaan berikut"}.`,
    "Penerima telah memeriksa dan menerima yang diserahkan dalam keadaan seperti tertulis di atas.",
    "Berita acara ini dibuat rangkap dua dan ditandatangani kedua pihak.",
  ] };
}

export function PembuatDokumen({ hariIni }: { hariIni: string }) {
  const [jenis, setJenis] = useState<Jenis>("keterangan_kerja");
  const [d, setD] = useState({ usaha: "Toko Sari Jaya", kota: "Denpasar", nama: "Rina Lestari", tujuan: "Cabang Renon", keperluan: "", mulai: hariIni, lama: 1, tingkat: "pertama", alasan: "", penerima: "" });
  const ubah = (k: keyof typeof d, v: string | number) => setD({ ...d, [k]: v });
  const s = susunDokumen(jenis, d);
  const pakai = { tujuan: jenis === "surat_tugas" || jenis === "sk_mutasi", keperluan: jenis === "surat_tugas" || jenis === "izin" || jenis === "serah", lama: jenis === "surat_tugas" || jenis === "izin", tingkat: jenis === "peringatan", alasan: jenis === "peringatan" || jenis === "izin", penerima: jenis === "serah" };
  const label = { keperluan: jenis === "izin" ? "Jenis izin (sakit, cuti, keperluan keluarga)" : jenis === "serah" ? "Yang diserahkan" : "Keperluan tugas", alasan: jenis === "peringatan" ? "Pelanggaran" : "Alasan" };
  return (
    <div className="grid gap-8 lg:grid-cols-2" data-testid="pembuat-dokumen">
      <style>{CSS_CETAK}</style>
      <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Isian dokumen">
        <label className="text-sm font-semibold">Jenis dokumen
          <select value={jenis} onChange={(e) => setJenis(e.target.value as Jenis)} className={isian}>{JENIS_DOKUMEN.map((j) => <option key={j.id} value={j.id}>{j.judul}</option>)}</select>
        </label>
        <label className="text-sm font-semibold">Nama usaha<input value={d.usaha} onChange={(e) => ubah("usaha", e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">Kota<input value={d.kota} onChange={(e) => ubah("kota", e.target.value)} className={isian} /></label>
        <label className="text-sm font-semibold">Nama karyawan<input value={d.nama} onChange={(e) => ubah("nama", e.target.value)} className={isian} /></label>
        {pakai.tujuan ? <label className="text-sm font-semibold">Tujuan atau tempat baru<input value={d.tujuan} onChange={(e) => ubah("tujuan", e.target.value)} className={isian} /></label> : null}
        {pakai.keperluan ? <label className="text-sm font-semibold">{label.keperluan}<input value={d.keperluan} onChange={(e) => ubah("keperluan", e.target.value)} className={isian} /></label> : null}
        <label className="text-sm font-semibold">{jenis === "keterangan_kerja" ? "Mulai bekerja" : "Tanggal"}<input type="date" value={d.mulai} onChange={(e) => ubah("mulai", e.target.value)} className={isian} /></label>
        {pakai.lama ? <label className="text-sm font-semibold">Lama (hari)<input type="number" min={1} max={60} value={d.lama} onChange={(e) => ubah("lama", Math.max(1, Number(e.target.value) || 1))} className={isian} /></label> : null}
        {pakai.tingkat ? <label className="text-sm font-semibold">Tingkat<select value={d.tingkat} onChange={(e) => ubah("tingkat", e.target.value)} className={isian}>{["pertama", "kedua", "ketiga"].map((x) => <option key={x}>{x}</option>)}</select></label> : null}
        {pakai.alasan ? <label className="text-sm font-semibold">{label.alasan}<input value={d.alasan} onChange={(e) => ubah("alasan", e.target.value)} className={isian} /></label> : null}
        {pakai.penerima ? <label className="text-sm font-semibold">Penerima<input value={d.penerima} onChange={(e) => ubah("penerima", e.target.value)} className={isian} /></label> : null}
        <button type="button" onClick={() => window.print()} className="mt-2 h-12 justify-self-start rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">Cetak atau simpan PDF</button>
      </form>
      <article id="lembar-cetak" className="rounded-[var(--radius-kartu)] border border-garis bg-kertas p-6" aria-label="Pratinjau dokumen" data-testid="pratinjau-dokumen">
        <p className="text-center font-bold uppercase">{d.usaha}</p>
        <h2 className="mt-4 text-center text-lg font-bold">{s.judul}</h2>
        <div className="mt-4 grid gap-3">{s.isi.map((p) => <p key={p}>{p}</p>)}</div>
        <p className="mt-8 text-right">{d.kota}, {tanggalPanjang(hariIni)}</p>
        <div className="mt-16 flex justify-between gap-8 text-sm">
          <p className="border-t border-tinta pt-1">{jenis === "serah" ? "Yang menyerahkan" : jenis === "izin" ? "Pemohon" : "Pimpinan"}</p>
          <p className="border-t border-tinta pt-1">{jenis === "serah" ? "Penerima" : jenis === "izin" ? "Atasan" : "Yang bersangkutan"}</p>
        </div>
      </article>
    </div>
  );
}
