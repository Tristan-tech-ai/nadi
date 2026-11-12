import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { browserDalamAplikasi, buatNonce, opsiInisialisasi, opsiTombol, sha256Hex } from "./google-gis";

describe("nonce Google", () => {
  it("hash yang dikirim ke Google adalah SHA-256 heksadesimal dari nonce untuk Supabase", async () => {
    const { nonce, hash } = await buatNonce();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash("sha256").update(nonce).digest("hex"));
    expect(hash).not.toBe(nonce);
    expect(atob(nonce)).toHaveLength(32);
  });

  it("acak setiap kali", async () => {
    const a = await buatNonce();
    const b = await buatNonce();
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("sha256Hex cocok dengan vektor uji", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("opsi Google Identity Services", () => {
  it("inisialisasi memakai hash, bukan nonce mentah, dan FedCM", () => {
    const o = opsiInisialisasi("id-klien", "a".repeat(64), "daftar");
    expect(o).toMatchObject({ client_id: "id-klien", nonce: "a".repeat(64), context: "signup", ux_mode: "popup", use_fedcm_for_button: true });
  });

  it("tombol mengikuti mode, bahasa, dan lebar dalam batas Google (200-400)", () => {
    expect(opsiTombol("masuk", "id", 1000)).toMatchObject({ text: "signin_with", locale: "id", width: 400 });
    expect(opsiTombol("daftar", "en", 120)).toMatchObject({ text: "signup_with", locale: "en", width: 200 });
  });
});

describe("browser di dalam aplikasi", () => {
  it.each([
    ["Instagram", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0", true],
    ["Facebook", "Mozilla/5.0 (Linux; Android 14) [FBAN/EMA;FBLC/id_ID;FBAV/400.0]", true],
    ["WebView Android", "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36", true],
    ["Chrome Android", "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36", false],
    ["Safari iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", false],
  ])("%s", (_, ua, harap) => {
    expect(browserDalamAplikasi(ua)).toBe(harap);
  });
});
