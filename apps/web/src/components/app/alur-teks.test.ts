import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { TEKS_ALUR_ID } from "./alur-nyata";

describe("teks alur", () => {
  it("bawaan sama dengan kamus id", () => {
    expect(TEKS_ALUR_ID).toEqual(kamusId.alur);
  });
});
