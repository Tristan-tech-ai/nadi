// Katalog paket resmi Nadi Mod (X-06, X-14). Setiap paket adalah manifest biasa yang lolos pengawas yang sama dengan buatan
// pengguna (src/lib/mod/katalog.test.ts); "resmi" hanya berarti disusun dan diuji tim Nadi. Paket gelombang 1 disimpan per
// berkas di src/lib/mod/katalog/*.json: manifest, untuk siapa, contoh pemakaian, dan isi contoh. Di isi contoh, nilai "@" pada
// bidang rujukan (orang, pelanggan, rujukan) diisi saat uji pasang dengan data usaha uji (e2e/katalog-resmi.spec.ts).
import { CONTOH_PROYEK_AGENSI, type Manifest } from "./skema";
import armada from "./katalog/armada.json";
import eventAcara from "./katalog/event-acara.json";
import helpdesk from "./katalog/helpdesk-internal.json";
import inspeksi from "./katalog/inspeksi-k3.json";
import kalenderKonten from "./katalog/kalender-konten.json";
import keanggotaan from "./katalog/keanggotaan.json";
import kunjungan from "./katalog/kunjungan-lapangan.json";
import logRapat from "./katalog/log-rapat.json";
import peminjaman from "./katalog/peminjaman.json";
import pembelian from "./katalog/permintaan-pembelian.json";
import agensiRetainer from "./katalog/agensi-retainer.json";
import distributor from "./katalog/distributor-retur.json";
import katering from "./katalog/katering-pesanan.json";
import klinik from "./katalog/klinik-operasional.json";
import koperasi from "./katalog/koperasi.json";
import kos from "./katalog/kos-properti.json";
import kursus from "./katalog/kursus-sekolah.json";
import laporanProyek from "./katalog/laporan-proyek.json";
import orderCetak from "./katalog/order-cetak.json";
import rental from "./katalog/rental-unit.json";

export type IsiContoh = { koleksi: string; data: Record<string, unknown> };
export type PaketResmi = { manifest: Manifest; untuk: string; contoh: string; isi_contoh: IsiContoh[] };

// JSON dibaca sebagai tipe lebar; kebenarannya dijaga pengawas di tes, bukan oleh cast ini.
const dariBerkas = (p: { manifest: unknown; untuk: string; contoh: string; isi_contoh: IsiContoh[] }): PaketResmi => ({ ...p, manifest: p.manifest as Manifest });

export const KATALOG_RESMI: readonly PaketResmi[] = [
  {
    manifest: CONTOH_PROYEK_AGENSI,
    untuk: "Agensi kreatif, konsultan, software house, dan tim yang mengerjakan proyek klien.",
    contoh: "Proyek Katalog Bali untuk klien hotel: tugas desain dikerjakan tim, dikirim untuk review, revisi, lalu diterima.",
    isi_contoh: [
      { koleksi: "proyek", data: { nama: "Katalog Bali", klien: "@", pic: "@", jenis: "sekali", tenggat: "2026-12-20", nilai: 18000000 } },
      { koleksi: "tugas", data: { judul: "Desain sampul katalog", proyek: "@", pic: "@", tenggat: "2026-11-28T17:00:00+08:00" } },
    ],
  },
  ...[logRapat, kalenderKonten, helpdesk, peminjaman, kunjungan, pembelian, armada, inspeksi, eventAcara, keanggotaan].map(dariBerkas),
  // X-15 gelombang 2: per jenis usaha di /untuk dan docs/research/kebutuhan-usaha.md.
  ...[kursus, klinik, laporanProyek, kos, koperasi, orderCetak, rental, katering, agensiRetainer, distributor].map(dariBerkas),
];

/** X-15 saran paket per jenis usaha (kode perusahaan.industri dari halaman Mulai). Urutan = paling cocok dulu, maksimal 4. */
export const SARAN_PAKET: Readonly<Record<string, readonly string[]>> = {
  toko: ["kalender-konten", "keanggotaan", "permintaan-pembelian", "distributor-retur"],
  fnb: ["katering-pesanan", "kalender-konten", "inspeksi-k3", "permintaan-pembelian"],
  kantor: ["proyek-agensi", "agensi-retainer", "log-rapat", "helpdesk-internal"],
  bengkel: ["armada", "rental-unit", "permintaan-pembelian", "inspeksi-k3"],
  klinik: ["klinik-operasional", "helpdesk-internal", "peminjaman", "kalender-konten"],
  konstruksi: ["laporan-proyek", "armada", "inspeksi-k3", "permintaan-pembelian"],
  logistik: ["armada", "distributor-retur", "kunjungan-lapangan", "rental-unit"],
  hotel: ["kos-properti", "event-acara", "helpdesk-internal", "kalender-konten"],
  salon: ["keanggotaan", "kalender-konten", "permintaan-pembelian"],
  laundry: ["kalender-konten", "permintaan-pembelian", "keanggotaan"],
  produksi: ["order-cetak", "inspeksi-k3", "permintaan-pembelian", "distributor-retur"],
  pertanian: ["armada", "permintaan-pembelian", "inspeksi-k3", "koperasi"],
  pendidikan: ["kursus-sekolah", "event-acara", "peminjaman", "kalender-konten"],
  lainnya: ["log-rapat", "koperasi", "event-acara", "kalender-konten"],
};

export const saranPaket = (industri: string | null | undefined): PaketResmi[] =>
  (SARAN_PAKET[industri ?? ""] ?? SARAN_PAKET.lainnya).map(paketResmi).filter((p): p is PaketResmi => p !== null);

export const paketResmi = (kode: string) => KATALOG_RESMI.find((p) => p.manifest.kode === kode) ?? null;
