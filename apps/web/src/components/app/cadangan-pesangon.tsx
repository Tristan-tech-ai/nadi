import Link from "next/link";
import type { ReactNode } from "react";
import { FormIuranPensiun, FormSaldoPesangon } from "@/components/app/aksi-gaji";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { hitungPesangon, ringkasCadangan, teksMasaKerja, type AturanKompensasi, type AturanPesangon, type BarisPesangon, type OrangPesangon } from "@/lib/gaji/pesangon";
import { createClient } from "@/lib/supabase/server";

// Kartu F4-09 di /app/gaji, hanya untuk pemilik (docs/design/cadangan-pesangon.md). Bahan dari RPC cadangan_pesangon (pemilik
// saja, lewat app.peran_aktif), hitungan dari src/lib/gaji/pesangon.ts.

type Data = {
  hari_ini: string;
  saldo: number;
  aturan: { kunci?: string; nilai: AturanPesangon; sumber: string; berlaku_dari: string } | null;
  kompensasi: { nilai: AturanKompensasi; sumber: string } | null;
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

const ALASAN: Record<Exclude<BarisPesangon["status"], "dihitung" | "kompensasi">, string> = {
  tanpa_mulai: "Tanggal mulai kerja belum diisi.",
  belum_mulai: "Belum mulai bekerja.",
  tanpa_gaji: "Gaji pokok belum diisi.",
  kontrak: "Karyawan kontrak (ada tanggal kontrak selesai), belum dihitung di sini.",
};

function BarisOrang({ b, o }: { b: BarisPesangon; o: OrangPesangon }) {
  if (b.status === "kompensasi") {
    return (
      <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2" data-testid="baris-kompensasi">
        <div>
          <p className="font-semibold">{b.nama}</p>
          <p className="text-tinta-2">
            Kontrak sampai {formatTanggalKalender(o.kontrak_selesai ?? "")}. {teksMasaKerja(b.masaBulan ?? 0)}.{" "}
            {(b.masaBulan ?? 0) < 1 ? "Uang kompensasi PKWT mulai berhak setelah 1 bulan kerja." : <>Uang kompensasi PKWT: {b.masaBulan} / 12 x <Rupiah nilai={b.upah} />.</>}
          </p>
        </div>
        <Rupiah nilai={b.dasar} className="font-semibold" />
      </li>
    );
  }
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
        {b.tertutupPensiun > 0 && <p className="text-tinta-2" data-testid="tertutup-pensiun">Tertutup iuran program pensiun <Rupiah nilai={b.tertutupPensiun} />.</p>}
        <FormIuranPensiun orang={b.id} nama={b.nama} nilai={Math.max(0, Number(o.iuran_pensiun ?? 0))} />
      </div>
      <Rupiah nilai={b.dasar} className="font-semibold" />
    </li>
  );
}

const kali = (n: number) => String(n).replace(".", ",");

