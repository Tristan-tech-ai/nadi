"use client";

// U-04 layar tinjau draf AI (docs/design/REKONSTRUKSI-APP.md 7b): satu daftar per bagian, baris sudah tercentang, setiap sel bisa
// diubah di tempat, baris bisa dihapus atau ditambah, alasan AI bisa dibuka, baris yang perlu dicek di atas dan tidak tercentang,
// gaji tidak pernah tercentang otomatis. Satu tombol Terapkan N baris lalu jendela batal 10 menit, tanpa konfirmasi per baris.
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { batalkanDraf, centangBaris, hapusBaris, tambahBaris, terapkanDraf, ubahSel } from "@/app/app/siapkan/draf-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { KOLOM, URUT_BAGIAN, nilaiIsian, urutkan, type Bagian, type BarisDraf } from "@/lib/onboarding/draf";

const T = {
  id: {
    bagian: { orang: "Orang", gaji: "Gaji pokok", topi: "Topi (peran kerja)", izin: "Aturan izin", fitur: "Fitur di menu", usaha: "Profil usaha" } as Record<Bagian, string>,
    kolom: { nama: "Nama", jabatan: "Topi", mulai: "Mulai", pokok: "Gaji pokok (Rp)", jenis: "Jenis", otomatis: "Otomatis", maks_hari: "Maks hari", butuh_bukti: "Wajib bukti",
      jatah_tahunan: "Jatah setahun", modul: "Modul", nyala: "Tampil", skala: "Jumlah orang", cabang: "Cabang", kota: "Kota", negara: "Negara" } as Record<string, string>,
    semua: "Semua", perluDicek: "Perlu dicek", ringkas: (n: number, c: number, r: number) => `${n} baris dari AI-mu. ${c} tercentang, ${r} perlu dicek.`,
    kenapa: "Kenapa?", hapus: "Hapus baris", tambah: "Tambah baris", pilih: "Pakai baris", terapkan: (n: number) => `Terapkan ${n} baris`, kosong: "Centang minimal satu baris",
    gajiCatatan: "Gaji tidak dicentang otomatis. Periksa angkanya dulu.", diterapkan: (n: number) => `${n} baris diterapkan.`, batal: "Batalkan",
    sisa: (s: string) => `Bisa dibatalkan ${s} lagi.`, dibatalkan: "Draf dibatalkan. Data dikembalikan seperti sebelum diterapkan.", lanjut: "Buka Hari ini", ya: "Ya", tidak: "Tidak",
    simpan: "Tersimpan", label: "Draf dari AI-mu",
  },
  en: {
    bagian: { orang: "People", gaji: "Base pay", topi: "Hats (work roles)", izin: "Leave rules", fitur: "Menu features", usaha: "Business profile" } as Record<Bagian, string>,
    kolom: { nama: "Name", jabatan: "Hat", mulai: "Start", pokok: "Base pay (Rp)", jenis: "Type", otomatis: "Automatic", maks_hari: "Max days", butuh_bukti: "Proof required",
      jatah_tahunan: "Yearly quota", modul: "Module", nyala: "Shown", skala: "Headcount", cabang: "Branches", kota: "City", negara: "Country" } as Record<string, string>,
    semua: "All", perluDicek: "Needs a check", ringkas: (n: number, c: number, r: number) => `${n} rows from your AI. ${c} ticked, ${r} need a check.`,
    kenapa: "Why?", hapus: "Delete row", tambah: "Add row", pilih: "Use row", terapkan: (n: number) => `Apply ${n} rows`, kosong: "Tick at least one row",
    gajiCatatan: "Pay is never ticked automatically. Check the amount first.", diterapkan: (n: number) => `${n} rows applied.`, batal: "Undo",
    sisa: (s: string) => `You can undo for ${s} more.`, dibatalkan: "Draft undone. Data is back to how it was.", lanjut: "Open Today", ya: "Yes", tidak: "No",
    simpan: "Saved", label: "Draft from your AI",
  },
};

const isianKelas = "h-10 w-full min-w-0 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-sm text-tinta";

