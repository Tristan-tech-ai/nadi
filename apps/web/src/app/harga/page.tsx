import type { Metadata } from "next";
import Link from "next/link";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import { DISKON_TAHUNAN_BULAN, PAKET, hargaBulanan } from "@/lib/paket";

export const metadata: Metadata = {
  title: "Harga Nadi",
  description: "Paket Gratis, Usaha, Tumbuh, dan Perusahaan. Selama masa uji semua paket gratis dan belum ada tagihan.",
};

const CONTOH_ORANG = [5, 10, 20, 40];

export default function Harga() {
  return (
    <HalamanInfo
      judul="Harga"
      pengantar="Bayar per usaha, lalu per orang bila usahamu tumbuh melewati batas paket. Biaya membaca berkas dengan AI sudah termasuk."
    >
      <p className="max-w-2xl text-tinta-2">
        <span className="stabilo">Selama masa uji semua paket gratis dan belum ada tagihan.</span> Harga di bawah adalah rencana per bulan, belum termasuk PPN.
        Bayar tahunan: {DISKON_TAHUNAN_BULAN} bulan gratis.
      </p>

      <ul className="mt-10 border-y border-garis">
        {PAKET.map((p) => (
          <li key={p.kode} className="grid gap-x-8 gap-y-2 border-b border-garis py-6 last:border-b-0 md:grid-cols-[9rem_13rem_1fr]">
            <h2 className="text-lg font-bold">{p.nama}</h2>
            <div>
              <p className="text-2xl font-semibold">
                {p.mulaiDari && <span className="mr-1 text-sm font-normal text-tinta-2">mulai</span>}
                <Rupiah nilai={p.harga} />
              </p>
              <p className="mt-1 text-sm text-tinta-2">
                sampai {p.orang} orang{p.perOrangTambahan !== null && <>, lalu <Rupiah nilai={p.perOrangTambahan} /> per orang</>}
              </p>
            </div>
            <ul className="space-y-1 text-tinta-2">
              {p.isi.map((i) => <li key={i}>{i}</li>)}
              {p.berkasPerBulan !== null && <li>{formatAngka(p.berkasPerBulan)} berkas dibaca per bulan</li>}
            </ul>
          </li>
        ))}
      </ul>

      <Bagian judul="Contoh hitungan per bulan">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel contoh hitungan, geser ke samping di layar kecil">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Harga per bulan menurut jumlah orang</caption>
            <thead>
              <tr className="border-b border-garis text-tinta">
                <th scope="col" className="py-2 pr-4 font-semibold">Jumlah orang</th>
                {PAKET.map((p) => <th key={p.kode} scope="col" className="py-2 pr-4 text-right font-semibold">{p.nama}</th>)}
              </tr>
            </thead>
            <tbody>
              {CONTOH_ORANG.map((n) => (
                <tr key={n} className="border-b border-garis">
                  <th scope="row" className="angka py-2 pr-4 font-normal">{n} orang</th>
                  {PAKET.map((p) => {
                    const h = hargaBulanan(p, n);
                    return (
                      <td key={p.kode} className="py-2 pr-4 text-right">
                        {h === null ? <span className="text-tinta-2">lewat batas</span> : <Rupiah nilai={h} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bagian>

      <Bagian judul="Yang dihitung sebagai orang">
        <p>Orang aktif di daftar orang usahamu: karyawan, staf lapangan, dan peserta magang. Pelamar, pelanggan, dan akuntan yang kamu undang tidak dihitung.</p>
      </Bagian>
      <Bagian judul="Bila kuota berkas habis">
        <p>Rencana saat tagihan mulai berlaku: berkas tetap bisa dilempar, yang tata letaknya sudah dikenal tetap dibaca tanpa AI, dan berkas baru menunggu bulan berikutnya atau naik paket. Tidak ada tagihan tambahan diam-diam. Selama masa uji, batasnya hanya batas harian untuk mencegah penyalahgunaan.</p>
      </Bagian>
      <Bagian judul="Mulai tanpa daftar">
        <p>Buka <Link href="/demo" className="font-semibold text-tinta underline underline-offset-4">usaha contoh</Link> untuk mencoba semua layar dengan data contoh, atau <Link href="/daftar" className="font-semibold text-tinta underline underline-offset-4">buat akun</Link> untuk usahamu sendiri.</p>
      </Bagian>
    </HalamanInfo>
  );
}
