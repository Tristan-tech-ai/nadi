import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { bacaCv } from "../../../../supabase/functions/baca-berkas/cv";
import { akurasi } from "../../../../supabase/functions/baca-berkas/ekstraktor";

// H-02: CV adalah jenis berkas dengan token AI terbanyak (docs/quality/rasio-baca.md); tata letak tiap CV berbeda sehingga
// aturan per tata letak tidak pernah terpakai ulang. Pengurai bagian ini membaca CV berteks tanpa model.
const KORPUS = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus", "cv");

async function teksPdf(nama: string) {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(join(KORPUS, nama))));
  return (await extractText(pdf, { mergePages: true })).text as string;
}

describe("bacaCv", () => {
  it("korpus: 4 dari 4 CV dibaca tanpa model dengan semua bidang benar", async () => {
    for (const n of ["cv-01", "cv-02", "cv-03", "cv-04"]) {
      const benar = JSON.parse(readFileSync(join(KORPUS, `${n}.json`), "utf8")).bidang;
      const h = bacaCv(await teksPdf(`${n}.pdf`));
      expect(h, n).not.toBeNull();
      expect(h!.jenis).toBe("cv");
      const a = akurasi(benar, h!.bidang);
      expect(a.cocok, `${n} ${JSON.stringify(h!.bidang)}`).toBe(a.total);
    }
  });

  it("format lain: judul bagian bervariasi, tahun dengan spasi, sampai sekarang, bahasa Inggris", () => {
    const a = bacaCv(`DAFTAR RIWAYAT HIDUP
Rina Marlina
Jl. Melati 3, Mataram, 0813-1111-2222
Posisi yang dilamar: Pelayan
Riwayat Pekerjaan
Pelayan di Rumah Makan Sederhana, 2019 - 2022
Kasir di Kafe Pojok, 2022 - sekarang
Kemampuan
- Melayani pelanggan
- Mengoperasikan kasir
Pendidikan
SMA Negeri 1 Mataram`);
    expect(a?.bidang).toMatchObject({ nama: "Rina Marlina", posisi: "Pelayan", keahlian: ["Melayani pelanggan", "Mengoperasikan kasir"] });
    expect((a?.bidang as { pengalaman: unknown[] }).pengalaman).toEqual([
      { tempat: "Rumah Makan Sederhana", peran: "Pelayan", tahun: "2019-2022" },
      { tempat: "Kafe Pojok", peran: "Kasir", tahun: "2022-sekarang" },
    ]);
    const b = bacaCv(`Budi Santoso
budi@contoh.id
Applying for: Barista
Work Experience
Barista, Kopi Kenangan Senja (2021-2024)
Skills
Latte art
Education
SMK Tata Boga`);
    expect(b?.bidang).toMatchObject({ nama: "Budi Santoso", posisi: "Barista", keahlian: ["Latte art"] });
  });

  it("bukan CV atau tidak yakin: null, jatuh ke model", () => {
    expect(bacaCv("UD Sumber Rejeki\nNo: NT-4671\nTeh celup 25 9 x 9.500 85.500\nTOTAL 376.500")).toBeNull();
    expect(bacaCv("Pengalaman\nbanyak")).toBeNull(); // tanpa nama dan tanpa bagian kedua
    expect(bacaCv("")).toBeNull();
  });
});
