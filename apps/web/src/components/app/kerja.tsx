"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useOffline } from "next/offline";
import { PlusIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { tambahKerja, ubahPoin, ubahStatus, usulkanPelaksana, type HasilKerja, type HasilUsulan } from "@/app/app/kerja/actions";
import { Tombol } from "@/components/ui/tombol";
import { formatPoin, pilihStaf, teksSelesai, type KerjaPapan } from "@/lib/kerja/poin";

/** Kerja dengan teks waktu yang sudah dihitung di server (zona usaha), agar HTML server dan klien sama. */
export type KerjaTampil = KerjaPapan & { tenggatTeks: string | null; mulaiTeks: string | null };
type Opsi = { id: string; nama: string };

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";
const label = "flex flex-col gap-1 text-sm";

function Hasil({ h, testid }: { h: HasilKerja; testid?: string }) {
  if (!h) return null;
  return "galat" in h
    ? <p role="alert" className="text-sm text-cap" data-testid={testid}>{h.galat}</p>
    : <p role="status" className="text-sm text-daun" data-testid={testid}>{h.pesan}</p>;
}

/**
 * Usulan pelaksana (F3-02): muncul setelah topi dipilih dan selama pelaksana masih kosong atau sama dengan usulan. Bila pemilik
 * memilih orang lain, usulan disembunyikan tanpa komentar (pilihan pemilik tidak dipersoalkan).
 */
function UsulanPelaksana({ hasil, sibuk, pelaksana, pilih }: { hasil: HasilUsulan | null; sibuk: boolean; pelaksana: string; pilih: (id: string) => void }) {
  if (sibuk) return <p className="text-sm text-tinta-2" data-testid="usulan-memuat">Mencari pelaksana yang bebannya paling ringan...</p>;
  if (!hasil) return null;
  if ("galat" in hasil) return <p className="text-sm text-cap" data-testid="usulan-galat">{hasil.galat}</p>;
  if ("kosong" in hasil) return <p className="text-sm text-tinta-2" data-testid="usulan-kosong">{hasil.kosong}</p>;
  if (pelaksana && pelaksana !== hasil.orang) return null;
  const dipilih = pelaksana === hasil.orang;
  return (
    <div className="grid gap-2 rounded-[var(--radius-isian)] border border-garis bg-kertas-2 p-3 text-sm" data-testid="usulan-pelaksana" data-orang={hasil.orang}>
      <p>Usulan pelaksana: <span className="font-semibold" data-testid="usulan-nama">{hasil.nama}</span></p>
      <p className="text-tinta-2" data-testid="usulan-alasan">{hasil.alasan}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Tombol ragam="kedua" onClick={() => pilih(hasil.orang)} disabled={dipilih}>{dipilih ? `${hasil.nama} dipilih` : `Pilih ${hasil.nama}`}</Tombol>
        <span className="text-xs text-tinta-2">Kamu bebas memilih orang lain.</span>
      </div>
    </div>
  );
}

/** Tombol utama "Tambah kerja" membuka lembar bawah: judul, topi, pelaksana opsional (dengan usulan), tenggat. */
export function TambahKerja({ topi, orang }: { topi: Opsi[]; orang: Opsi[] }) {
  const lembar = useRef<HTMLDialogElement>(null);
  const [versi, setVersi] = useState(0);
  const [pelaksana, setPelaksana] = useState("");
  const [usulan, setUsulan] = useState<HasilUsulan | null>(null);
  const [mencari, mulaiCari] = useTransition();
  const topiTerakhir = useRef("");
  const gantiTopi = (id: string) => {
    topiTerakhir.current = id;
    setUsulan(null);
    if (!id) return;
    mulaiCari(async () => {
      const r = await usulkanPelaksana(id);
      if (topiTerakhir.current === id) setUsulan(r);
    });
  };
  // Kunci idempoten per isian: kiriman ulang (useOffline mengulang aksi yang jawabannya hilang) tidak membuat kerja kembar.
  const kunci = useRef<string | null>(null);
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(async (lalu, fd) => {
    kunci.current ??= crypto.randomUUID();
    fd.set("kunci", kunci.current);
    const r = await tambahKerja(lalu, fd);
    if (r && "pesan" in r) {
      kunci.current = null;
      lembar.current?.close();
      setVersi((v) => v + 1);
      setPelaksana("");
      setUsulan(null);
      topiTerakhir.current = "";
    }
    return r;
  }, null);
  return (
    <div className="grid gap-2">
      <Tombol ukuran="besar" onClick={() => lembar.current?.showModal()} className="w-full sm:w-auto sm:justify-self-start">
        <PlusIcon size={20} aria-hidden /> Tambah kerja
      </Tombol>
      {h && "pesan" in h && <Hasil h={h} testid="hasil-tambah" />}
      <dialog
        ref={lembar}
        aria-labelledby="judul-tambah-kerja"
        className="mx-auto mb-0 mt-auto w-full max-w-none rounded-t-[var(--radius-lembar)] bg-kertas p-5 text-tinta backdrop:bg-tinta/40 sm:mb-auto sm:max-w-lg sm:rounded-[var(--radius-lembar)]"
      >
        <form key={versi} action={aksi} className="grid gap-3" aria-label="Tambah kerja">
          <h2 id="judul-tambah-kerja" className="text-lg font-semibold">Tambah kerja</h2>
          <label className={label}>
            <span className="text-tinta-2">Judul kerja</span>
            <input name="judul" required minLength={3} maxLength={300} placeholder="Cek stok beras" className={isian} />
          </label>
          <label className={label}>
            <span className="text-tinta-2">Topi (peran kerja)</span>
            <select name="topi" defaultValue="" className={isian} onChange={(e) => gantiTopi(e.target.value)}>
              <option value="">Tanpa topi</option>
              {topi.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </label>
          <label className={label}>
            <span className="text-tinta-2">Pelaksana (boleh kosong)</span>
            <select name="pelaksana" value={pelaksana} onChange={(e) => setPelaksana(e.target.value)} className={isian}>
              <option value="">Belum ditentukan</option>
              {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </label>
          <div aria-live="polite">
            <UsulanPelaksana hasil={usulan} sibuk={mencari} pelaksana={pelaksana} pilih={setPelaksana} />
          </div>
          <label className={label}>
            <span className="text-tinta-2">Tenggat (boleh kosong)</span>
            <input name="tenggat" type="datetime-local" className={isian} />
          </label>
          <p className="text-xs text-tinta-2">Poin dihitung setelah disimpan: dari kerja serupa yang sudah selesai, atau perkiraan model bila riwayat belum cukup.</p>
          {h && "galat" in h && <Hasil h={h} />}
          <div className="flex flex-wrap gap-2">
            <Tombol type="submit" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan kerja"}</Tombol>
            <Tombol ragam="teks" onClick={() => lembar.current?.close()}>Tutup</Tombol>
          </div>
        </form>
      </dialog>
    </div>
  );
}

/** Ubah poin (pemilik/admin): sumber manual. */
export function UbahPoin({ kerja, judul, poin }: { kerja: string; judul: string; poin: number | null }) {
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(ubahPoin, null);
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-tinta-2 underline-offset-4 hover:underline">Ubah poin</summary>
      <form action={aksi} className="mt-2 grid gap-2" aria-label={`Ubah poin ${judul}`}>
        <input type="hidden" name="kerja" value={kerja} />
        <label className={label}>
          <span className="text-tinta-2">Poin (1 poin = 15 menit)</span>
          <input name="poin" inputMode="decimal" required defaultValue={poin == null ? "" : String(poin).replace(".", ",")} placeholder="2" className={`${isian} w-28`} />
        </label>
        <label className={label}>
          <span className="text-tinta-2">Alasan (boleh kosong)</span>
          <input name="alasan" maxLength={300} placeholder="Stok baru datang, barang lebih banyak" className={isian} />
        </label>
        <div><Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan poin"}</Tombol></div>
        <Hasil h={h} />
      </form>
    </details>
  );
}

function TombolStatus({ kerja, aksi, children, ragam, kirim, sibuk }: {
  kerja: string; aksi: string; children: string; ragam: "utama" | "kedua"; kirim: (fd: FormData) => void; sibuk: boolean;
}) {
  return (
    <form action={kirim} className="flex-1">
      <input type="hidden" name="kerja" value={kerja} />
      <input type="hidden" name="aksi" value={aksi} />
      <Tombol type="submit" ukuran="besar" ragam={ragam} disabled={sibuk} className="w-full">{children}</Tombol>
    </form>
  );
}

/** Layar staf: satu kerja aktif dengan tombol besar, 5 kerja berikutnya, dan yang selesai hari ini (DIRECTION §4). */
export function PapanStaf({ daftar }: { daftar: KerjaTampil[] }) {
  const [h, kirim, sibuk] = useActionState<HasilKerja, FormData>(ubahStatus, null);
  const luring = useOffline();
  const { aktif, berikutnya, selesai } = pilihStaf(daftar) as { aktif: KerjaTampil | null; berikutnya: KerjaTampil[]; selesai: KerjaTampil[] };
  const baruSelesai = h && "aksi" in h && h.aksi === "selesai" ? h.id : null;

  return (
    <div className="mt-6 grid gap-8">
      {luring && (
        <p role="status" className="flex items-center gap-2 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="kerja-luring">
          <WifiSlashIcon size={20} aria-hidden /> Kamu sedang luring. Tombol yang kamu tekan dikirim otomatis saat sinyal kembali.
        </p>
      )}
      <section aria-labelledby="judul-kerja-aktif" data-testid="kerja-aktif">
        <h2 id="judul-kerja-aktif" className="sr-only">Kerja sekarang</h2>
        {aktif ? (
          <div className="rounded-[var(--radius-kartu)] border border-garis bg-kertas-2 p-5" data-judul={aktif.judul}>
            <p className="text-sm font-semibold text-tinta-2" data-testid="status-aktif">
              {aktif.status === "baru" ? "Belum dimulai" : aktif.status === "jalan" ? `Sedang jalan sejak ${aktif.mulaiTeks ?? "tadi"}` : "Ditunda dulu"}
            </p>
            <p className="mt-1 text-2xl font-bold leading-tight">{aktif.judul}</p>
            <p className="mt-2 text-sm text-tinta-2">
              {aktif.tenggatTeks ? `Tenggat ${aktif.tenggatTeks}` : "Tanpa tenggat"}
              {aktif.estimasi && <> · {formatPoin(aktif.estimasi.poin)}, sekitar {Math.round(aktif.estimasi.menit)} menit</>}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {aktif.status === "baru" && <TombolStatus kerja={aktif.id} aksi="mulai" ragam="utama" kirim={kirim} sibuk={sibuk}>Mulai</TombolStatus>}
              {aktif.status === "jalan" && (
                <>
                  <TombolStatus kerja={aktif.id} aksi="selesai" ragam="utama" kirim={kirim} sibuk={sibuk}>Selesai</TombolStatus>
                  <TombolStatus kerja={aktif.id} aksi="tunggu" ragam="kedua" kirim={kirim} sibuk={sibuk}>Tunggu dulu</TombolStatus>
                </>
              )}
              {aktif.status === "tunggu" && (
                <>
                  <TombolStatus kerja={aktif.id} aksi="lanjut" ragam="utama" kirim={kirim} sibuk={sibuk}>Lanjut</TombolStatus>
                  <TombolStatus kerja={aktif.id} aksi="selesai" ragam="kedua" kirim={kirim} sibuk={sibuk}>Selesai</TombolStatus>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-tinta-2" data-testid="kerja-kosong">
            {selesai.length ? "Semua kerjamu hari ini sudah selesai." : "Belum ada kerja untukmu hari ini. Kerja dibagikan pemilik atau admin."}
          </p>
        )}
        <div className="mt-3"><Hasil h={h} testid="hasil-kerja" /></div>
      </section>

      {berikutnya.length > 0 && (
        <section aria-labelledby="judul-berikutnya">
          <h2 id="judul-berikutnya" className="text-lg font-semibold">Berikutnya</h2>
          <ol className="mt-2 divide-y divide-garis border-y border-garis" data-testid="kerja-berikutnya">
            {berikutnya.map((k) => (
              <li key={k.id} className="py-3">
                <p className="font-semibold">{k.judul}</p>
                <p className="text-sm text-tinta-2">
                  {k.status === "tunggu" ? "Ditunda · " : ""}{k.tenggatTeks ? `Tenggat ${k.tenggatTeks}` : "Tanpa tenggat"}
                  {k.estimasi ? ` · ${formatPoin(k.estimasi.poin)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {selesai.length > 0 && (
        <section aria-labelledby="judul-selesai-staf">
          <h2 id="judul-selesai-staf" className="text-lg font-semibold">Selesai hari ini</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="kerja-selesai-staf">
            {selesai.map((k) => (
              <li key={k.id} className={`py-3 ${k.id === baruSelesai ? "geser-selesai" : ""}`} data-judul={k.judul}>
                <p className="font-semibold">{k.judul}</p>
                <p className="text-sm text-tinta-2" data-testid="durasi-nyata">{teksSelesai(k.aktual_menit, k.estimasi?.menit ?? null)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

