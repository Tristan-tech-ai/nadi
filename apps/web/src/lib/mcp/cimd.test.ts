import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { adalahCimd, ipTerlarang, urlClientIdSah, validasiDokumen } = await import("./cimd");

const ID = "https://klien.contoh.id/oauth/klien.json";

describe("CIMD", () => {
  it("bentuk client_id: https berpath; http hanya untuk uji lokal", () => {
    expect(adalahCimd(ID)).toBe(true);
    expect(adalahCimd("nkc_abc")).toBe(false);
    expect(urlClientIdSah(ID, false)).not.toBeNull();
    expect(urlClientIdSah("https://klien.contoh.id/", false)).toBeNull();
    expect(urlClientIdSah("https://klien.contoh.id/a.json#x", false)).toBeNull();
    expect(urlClientIdSah("https://u:p@klien.contoh.id/a.json", false)).toBeNull();
    expect(urlClientIdSah("http://localhost:4010/klien.json", false)).toBeNull();
    expect(urlClientIdSah("http://localhost:4010/klien.json", true)).not.toBeNull();
    expect(urlClientIdSah("http://evil.contoh.id/klien.json", true)).toBeNull();
  });
  it("alamat privat, loopback, link-local, metadata awan ditolak; publik diterima", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(ipTerlarang(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "104.18.2.3", "2606:4700::1111"]) expect(ipTerlarang(ip), ip).toBe(false);
  });
  it("dokumen: client_id harus sama persis, nama dan redirect wajib, hanya klien publik", () => {
    const sah = { client_id: ID, client_name: "Asisten Uji", redirect_uris: ["http://127.0.0.1:3000/callback"], token_endpoint_auth_method: "none" };
    expect(validasiDokumen(ID, sah)).toEqual({ ok: true, klien: { clientId: ID, nama: "Asisten Uji", redirectUris: ["http://127.0.0.1:3000/callback"] } });
    expect(validasiDokumen(ID, { ...sah, client_id: ID + "x" })).toMatchObject({ ok: false });
    expect(validasiDokumen(ID, { ...sah, client_name: "" })).toMatchObject({ ok: false });
    expect(validasiDokumen(ID, { ...sah, redirect_uris: [] })).toMatchObject({ ok: false });
    expect(validasiDokumen(ID, { ...sah, token_endpoint_auth_method: "client_secret_basic" })).toMatchObject({ ok: false });
    expect(validasiDokumen(ID, [sah])).toMatchObject({ ok: false });
  });
});
