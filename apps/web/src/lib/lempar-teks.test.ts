import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { TEKS_LEMPAR_PESAN_ID } from "./lempar";

describe("pesan lempar", () => {
  it("bawaan sama dengan kamus id", () => {
    expect(TEKS_LEMPAR_PESAN_ID).toEqual(kamusId.lemparPesan);
  });
});
