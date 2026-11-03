import { describe, expect, it } from "vitest";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { kamusId } from "@/lib/i18n/kamus/id";
import { nilaiWajah } from "./wajah";

describe("alasan cek wajah dua bahasa", () => {
  it("bawaan sama dengan kamus id, en ikut kamus en", () => {
    const dua = [{ wajah: 2, kedip: 0, yaw: 0 }];
    expect(nilaiWajah(dua, "kiri").alasan).toBe(kamusId.absen.duaWajah);
    expect(nilaiWajah(dua, "kiri", kamusEn.absen).alasan).toBe(kamusEn.absen.duaWajah);
  });
});
