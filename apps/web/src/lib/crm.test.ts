import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { aktif, nilaiTerbuka, SEMUA_TAHAP, TAHAP_AKTIF } from "./crm";

describe("tahap deal", () => {
  test("sama dengan check constraint public.deal.tahap di migrasi crm", () => {
    const sql = readFileSync(join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261105077000_crm.sql"), "utf8");
    const m = sql.match(/tahap text not null default 'prospek' check \(tahap in \(([^)]+)\)\)/);
    expect(m?.[1].split(",").map((x) => x.trim().replace(/'/g, ""))).toEqual([...SEMUA_TAHAP]);
  });
  test("tahap aktif dan nilai berjalan", () => {
    expect(TAHAP_AKTIF.every(aktif)).toBe(true);
    expect(aktif("menang") || aktif("kalah")).toBe(false);
    expect(nilaiTerbuka({ prospek: { nilai: 1000 }, penawaran: { nilai: 15000000 }, menang: { nilai: 99 } })).toBe(15001000);
  });
});
