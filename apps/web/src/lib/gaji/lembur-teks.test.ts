import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { JENIS_LEMBUR } from "./lembur";

describe("label jenis lembur", () => {
  it("sama dengan kamus id", () => {
    expect(kamusId.gaji.jenisLembur).toEqual(JENIS_LEMBUR);
  });
});
