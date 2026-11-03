import { describe, expect, it } from "vitest";
import { kamusEn } from "@/lib/i18n/kamus/en";
import { kamusId } from "@/lib/i18n/kamus/id";
import { TEKS_KARTU_ID } from "./kartu-usulan";

describe("teks kartu usulan", () => {
  it("bawaan sama dengan kamus id dan kuncinya sama dengan kamus en", () => {
    expect(TEKS_KARTU_ID).toEqual(kamusId.kartu);
    expect(Object.keys(kamusEn.kartu).sort()).toEqual(Object.keys(TEKS_KARTU_ID).sort());
  });
});
