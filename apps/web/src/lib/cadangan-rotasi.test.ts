import { describe, expect, it } from "vitest";
import { folderRotasi } from "../../../../supabase/functions/cadangan/rotasi";

// Q-03B: rotasi tidak pernah menghapus 8 cadangan terbaru, hanya yang lebih tua dari 56 hari.
const minggu = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 1) - i * 7 * 86_400_000).toISOString().slice(0, 10));

describe("folderRotasi", () => {
  it("8 minggu atau kurang: tidak ada yang dihapus", () => {
    expect(folderRotasi(minggu(8), "2026-11-01")).toEqual([]);
  });
  it("10 minggu: hanya yang lebih dari 56 hari dihapus (tepat 56 hari disimpan)", () => {
    expect(folderRotasi(minggu(10), "2026-11-01")).toEqual(["2026-08-30"]);
  });
  it("cadangan lama tetap disimpan bila belum ada 8 yang lebih baru", () => {
    expect(folderRotasi(["2026-01-04", "2026-11-01"], "2026-11-01")).toEqual([]);
  });
  it("nama bukan tanggal diabaikan", () => {
    expect(folderRotasi([...minggu(10), "manifest.json"], "2026-11-01")).not.toContain("manifest.json");
  });
});
