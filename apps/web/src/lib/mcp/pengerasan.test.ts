import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bacaLangganan } from "../push";

vi.mock("server-only", () => ({}));
const { ambilTeksAman, ipTerlarang, lookupAman } = await import("./cimd");
const { asalTautan: asal } = await import("./http");

// Q-14 (docs/quality/keamanan-f0.md A6 dan RENDAH): SSRF CIMD, daftar izin host push, asal tautan dari konfigurasi.
describe("ipTerlarang: bentuk IPv6 yang membawa IPv4 privat", () => {
  it("NAT64, 6to4, kompatibel-IPv4, dan ::ffff: heksadesimal ditolak", () => {
    for (const ip of ["64:ff9b::7f00:1", "64:ff9b::a00:1", "2002:7f00:1::1", "2002:c0a8:101::", "::7f00:1", "::ffff:7f00:1", "0:0:0:0:0:ffff:10.0.0.1"]) expect(ipTerlarang(ip), ip).toBe(true);
  });
  it("NAT64/6to4 yang membawa alamat publik dan IPv6 publik tetap boleh", () => {
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "64:ff9b::808:808", "2002:808:808::1", "8.8.8.8"]) expect(ipTerlarang(ip), ip).toBe(false);
  });
});

describe("lookupAman: IP diperiksa saat koneksi dibuka (anti DNS rebinding)", () => {
  it("host yang menunjuk loopback ditolak", async () => {
    const galat = await new Promise<Error | null>((r) => lookupAman("localhost", {}, (e) => r(e)));
    expect(galat?.message).toMatch(/tidak diizinkan/);
  });
  it("bentuk all: true juga diperiksa", async () => {
    const galat = await new Promise<Error | null>((r) => lookupAman("localhost", { all: true }, (e) => r(e)));
    expect(galat?.message).toMatch(/tidak diizinkan/);
  });
});

describe("ambilTeksAman: body dibaca bertahap dan dipotong di 5 KB", () => {
  let tutup: (() => void) | null = null;
  afterEach(() => tutup?.());
  it("dokumen lebih dari 5 KB ditolak tanpa membaca semuanya; dokumen kecil terbaca", async () => {
    // Batas jauh di atas buffer soket kernel (Linux CI bisa menampung sekitar 1 MB sebelum klien menutup); yang diuji: pengiriman berhenti, tidak dibaca habis.
    const TOTAL = 32 * 1024 * 1024;
    let terkirim = 0;
    const server = createServer((req, res) => {
      if (req.url === "/besar") {
        res.writeHead(200, { "content-type": "application/json" });
        const kirim = () => { while (terkirim < TOTAL && res.write("x".repeat(1024))) terkirim += 1024; if (terkirim < TOTAL) res.once("drain", kirim); else res.end(); };
        kirim();
      } else res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    tutup = () => server.close();
    const port = (server.address() as AddressInfo).port;
    await expect(ambilTeksAman(new URL(`http://127.0.0.1:${port}/besar`), { lokal: true })).rejects.toThrow(/lebih dari 5 KB/);
    expect(terkirim).toBeLessThan(TOTAL);
    expect(await ambilTeksAman(new URL(`http://127.0.0.1:${port}/kecil`), { lokal: true })).toEqual({ status: 200, teks: '{"ok":true}' });
  });
});

describe("bacaLangganan: hanya host layanan push yang dikenal", () => {
  const kunci = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
  it("FCM, Mozilla, Apple, WNS diterima", () => {
    for (const e of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/QG2", "https://wns2-bl2p.notify.windows.com/w/?token=abc"]) {
      expect(bacaLangganan({ endpoint: e, keys: kunci }), e).not.toBeNull();
    }
  });
  it("host lain, termasuk tiruan akhiran, ditolak", () => {
    for (const e of ["https://169.254.169.254/latest", "https://internal.local/x", "https://fcm.googleapis.com.jahat.example/x", "https://evilpush.apple.com.example/x", "https://notify.windows.com.example/x"]) {
      expect(bacaLangganan({ endpoint: e, keys: kunci }), e).toBeNull();
    }
  });
});

describe("asal: tautan memakai asal dari konfigurasi bila ada", () => {
  afterEach(() => vi.unstubAllEnvs());
  const palsu = new Headers({ "x-forwarded-host": "jahat.example", "x-forwarded-proto": "https" });
  it("NADI_ASAL menang atas header", () => {
    vi.stubEnv("NADI_ASAL", "https://nadi.contoh.id/");
    expect(asal(palsu)).toBe("https://nadi.contoh.id");
  });
  it("di produksi Vercel memakai VERCEL_PROJECT_PRODUCTION_URL", () => {
    vi.stubEnv("NADI_ASAL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "nadi-contoh.vercel.app");
    expect(asal(palsu)).toBe("https://nadi-contoh.vercel.app");
  });
  it("lokal tanpa konfigurasi tetap dari header", () => {
    vi.stubEnv("NADI_ASAL", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(asal(new Headers({ host: "localhost:3100" }))).toBe("http://localhost:3100");
  });
});
