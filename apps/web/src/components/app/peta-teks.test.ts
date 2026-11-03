import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { TEKS_PETA_ID } from "./peta-usaha";

describe("teks peta usaha", () => {
  it("bawaan sama dengan kamus id", () => {
    expect(TEKS_PETA_ID).toEqual(kamusId.petaDenah);
  });
});
