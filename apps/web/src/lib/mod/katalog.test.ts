import { describe, expect, it } from "vitest";
import { KATALOG_RESMI } from "./katalog";
import { periksaManifest } from "./pengawas";
import type { Bidang } from "./skema";

// X-14: setiap paket resmi lolos pengawas yang sama dengan buatan pengguna, dan isi contohnya sah menurut aturan yang sama dengan
// app.mod_cek_catatan di database (tipe nilai, pilihan, wajib), supaya uji pasang tidak hanya kebetulan lulus.
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const TANGGAL_JAM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const RUJUKAN = new Set(["orang", "pelanggan", "produk", "proyek", "rujukan"]);

function cekNilai(b: Bidang, v: unknown): string | null {
  if (RUJUKAN.has(b.tipe)) return (b.tipe === "orang" && b.banyak ? Array.isArray(v) && v.every((x) => x === "@") : v === "@") ? null : "rujukan harus \"@\"";
  switch (b.tipe) {
    case "teks": case "teks_panjang": return typeof v === "string" && v.length <= (b.tipe === "teks" ? 500 : 5000) ? null : "bukan teks";
    case "angka": case "rupiah": return typeof v === "number" && (b.min === undefined || v >= b.min) && (b.max === undefined || v <= b.max) && (b.tipe === "angka" || Number.isInteger(v)) ? null : "angka di luar batas";
    case "tanggal": return typeof v === "string" && TANGGAL.test(v) && !Number.isNaN(Date.parse(v)) ? null : "tanggal tidak sah";
    case "tanggal_jam": return typeof v === "string" && TANGGAL_JAM.test(v) ? null : "tanggal-jam tidak sah";
    case "pilihan": return typeof v === "string" && (b.pilihan ?? []).some((p) => p.kode === v) ? null : "pilihan tidak dikenal";
    case "pilihan_banyak": return Array.isArray(v) && v.every((x) => (b.pilihan ?? []).some((p) => p.kode === x)) ? null : "pilihan tidak dikenal";
    case "centang": return typeof v === "boolean" ? null : "harus benar/salah";
    case "tautan": return typeof v === "string" && /^https:\/\/[^\s<>"'`]{3,}$/.test(v) ? null : "tautan harus https";
    case "telepon": return typeof v === "string" && /^\+?[0-9 ()-]{6,20}$/.test(v) ? null : "telepon tidak sah";
    default: return "tipe tidak boleh diisi di contoh";
  }
}

describe("katalog paket resmi", () => {
  it("11 paket (proyek agensi + 10 gelombang 1) dengan kode unik", () => {
    const kode = KATALOG_RESMI.map((p) => p.manifest.kode);
    expect(kode).toEqual(["proyek-agensi", "log-rapat", "kalender-konten", "helpdesk-internal", "peminjaman", "kunjungan-lapangan",
      "permintaan-pembelian", "armada", "inspeksi-k3", "event-acara", "keanggotaan"]);
    expect(new Set(kode).size).toBe(kode.length);
  });

  for (const p of KATALOG_RESMI) {
    describe(p.manifest.kode, () => {
      it("lolos pengawas tanpa alasan", () => expect(periksaManifest(p.manifest)).toEqual([]));
      it("untuk dan contoh terisi, tanpa tanda pisah panjang dan kata terlarang", () => {
        for (const t of [p.untuk, p.contoh]) {
          expect(t.length).toBeGreaterThan(30);
          expect(t).not.toMatch(/[–—]/);
          expect(t.toLowerCase()).not.toMatch(/silakan|revolusioner|inovatif|seamless|all-in-one/);
        }
        expect(JSON.stringify(p.manifest)).not.toMatch(/[–—]/);
      });
      it("isi contoh sah untuk setiap koleksi yang punya bidang wajib", () => {
        expect(p.isi_contoh.length).toBeGreaterThanOrEqual(1);
        for (const [i, c] of p.isi_contoh.entries()) {
          const k = p.manifest.koleksi.find((x) => x.kode === c.koleksi);
          expect(k, `contoh ${i + 1} koleksi ${c.koleksi}`).toBeTruthy();
          for (const [kunci, v] of Object.entries(c.data)) {
            const b = k!.bidang.find((x) => x.kode === kunci);
            expect(b, `${c.koleksi}.${kunci} ada`).toBeTruthy();
            expect(cekNilai(b!, v), `${c.koleksi}.${kunci}`).toBeNull();
          }
          for (const b of k!.bidang.filter((x) => x.wajib)) expect(c.data[b.kode], `${c.koleksi}.${b.kode} wajib`).not.toBeUndefined();
          // Rujukan ke koleksi lain hanya ke koleksi yang contohnya dibuat lebih dulu.
          for (const b of k!.bidang.filter((x) => x.tipe === "rujukan" && c.data[x.kode] !== undefined))
            expect(p.isi_contoh.slice(0, i).some((x) => x.koleksi === b.koleksi), `${c.koleksi}.${b.kode} -> ${b.koleksi}`).toBe(true);
        }
      });
    });
  }
});
