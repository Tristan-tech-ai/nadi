import { describe, expect, it } from "vitest";
import { BUKTI, FAQ, HARI, PERAN, SEDANG_DIBUAT } from "./isi";

const menit = (j: string) => (/^\d\d\.\d\d$/.test(j) ? Number(j.slice(0, 2)) * 60 + Number(j.slice(3)) : Infinity);
const semuaTeks = [
  ...HARI.flatMap((h) => [h.kejadian, h.nadi]), ...PERAN.flatMap((p) => [p.ringkas, ...p.fitur]),
  ...BUKTI.flatMap((b) => [b.angka, b.isi]), ...FAQ.flatMap((f) => [f.tanya, f.jawab]), ...SEDANG_DIBUAT,
];

describe("isi landing", () => {
  it("satu hari urut jam, akhir bulan paling akhir", () => {
    const m = HARI.map((h) => menit(h.jam));
    expect([...m].sort((a, b) => a - b)).toEqual(m);
    expect(HARI.at(-1)?.jam).toBe("Akhir bulan");
  });
  it("empat peran, masing-masing minimal 4 fitur", () => {
    expect(PERAN.map((p) => p.peran)).toEqual(["Pemilik", "Admin", "Staf", "Akuntan"]);
    for (const p of PERAN) expect(p.fitur.length).toBeGreaterThanOrEqual(4);
  });
  it("tanpa tanda pisah panjang, emoji, atau kata terlarang", () => {
    const terlarang = /[\u2014\u2013]|silakan|revolusioner|inovatif|all-in-one|seamless|\p{Extended_Pictographic}/iu;
    for (const t of semuaTeks) expect(t).not.toMatch(terlarang);
  });
  it("tidak ada fitur yang sudah jadi masih ditulis sedang dibuat", () => {
    const sudah = /absen|gaji|topi|invoice|jadwal|izin|cctv|bahasa inggris/i;
    for (const s of SEDANG_DIBUAT) expect(s).not.toMatch(sudah);
  });
});
