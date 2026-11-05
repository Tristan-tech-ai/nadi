import { describe, expect, test } from "vitest";
import { alamatKamera, alamatLokal, jembatanSah, konfigJembatan, NAMA_ALIRAN } from "./jembatan";

// W-10A: pola alamat RTSP per merek dari manual resmi (docs/research/mata-cctv.md), dan berkas go2rtc yang aman dibiarkan menyala.
describe("alamat kamera per merek", () => {
  test("Hikvision: Streaming/Channels kanal x 100 + jenis aliran", () => {
    expect(alamatKamera({ merek: "hikvision", alamat: "192.168.1.64", pengguna: "admin", sandi: "Rahasia1", kecil: false })).toEqual({ ok: true, url: "rtsp://admin:Rahasia1@192.168.1.64:554/Streaming/Channels/101" });
    expect(alamatKamera({ merek: "hikvision", alamat: "192.168.1.64", pengguna: "admin", sandi: "x", kanal: 12, kecil: true })).toEqual({ ok: true, url: "rtsp://admin:x@192.168.1.64:554/Streaming/Channels/1202" });
  });
  test("Dahua: cam/realmonitor channel dan subtype", () => {
    expect(alamatKamera({ merek: "dahua", alamat: "10.0.0.8", pengguna: "admin", sandi: "a", kanal: 3, kecil: true })).toEqual({ ok: true, url: "rtsp://admin:a@10.0.0.8:554/cam/realmonitor?channel=3&subtype=1" });
  });
  test("EZVIZ: pengguna admin, kode verifikasi, ch1/main", () => {
    expect(alamatKamera({ merek: "ezviz", alamat: "192.168.0.20", pengguna: "abaikan", sandi: "ABCDEF" })).toEqual({ ok: true, url: "rtsp://admin:ABCDEF@192.168.0.20:554/ch1/main" });
  });
  test("Tapo: stream1 utama, stream2 kecil", () => {
    expect(alamatKamera({ merek: "tapo", alamat: "192.168.1.5", pengguna: "kamera1", sandi: "sandi123", kecil: false })).toEqual({ ok: true, url: "rtsp://kamera1:sandi123@192.168.1.5:554/stream1" });
    expect(alamatKamera({ merek: "tapo", alamat: "192.168.1.5", pengguna: "kamera1", sandi: "sandi123", kecil: true })).toMatchObject({ url: expect.stringMatching(/\/stream2$/) });
  });
  test("kata sandi dengan @ : / dikodekan, tidak memecah alamat", () => {
    const h = alamatKamera({ merek: "dahua", alamat: "192.168.1.9", pengguna: "admin", sandi: "a@b:c/d" });
    expect(h).toEqual({ ok: true, url: "rtsp://admin:a%40b%3Ac%2Fd@192.168.1.9:554/cam/realmonitor?channel=1&subtype=0" });
    expect(new URL((h as { url: string }).url).hostname).toBe("192.168.1.9");
  });
  test("alamat RTSP lengkap hanya ke jaringan toko", () => {
    expect(alamatKamera({ merek: "lengkap", alamat: "rtsp://u:p@192.168.1.70:554/live" })).toMatchObject({ ok: true });
    expect(alamatKamera({ merek: "lengkap", alamat: "rtsp://kamera.contoh-publik.id/live" })).toEqual({ ok: false, galat: "alamat" });
    expect(alamatKamera({ merek: "lengkap", alamat: "http://192.168.1.70/video" })).toEqual({ ok: false, galat: "alamat" });
    expect(alamatKamera({ merek: "lengkap", alamat: "bukan alamat" })).toEqual({ ok: false, galat: "alamat" });
  });
  test("isian kurang atau di luar jaringan toko ditolak", () => {
    expect(alamatKamera({ merek: "hikvision", alamat: "8.8.8.8", pengguna: "a", sandi: "b" })).toEqual({ ok: false, galat: "alamat" });
    expect(alamatKamera({ merek: "hikvision", alamat: "192.168.1.300", pengguna: "a", sandi: "b" })).toEqual({ ok: false, galat: "alamat" });
    expect(alamatKamera({ merek: "hikvision", alamat: "192.168.1.3", pengguna: "", sandi: "b" })).toEqual({ ok: false, galat: "pengguna" });
    expect(alamatKamera({ merek: "tapo", alamat: "192.168.1.3", pengguna: "a", sandi: "" })).toEqual({ ok: false, galat: "sandi" });
    expect(alamatKamera({ merek: "dahua", alamat: "192.168.1.3", pengguna: "a", sandi: "b", kanal: 0 })).toEqual({ ok: false, galat: "kanal" });
  });
  test("alamat lokal: RFC 1918, loopback, .local", () => {
    for (const h of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.100.1", "127.0.0.1", "nvr-toko.local"]) expect(alamatLokal(h), h).toBe(true);
    for (const h of ["172.32.0.1", "11.0.0.1", "203.0.113.5", "kamera.id", "local", "192.168.1"]) expect(alamatLokal(h), h).toBe(false);
  });
});

describe("berkas go2rtc", () => {
  const k = konfigJembatan("rtsp://admin:a\"b@192.168.1.64:554/Streaming/Channels/102");
  test("tanpa modul exec/echo, API hanya 127.0.0.1 dan hanya /api/webrtc, tanpa STUN publik", () => {
    expect(k).toContain("  modules: [api, rtsp, webrtc]\n");
    expect(k).not.toMatch(/exec|echo/);
    expect(k).toContain('  listen: "127.0.0.1:1984"\n');
    expect(k).toContain("  allow_paths: [/api/webrtc]\n");
    expect(k).toContain('  listen: "127.0.0.1:8554"\n');
    expect(k).toContain("  ice_servers: []\n");
  });
  test("alamat kamera dikutip YAML dengan aman", () => {
    expect(k).toContain(`  ${NAMA_ALIRAN}: "rtsp://admin:a\\"b@192.168.1.64:554/Streaming/Channels/102"\n`);
    expect(k.split("\n").filter((l) => l.startsWith("  mata:"))).toHaveLength(1);
  });
  test("alamat jembatan hanya di komputer ini", () => {
    for (const a of ["http://127.0.0.1:1984", "http://localhost:1984/", "http://[::1]:1984"]) expect(jembatanSah(a), a).toBe(true);
    for (const a of ["https://127.0.0.1:1984", "http://192.168.1.2:1984", "http://127.0.0.1:1984/api", "http://evil.test", "http://u:p@127.0.0.1:1984", "x"]) expect(jembatanSah(a), a).toBe(false);
  });
});
