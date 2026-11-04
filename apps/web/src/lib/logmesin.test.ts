import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { xlsxKeTeks } from "../../../../supabase/functions/baca-berkas/inti";
import { bacaLogMesin, waktuLog } from "../../../../supabase/functions/baca-berkas/logmesin";

// M-12: korpus fixtures/korpus/logmesin (node scripts/korpus/logmesin.mjs): tiga tata letak ekspor mesin absen.
const akar = join(__dirname, "..", "..", "..", "..", "fixtures", "korpus", "logmesin");
const teks = (b: string) => (b.endsWith(".xlsx") ? xlsxKeTeks(unzipSync(readFileSync(join(akar, b)))) : readFileSync(join(akar, b), "utf8"));

describe("log mesin absen tanpa model", () => {
  for (const b of ["log-01.csv", "log-02.csv", "log-03.xlsx"]) {
    it(`${b}: rekap per orang per hari sama persis dengan jawaban`, () => {
      const jawab = JSON.parse(readFileSync(join(akar, b.replace(/\.\w+$/, ".json")), "utf8")).bidang.baris;
      const h = bacaLogMesin(teks(b));
      expect(h?.jenis).toBe("absen");
      expect(h!.bidang.baris).toEqual(jawab);
    });
  }
  it("format waktu umum", () => {
    expect(waktuLog("04/11/2026 07:58")).toEqual(["2026-11-04", 478]);
    expect(waktuLog("2026-11-04 17:05:12")).toEqual(["2026-11-04", 1025]);
    expect(waktuLog("4-11-2026 7.05")).toEqual(["2026-11-04", 425]);
    expect(waktuLog("31/13/2026 07:58")).toBeNull();
  });
  it("bukan log mesin (rekap absen biasa, nota) tidak diaku", () => {
    expect(bacaLogMesin("Nama,Tanggal,Masuk,Pulang\nSari,2026-11-04,07.58,17.02")).toBeNull();
    expect(bacaLogMesin("UD Sumber Rejeki\nTotal 376.500")).toBeNull();
  });
});