export function TinjauDraf({ draf, awal, status, batalSampai, bahasa: b }: { draf: string; awal: BarisDraf[]; status: string; batalSampai: string | null; bahasa: Bahasa }) {
  const t = T[b];
  const [baris, setBaris] = useState(awal);
  const [saring, setSaring] = useState<"semua" | "cek">("semua");
  const [galat, setGalat] = useState<string | null>(null);
  const [keadaan, setKeadaan] = useState<{ status: string; batalSampai: string | null; n?: number }>({ status, batalSampai });
  const [sibuk, mulai] = useTransition();
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    if (keadaan.status !== "diterapkan") return;
    const j = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(j);
  }, [keadaan.status]);

  const terbuka = keadaan.status === "draf";
  const nCentang = baris.filter((x) => x.centang).length;
  const nRagu = baris.filter((x) => x.ragu).length;
  const tampil = useMemo(() => urutkan(saring === "cek" ? baris.filter((x) => x.ragu) : baris), [baris, saring]);
  const perBagian = URUT_BAGIAN.map((bg) => [bg, tampil.filter((x) => x.bagian === bg)] as const).filter(([, xs]) => xs.length > 0);

  function jalankan(f: () => Promise<{ baris?: BarisDraf[]; galat?: string }>) {
    setGalat(null);
    mulai(async () => {
      const h = await f();
      if (h.galat) setGalat(h.galat);
      else if (h.baris) setBaris(h.baris);
    });
  }

  const sisaDetik = keadaan.batalSampai ? Math.max(0, Math.floor((Date.parse(keadaan.batalSampai) - kini) / 1000)) : 0;
  const sisa = `${Math.floor(sisaDetik / 60)}:${String(sisaDetik % 60).padStart(2, "0")}`;

  return (
    <div data-testid="tinjau-draf" data-status={keadaan.status}>
      <p className="inline-flex rounded-full border border-garis px-3 py-1 text-xs font-semibold">{t.label}</p>
      <p className="mt-2 text-sm" data-testid="ringkas-draf">{t.ringkas(baris.length, nCentang, nRagu)}</p>
      {terbuka && nRagu > 0 && (
        <div className="mt-3 flex gap-2" role="group" aria-label={t.perluDicek}>
          {(["semua", "cek"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={saring === k} onClick={() => setSaring(k)}
              className={`h-10 rounded-full border px-4 text-sm ${saring === k ? "border-tinta bg-kertas-2 font-semibold" : "border-garis"}`}>
              {k === "semua" ? t.semua : `${t.perluDicek} (${nRagu})`}
            </button>
          ))}
        </div>
      )}

      {perBagian.map(([bg, xs]) => (
        <section key={bg} aria-labelledby={`bagian-${bg}`} className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`bagian-${bg}`} className="text-base font-bold">{t.bagian[bg]} <span className="font-normal text-tinta-2">{xs.length}</span></h2>
            {terbuka && (bg === "orang" || bg === "topi" || bg === "gaji") && (
              <button type="button" disabled={sibuk} onClick={() => jalankan(() => tambahBaris(draf, bg, bg === "gaji" ? { nama: "", pokok: null } : { nama: "" }))}
                className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-isian)] px-2 text-sm font-semibold hover:bg-kertas-2">
                <PlusIcon size={16} aria-hidden />{t.tambah}<span className="sr-only"> {t.bagian[bg]}</span>
              </button>
            )}
          </div>
          {bg === "gaji" && <p className="mt-1 text-xs text-tinta-2">{t.gajiCatatan}</p>}
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {xs.map((x) => {
              const no = baris.indexOf(x) + 1;
              return (
                <li key={x.id} data-baris={x.id} data-bagian={x.bagian} data-centang={x.centang ? "ya" : "tidak"} data-ragu={x.ragu ? "ya" : "tidak"}
                  className={`grid gap-2 py-3 min-[840px]:grid-cols-[auto_1fr_auto] min-[840px]:items-start ${x.ragu ? "bg-kunyit/15 px-2" : ""}`}>
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input type="checkbox" className="size-5 accent-[var(--tinta)]" checked={x.centang} disabled={!terbuka || sibuk || !!x.ragu}
                      onChange={(e) => jalankan(() => centangBaris(draf, x.id, e.target.checked))} />
                    <span className="sr-only">{t.pilih} {no}</span>
                    <span className="text-tinta-2 min-[840px]:sr-only" aria-hidden>{no}</span>
                  </label>
                  <div className="grid min-w-0 gap-2 min-[600px]:grid-cols-3">
                    {KOLOM[x.bagian].map((k) => {
                      const v = x.nilai[k.kunci];
                      const label = `${t.kolom[k.kunci] ?? k.kunci} ${no}`;
                      const simpan = (teks: string) => {
                        const baru = nilaiIsian(k.jenis, teks);
                        if (String(baru ?? "") !== String(v ?? "")) jalankan(() => ubahSel(draf, x.id, { [k.kunci]: baru }));
                      };
                      return (
                        <label key={k.kunci} className="grid min-w-0 gap-0.5 text-xs text-tinta-2">
                          {t.kolom[k.kunci] ?? k.kunci}
                          {k.jenis === "pilih" || k.jenis === "ya" ? (
                            <select aria-label={label} className={isianKelas} disabled={!terbuka || sibuk} value={String(v ?? "")} onChange={(e) => simpan(e.target.value)}>
                              {(k.jenis === "ya" ? ["true", "false"] : k.pilihan ?? []).map((p) => <option key={p} value={p}>{k.jenis === "ya" ? (p === "true" ? t.ya : t.tidak) : p}</option>)}
                            </select>
                          ) : (
                            <input aria-label={label} className={isianKelas} disabled={!terbuka || sibuk} defaultValue={String(v ?? "")}
                              type={k.jenis === "tanggal" ? "date" : "text"} inputMode={k.jenis === "angka" ? "numeric" : undefined}
                              onBlur={(e) => simpan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} data-pengguna />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-start gap-2">
                    {(x.alasan || x.keyakinan !== null) && (
                      <details className="text-sm">
                        <summary className="inline-flex h-10 cursor-pointer list-none items-center px-2 text-tinta-2 underline underline-offset-4">{t.kenapa}</summary>
                        <p className="max-w-60 text-xs text-tinta-2">{x.alasan}{x.keyakinan !== null ? ` (${x.keyakinan}%)` : ""}</p>
                      </details>
                    )}
                    {terbuka && (
                      <button type="button" disabled={sibuk} onClick={() => jalankan(() => hapusBaris(draf, x.id))}
                        className="inline-flex size-10 items-center justify-center rounded-full text-tinta-2 hover:bg-kertas-2 hover:text-cap">
                        <TrashIcon size={18} aria-hidden /><span className="sr-only">{t.hapus} {no}</span>
                      </button>
                    )}
                  </div>
                  {x.ragu && <p className="flex items-center gap-1 text-sm font-semibold min-[840px]:col-span-3"><WarningIcon size={16} aria-hidden />{t.perluDicek}: {x.ragu}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-garis bg-kertas py-3 min-[600px]:bottom-0">
        {galat && <p role="alert" className="w-full text-sm text-cap">{galat}</p>}
        {keadaan.status === "draf" && (
          <Tombol type="button" ukuran="besar" disabled={sibuk || nCentang === 0} data-testid="terapkan-draf"
            onClick={() => { setGalat(null); mulai(async () => { const h = await terapkanDraf(draf); if (h.galat) setGalat(h.galat); else setKeadaan({ status: "diterapkan", batalSampai: h.batalSampai ?? null, n: h.diterapkan }); }); }}>
            {nCentang ? t.terapkan(nCentang) : t.kosong}
          </Tombol>
        )}
        {keadaan.status === "diterapkan" && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{t.diterapkan(keadaan.n ?? nCentang)}</span>
            {sisaDetik > 0 && <>
              <span className="text-tinta-2">{t.sisa(sisa)}</span>
              <Tombol type="button" ragam="kedua" disabled={sibuk} onClick={() => { mulai(async () => { const h = await batalkanDraf(draf); if (h.galat) setGalat(h.galat); else setKeadaan({ status: "dibatalkan", batalSampai: null }); }); }}>{t.batal}</Tombol>
            </>}
            <Link href="/app" className="font-semibold underline underline-offset-4">{t.lanjut}</Link>
          </div>
        )}
        {keadaan.status === "dibatalkan" && <p role="status" className="text-sm">{t.dibatalkan}</p>}
      </div>
    </div>
  );
}
