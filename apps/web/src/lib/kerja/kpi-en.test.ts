import { describe, expect, it } from "vitest";
import { kalimatTerberat, teksBebanSaya, teksJamBeban } from "./adil";
import { banding, bandingTepat, namaHari, teksBanding, teksNaikTurun } from "./kpi";

describe("kpi dan beban bahasa Inggris", () => {
  it("naik turun dan banding", () => {
    expect(teksNaikTurun(2.5, "en")).toBe("up 2.5");
    expect(teksNaikTurun(-1, "en")).toBe("down 1");
    expect(banding(10, 4, 5, 5, " points", "en")).toEqual({ teks: "up 6 points from last week", arah: "naik" });
    expect(banding(4, 4, 5, 5, "", "en")).toEqual({ teks: "same as last week", arah: "sama" });
    expect(banding(4, 4, 1, 5, "", "en").teks).toBe("not enough work to compare");
    expect(bandingTepat(80, 70, 5, 5, "en")).toEqual({ teks: "up from 70% to 80%", arah: "naik" });
    // Versi Indonesia tidak berubah.
    expect(banding(10, 4, 5, 5, " poin")).toEqual({ teks: "naik 6 poin dari minggu lalu", arah: "naik" });
    expect(bandingTepat(80, 70, 5, 5)).toEqual({ teks: "naik dari 70% ke 80%", arah: "naik" });
  });
  it("hari, status banding, dan beban", () => {
    expect(namaHari("2026-10-20", "en")).toBe("Tuesday");
    expect(teksBanding("menunggu", "en")).toBe("Flagged as wrong, waiting for the owner.");
    expect(teksJamBeban({ poin: 9, jam: 7.5 }, "en")).toEqual({ jam: "7.5 h", perJam: "1.2" });
    expect(teksBebanSaya({ mulai: "", akhir: "", poin: 18, n: 4, rata_rata: 15, di_atas: false }, "en")).toBe("This week 18 points. Team average 15.");
    expect(kalimatTerberat({ terberat: { id: "a", nama: "Sari", porsiPoin: 31, porsiJam: 20 } } as never, false, "en")).toBe("Sari carries 31% of this week's work with 20% of the working hours.");
  });
});
