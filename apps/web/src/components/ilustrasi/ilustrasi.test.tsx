import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as Ilustrasi from "./index";

// D-03 (docs/design/DIRECTION.md bagian 6): ilustrasi buatan sendiri bergaya cetakan tinta di kertas: garis tinta, isian kunyit
// datar, tanpa gradien, ringan (< 15 KB per berkas), warna hanya lewat token sehingga ikut mode gelap.
const DIR = __dirname;
const berkas = readdirSync(DIR).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx") && f !== "index.tsx" && f !== "bingkai.tsx");

describe("ilustrasi D-03", () => {
  it("minimal 8 ilustrasi", () => {
    expect(berkas.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(Ilustrasi).filter((k) => k.startsWith("Ilustrasi")).length).toBe(berkas.length);
  });
  it.each(berkas)("%s: < 15 KB, tanpa heksadesimal, tanpa gradien, memakai stabilo kunyit", (f) => {
    const teks = readFileSync(join(DIR, f), "utf8");
    expect(statSync(join(DIR, f)).size).toBeLessThan(15_000);
    expect(teks).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(teks).not.toMatch(/Gradient|gradient/);
    expect(teks).toContain("var(--kunyit)");
  });
  it.each(Object.entries(Ilustrasi).filter(([k]) => k.startsWith("Ilustrasi")))("%s: SVG dekoratif dengan viewBox", (_, Komponen) => {
    const html = renderToStaticMarkup(<Komponen />);
    expect(html).toMatch(/^<svg[^>]*viewBox="0 0 160 120"/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/<text/);
  });
});
