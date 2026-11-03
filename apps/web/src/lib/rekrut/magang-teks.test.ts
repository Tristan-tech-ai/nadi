import { describe, expect, it } from "vitest";
import { kamusId } from "@/lib/i18n/kamus/id";
import { formatLamaMenit, STATUS_RENCANA } from "./magang";

describe("teks magang", () => {
  it("status sama dengan kamus id dan lama menit dua bahasa", () => {
    expect(kamusId.magang.status).toEqual(STATUS_RENCANA);
    expect(formatLamaMenit(90)).toBe("1 jam 30 menit");
    expect(formatLamaMenit(90, "en")).toBe("1 h 30 min");
    expect(formatLamaMenit(45, "en")).toBe("45 min");
  });
});