export async function CadanganPesangon() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cadangan_pesangon");
  const d = data as Data | null;
  if (error || !d || !d.aturan) {
    return <Bagian><p role="alert" className="mt-3 text-sm text-cap">Cadangan pesangon belum bisa dihitung. Coba muat ulang; data gaji tidak berubah.</p></Bagian>;
  }
  const baris = d.orang.map((o) => hitungPesangon(o, d.aturan!.nilai, d.hari_ini, d.kompensasi?.nilai ?? null));
  const orangDari = new Map(d.orang.map((o) => [o.id, o]));
  const adaKontrak = baris.some((b) => b.status === "kompensasi");
  const r = ringkasCadangan(baris, Number(d.saldo));
  const pengali = d.aturan.nilai.pengali;
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
        Kalau semua karyawan berhenti hari ini dengan pengali 1 kali (misalnya usaha tutup karena rugi atau keadaan memaksa), menurut UU 27/2026 Pasal 232.
        {r.belumDihitung > 0 && <> {r.belumDihitung} orang belum dihitung.</>}
      </p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 border-y border-garis py-2 text-sm" data-testid="rentang-pesangon">
        {pengali.rugi !== 1 && <><dt className="text-tinta-2">Bila usaha rugi ({kali(pengali.rugi)} kali)</dt><dd className="text-right"><Rupiah nilai={r.rugi} /></dd></>}
        <dt className="text-tinta-2">Dasar (1 kali)</dt><dd className="text-right"><Rupiah nilai={r.dasar} className="font-semibold" /></dd>
        <dt className="text-tinta-2">Bila pensiun atau meninggal ({kali(pengali.pensiun)} kali uang pesangon)</dt><dd className="text-right"><Rupiah nilai={r.pensiun} /></dd>
        {r.tertutupPensiun > 0 && <><dt className="text-tinta-2">Tertutup iuran program pensiun (Pasal 248)</dt><dd className="text-right" data-testid="total-tertutup-pensiun"><Rupiah nilai={r.tertutupPensiun} /></dd></>}
      </dl>
      {adaKontrak && <p className="mt-2 text-sm text-tinta-2" data-testid="catatan-kontrak">Karyawan kontrak dihitung uang kompensasi PKWT (UU 27/2026 Pasal 88, rinciannya PP 35/2021 Pasal 16). Untuk usaha mikro dan kecil, besarnya berdasarkan kesepakatan dengan pekerja (PP 35/2021 Pasal 16 ayat (6)); angka ini acuan.</p>}
      <p className="mt-3 text-sm" data-testid="saran-pesangon">
        {r.kekurangan > 0
          ? <>Sisihkan <Rupiah nilai={r.sisihanSebulan} className="font-semibold" /> sebulan selama 12 bulan untuk menutup skenario dasar.</>
          : <>{r.tertutupPensiun > 0 ? "Saldo dan iuran dana pensiun" : "Saldo yang sudah disisihkan"} menutup skenario dasar.</>}
      </p>
      <FormSaldoPesangon saldo={Number(d.saldo)} />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-tinta-2">Rincian per orang</summary>
        <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="rincian-pesangon">
          {baris.map((b) => <BarisOrang key={b.id} b={b} o={orangDari.get(b.id)!} />)}
        </ul>
      </details>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-tinta-2">Dari mana angka ini?</summary>
        <div className="mt-2 space-y-2 text-tinta-2 [overflow-wrap:anywhere]">
          <p>Uang pesangon (UU 27/2026 Pasal 232 ayat (2)): 1 bulan upah untuk masa kerja kurang dari 1 tahun, bertambah 1 bulan tiap tahun, paling banyak 9 bulan sejak 8 tahun.</p>
          <p>Uang penghargaan masa kerja (Pasal 232 ayat (3)): 2 bulan sejak 3 tahun, 3 bulan sejak 6 tahun, dan seterusnya sampai 10 bulan sejak 24 tahun.</p>
          <p>Upah yang dipakai adalah gaji pokok ditambah tunjangan tetap (Pasal 234), bukan lembur atau tunjangan tidak tetap.</p>
          <p>Jumlah yang dibayar sungguhan tergantung alasan berhenti (Pasal 236 sampai 249): 1 kali bila usaha tutup karena rugi, keadaan memaksa, PKPU atau pailit, atau pelanggaran setelah SP3; uang penghargaan masa kerja 1,5 kali bila pemilik menutup usaha untuk seterusnya; 2 kali uang pesangon bila pensiun, meninggal, atau pekerja berhenti karena pemberi kerja melanggar; 2 kali uang pesangon dan 2 kali uang penghargaan masa kerja bila sakit berkepanjangan lebih dari 12 bulan. Pekerja yang mengundurkan diri tidak mendapat pesangon, tetapi mendapat uang pisah paling sedikit 1 bulan upah bila peraturan perusahaan tidak mengatur (Pasal 233 dan 242). Hitungan per alasan ada di <Link href="/alat/pesangon" className="text-laut underline underline-offset-2">kalkulator pesangon</Link>. Uang penggantian hak, seperti sisa cuti, tidak masuk cadangan ini.</p>
          <p>Usaha mikro dan kecil membayar pesangon, uang penghargaan masa kerja, dan uang pisah menurut kesepakatan dengan pekerja (Pasal 250).</p>
          <p>Iuran program pensiun yang dibayar penuh oleh usaha (bukan BPJS Jaminan Pensiun) boleh diperhitungkan sebagai bagian dari hak pensiun (Pasal 248 ayat (1)); bila manfaat pensiunnya lebih kecil, selisihnya tetap dibayar usaha (ayat (2)). Isi iuran yang sudah dibayar per orang di rincian.</p>
          <p>Karyawan kontrak (PKWT) mendapat uang kompensasi saat kontrak berakhir (Pasal 88): masa kerja dibagi 12 dikali 1 bulan upah, setelah paling sedikit 1 bulan kerja (PP 35/2021 Pasal 15 ayat (3) dan Pasal 16 ayat (1), tetap berlaku menurut Pasal 310); bila berakhir lebih awal, dihitung sampai yang sudah dijalani (Pasal 17). Nadi menghitung dari tanggal mulai kerja sampai hari ini; bila kontrak sudah diperpanjang dan kompensasi periode lalu sudah dibayar, ubah tanggal mulai ke awal kontrak terakhir.</p>
          <p>Pengusaha wajib menyediakan dana cadangan pesangon (Pasal 253); saldo di atas adalah catatan dana yang sudah kamu sisihkan.</p>
          <p>Aturan yang dipakai: {d.aturan.sumber}, berlaku sejak {formatTanggalKalender(d.aturan.berlaku_dari)}.</p>
        </div>
      </details>
    </Bagian>
  );
}
