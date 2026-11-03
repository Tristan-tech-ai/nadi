import { describe, expect, it } from "vitest";
import { tahapLempar } from "./lempar-tahap";

describe("tahap lempar", () => {
  it("hanya luring yang tertahan dan dikirim ulang saat online", () => {
    expect(tahapLempar("luring")).toEqual({ tertahan: true, berjalan: false });
    expect(tahapLempar("unggah")).toEqual({ tertahan: false, berjalan: true });
    expect(tahapLempar("selesai")).toEqual({ tertahan: false, berjalan: false });
  });
});
