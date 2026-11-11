import type { Bidang, Koleksi, Manifest, Transisi } from "@/lib/mod/skema";

// X-06/X-14 pratinjau isi mod sebelum dipasang: ringkas (daftar Tambah fitur) dan lengkap (halaman rincian paket).
// Semua teks dari manifest dirender sebagai teks biasa React, tidak pernah sebagai markup.
export const PERAN_NAMA: Record<string, string> = { pemilik: "Pemilik", admin: "Admin", akuntan: "Akuntan", staf: "Staf", pembuat: "Pembuat", ditugaskan: "Yang ditugaskan" };
export const AKSES_NAMA: Record<string, string> = { tidak: "tidak melihat", lihat: "melihat", milik_sendiri: "mengisi miliknya", tulis: "mengisi semua", kelola: "mengelola" };
const TIPE_NAMA: Record<Bidang["tipe"], string> = {
  teks: "teks", teks_panjang: "teks panjang", angka: "angka", rupiah: "rupiah", tanggal: "tanggal", tanggal_jam: "tanggal dan jam", pilihan: "pilihan",
  pilihan_banyak: "pilihan ganda", centang: "centang", tautan: "tautan", telepon: "telepon", berkas: "berkas", orang: "orang", pelanggan: "pelanggan",
  produk: "produk", proyek: "proyek", rujukan: "rujukan", rumus: "dihitung otomatis",
};
const isian = (s: string) => s.replace(/\{([a-z_0-9]+)\}/g, "[$1]");

export function Pratinjau({ m }: { m: Manifest }) {
  return (
    <div className="mt-3 grid gap-4 text-sm" data-testid={`pratinjau-${m.kode}`}>
      {m.koleksi.map((k) => (
        <section key={k.kode} aria-label={`Bagian ${k.nama}`}>
          <h4 className="font-semibold">{k.nama}</h4>
          <p className="mt-1 text-tinta-2">Isian: {k.bidang.map((b) => b.label).join(", ")}.</p>
          {k.status && <p className="text-tinta-2">Status: {k.status.daftar.map((s) => s.label).join(", ")}.
            {k.status.transisi.some((t) => t.wajib_isi?.length) ? ` ${k.status.transisi.filter((t) => t.wajib_isi?.length).map((t) => `${t.label ?? t.ke} wajib mengisi ${t.wajib_isi!.map((w) => k.bidang.find((b) => b.kode === w)?.label ?? w).join(", ")}`).join("; ")}.` : ""}</p>}
          <p className="text-tinta-2">Tampilan: {[...new Set(k.tampilan.map((t) => t.jenis))].join(", ")}.</p>
          <p className="text-tinta-2">Akses: {Object.entries(k.akses).map(([p, a]) => `${PERAN_NAMA[p] ?? p} ${AKSES_NAMA[a] ?? a}`).join(", ")}.</p>
        </section>
      ))}
      {(m.otomasi?.length ?? 0) > 0 && <p className="text-tinta-2">Otomasi: {m.otomasi!.map((o) => isian(o.aksi.judul)).join("; ")}.</p>}
    </div>
  );
}

function namaStatus(k: Koleksi, kode: string) {
  return k.status?.daftar.find((s) => s.kode === kode)?.label ?? kode;
}
function teksTransisi(k: Koleksi, t: Transisi) {
  const dari = t.dari === "*" ? "status mana pun" : t.dari.map((d) => namaStatus(k, d)).join(" atau ");
  const wajib = t.wajib_isi?.length ? `, wajib mengisi ${t.wajib_isi.map((w) => k.bidang.find((b) => b.kode === w)?.label ?? w).join(", ")}` : "";
  return `${t.label ?? namaStatus(k, t.ke)}: dari ${dari} ke ${namaStatus(k, t.ke)}, oleh ${t.peran.map((p) => (PERAN_NAMA[p] ?? p).toLowerCase()).join(", ")}${wajib}.`;
}

/** Rincian lengkap untuk halaman paket: setiap isian dengan tipenya, alur status, akses per peran, otomasi, dan laporan. */
export function RincianMod({ m }: { m: Manifest }) {
  return (
    <div className="grid gap-6 text-sm" data-testid={`rincian-${m.kode}`}>
      {m.koleksi.map((k) => (
        <section key={k.kode} aria-labelledby={`koleksi-${k.kode}`} className="rounded-[var(--radius-kartu)] border border-garis p-4">
          <h3 id={`koleksi-${k.kode}`} className="font-semibold">{k.nama}</h3>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">Isian {k.nama}</caption>
            <thead><tr className="border-b border-garis text-tinta-2"><th scope="col" className="py-1 pr-3 font-semibold">Isian</th><th scope="col" className="py-1 pr-3 font-semibold">Jenis</th><th scope="col" className="py-1 font-semibold">Keterangan</th></tr></thead>
            <tbody>
              {k.bidang.map((b) => (
                <tr key={b.kode} className="border-b border-garis align-top">
                  <td className="py-1.5 pr-3">{b.label}</td>
                  <td className="py-1.5 pr-3 text-tinta-2">{TIPE_NAMA[b.tipe]}{b.tipe === "orang" && b.banyak ? ", banyak orang" : ""}</td>
                  <td className="py-1.5 text-tinta-2">{[b.wajib ? "wajib" : "", b.penugasan ? "orang yang ditugaskan" : "", b.pilihan ? b.pilihan.map((p) => p.label).join(", ") : "",
                    b.tipe === "rujukan" ? `ke ${m.koleksi.find((x) => x.kode === b.koleksi)?.nama ?? b.koleksi}` : "", b.petunjuk ?? ""].filter(Boolean).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {k.status && (
            <div className="mt-3">
              <p><span className="font-semibold">Alur status:</span> <span className="text-tinta-2">{k.status.daftar.map((s) => s.label + (s.akhir ? " (akhir)" : "")).join(", ")}. Mulai dari {namaStatus(k, k.status.awal)}.</span></p>
              <ul className="mt-1 list-disc pl-5 text-tinta-2">{k.status.transisi.map((t, i) => <li key={i}>{teksTransisi(k, t)}</li>)}</ul>
            </div>
          )}
          <p className="mt-3"><span className="font-semibold">Tampilan:</span> <span className="text-tinta-2">{[...new Set(k.tampilan.map((t) => t.jenis))].join(", ")}.</span></p>
          <p className="mt-1"><span className="font-semibold">Akses:</span> <span className="text-tinta-2">{Object.entries(k.akses).map(([p, a]) => `${PERAN_NAMA[p] ?? p} ${AKSES_NAMA[a] ?? a}`).join(", ")}.</span></p>
        </section>
      ))}
      {(m.otomasi?.length ?? 0) > 0 && (
        <section aria-labelledby="judul-otomasi-mod">
          <h3 id="judul-otomasi-mod" className="font-semibold">Pengingat dan kartu otomatis</h3>
          <ul className="mt-1 list-disc pl-5 text-tinta-2">{m.otomasi!.map((o) => <li key={o.kode}>{isian(o.aksi.judul)}</li>)}</ul>
        </section>
      )}
      {(m.laporan?.length ?? 0) > 0 && (
        <section aria-labelledby="judul-laporan-mod">
          <h3 id="judul-laporan-mod" className="font-semibold">Laporan</h3>
          <ul className="mt-1 list-disc pl-5 text-tinta-2">{m.laporan!.map((l) => <li key={l.kode}>{l.judul}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
