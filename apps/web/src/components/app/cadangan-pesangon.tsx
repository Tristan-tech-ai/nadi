import Link from "next/link";
import type { ReactNode } from "react";
import { FormSaldoPesangon } from "@/components/app/aksi-gaji";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { hitungPesangon, ringkasCadangan, teksMasaKerja, type AturanPesangon, type BarisPesangon, type OrangPesangon } from "@/lib/gaji/pesangon";
import { createClient } from "@/lib/supabase/server";

// Kartu F4-09 di /app/gaji, hanya untuk pemilik (docs/design/cadangan-pesangon.md). Bahan dari RPC cadangan_pesangon (pemilik
// saja, lewat app.peran_aktif), hitungan dari src/lib/gaji/pesangon.ts.

type Data = {
  hari_ini: string;
  saldo: number;
  aturan: { nilai: AturanPesangon; sumber: string; berlaku_dari: string } | null;
  orang: OrangPesangon[];
};

function Bagian({ children }: { children: ReactNode }) {
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-pesangon" data-testid="cadangan-pesangon">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="judul-pesangon" className="text-lg font-semibold">Cadangan pesangon</h2>
        <span className="rounded-full border border-garis-kuat px-2 py-0.5 text-xs font-semibold text-tinta-2">Perkiraan, belum final</span>
      </div>
      {children}
    </section>
  );
}

const ALASAN: Record<Exclude<BarisPesangon["status"], "dihitung">, string> = {
  tanpa_mulai: "Tanggal mulai kerja belum diisi.",
  belum_mulai: "Belum mulai bekerja.",
  tanpa_gaji: "Gaji pokok belum diisi.",
  kontrak: "Karyawan kontrak (ada tanggal kontrak selesai), belum dihitung di sini.",
};

function BarisOrang({ b }: { b: BarisPesangon }) {
  if (b.status !== "dihitung") {
    return (
      <li className="py-2">
        <p className="font-semibold">{b.nama}</p>
        <p className="text-tinta-2">
          {ALASAN[b.status]} {(b.status === "tanpa_mulai" || b.status === "tanpa_gaji") && <Link href="/app/orang" className="text-laut underline underline-offset-2">Isi di halaman Orang</Link>}
        </p>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
      <div>
        <p className="font-semibold">{b.nama}</p>
        <p className="text-tinta-2">
          {teksMasaKerja(b.masaBulan ?? 0)}. <Rupiah nilai={b.upah} /> x ({b.bulanPesangon} bulan pesangon + {b.bulanUpmk} bulan penghargaan)
        </p>
      </div>
      <Rupiah nilai={b.dasar} className="font-semibold" />
    </li>
  );
}

export async function CadanganPesangon() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cadangan_pesangon");
  const d = data as Data | null;
  if (error || !d || !d.aturan) {
    return <Bagian><p role="alert" className="mt-3 text-sm text-cap">Cadangan pesangon belum bisa dihitung. Coba muat ulang; data gaji tidak berubah.</p></Bagian>;
  }
  const baris = d.orang.map((o) => hitungPesangon(o, d.aturan!.nilai, d.hari_ini));
  const r = ringkasCadangan(baris, Number(d.saldo));
  if (!r.dihitung) {
    return (
      <Bagian>
        <p className="mt-3 text-sm text-tinta-2" data-testid="pesangon-kosong">
          Isi gaji pokok, tunjangan tetap, dan tanggal mulai kerja di <Link href="/app/orang" className="text-laut underline underline-offset-2">halaman Orang</Link> dulu. Cadangan pesangon dihitung dari angka itu.
        </p>
      </Bagian>
    );
  }
  return (
    <Bagian>
      <p className="mt-3"><Rupiah nilai={r.dasar} className="text-3xl font-extrabold" /></p>
      <p className="mt-1 text-sm text-tinta-2">
        Kalau semua karyawan berhenti hari ini dengan alasan umum (1 kali), menurut PP 35/2021 Pasal 40.
        {r.belumDihitung > 0 && <> {r.belumDihitung} orang belum dihitung.</>}
      </p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-y border-garis py-2 text-sm" data-testid="rentang-pesangon">
        <dt className="text-tinta-2">Bila usaha rugi (0,5 kali)</dt><dd className="text-right"><Rupiah nilai={r.rugi} /></dd>
        <dt className="text-tinta-2">Dasar (1 kali)</dt><dd className="text-right"><Rupiah nilai={r.dasar} className="font-semibold" /></dd>
        <dt className="text-tinta-2">Bila pensiun (1,75 kali)</dt><dd className="text-right"><Rupiah nilai={r.pensiun} /></dd>
      </dl>
      <p className="mt-3 text-sm" data-testid="saran-pesangon">
        {r.kekurangan > 0
          ? <>Sisihkan <Rupiah nilai={r.sisihanSebulan} className="font-semibold" /> sebulan selama 12 bulan untuk menutup skenario dasar.</>
          : <>Saldo yang sudah disisihkan menutup skenario dasar.</>}
      </p>
      <FormSaldoPesangon saldo={Number(d.saldo)} />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-tinta-2">Rincian per orang</summary>
        <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="rincian-pesangon">
          {baris.map((b) => <BarisOrang key={b.id} b={b} />)}
        </ul>
      </details>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-tinta-2">Dari mana angka ini?</summary>
        <div className="mt-2 space-y-2 text-tinta-2">
          <p>Uang pesangon (Pasal 40 ayat (2)): 1 bulan upah untuk masa kerja kurang dari 1 tahun, bertambah 1 bulan tiap tahun, paling banyak 9 bulan sejak 8 tahun.</p>
          <p>Uang penghargaan masa kerja (Pasal 40 ayat (3)): 2 bulan sejak 3 tahun, 3 bulan sejak 6 tahun, dan seterusnya sampai 10 bulan sejak 24 tahun.</p>
          <p>Upah yang dipakai adalah gaji pokok ditambah tunjangan tetap (Pasal 157 UU 13/2003 yang diubah UU 6/2023), bukan lembur atau tunjangan tidak tetap.</p>
          <p>Jumlah yang dibayar sungguhan tergantung alasan berhenti (PP 35/2021 Pasal 41 sampai 57): misalnya 0,5 kali bila efisiensi karena rugi, 1,75 kali bila pensiun. Uang penggantian hak, seperti sisa cuti, tidak masuk cadangan ini.</p>
          <p>UU Pelindungan Ketenagakerjaan sudah disahkan DPR pada 6 Okt 2026 tetapi teksnya belum terbit. Sampai berlaku, Nadi memakai PP 35/2021 (berlaku sejak {formatTanggalKalender(d.aturan.berlaku_dari)}).</p>
        </div>
      </details>
    </Bagian>
  );
}
