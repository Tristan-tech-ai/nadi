import { describe, expect, it } from "vitest";
import { bacaLangganan, bytesDariBase64Url, namaPerangkat } from "./push";

describe("bytesDariBase64Url", () => {
  it("mengurai base64url tanpa padding", () => {
    expect(Array.from(bytesDariBase64Url("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
  it("kunci VAPID 87 karakter menjadi 65 byte titik P-256 tak terkompresi", () => {
    const kunci = "B" + "A".repeat(86);
    const b = bytesDariBase64Url(kunci);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });
});

describe("bacaLangganan", () => {
  const sah = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcR_x-1", auth: "tBHI-tq9" } };
  it("menerima bentuk toJSON yang sah", () => {
    expect(bacaLangganan(sah)).toEqual({ endpoint: sah.endpoint, p256dh: "BNcR_x-1", auth: "tBHI-tq9" });
  });
  it("menolak endpoint bukan https", () => {
    expect(bacaLangganan({ ...sah, endpoint: "http://contoh.test/x" })).toBeNull();
  });
  it("menolak kunci yang hilang atau berisi karakter asing", () => {
    expect(bacaLangganan({ endpoint: sah.endpoint })).toBeNull();
    expect(bacaLangganan({ ...sah, keys: { p256dh: "<script>", auth: "x" } })).toBeNull();
    expect(bacaLangganan(null)).toBeNull();
    expect(bacaLangganan("teks")).toBeNull();
  });
});

describe("namaPerangkat", () => {
  it("mengenali HP Android dengan Chrome", () => {
    expect(namaPerangkat("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36")).toBe("Android, Chrome");
  });
  it("mengenali iPhone dengan Safari", () => {
    expect(namaPerangkat("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iPhone, Safari");
  });
  it("mengenali Edge di Windows", () => {
    expect(namaPerangkat("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Windows, Edge");
  });
  it("tetap memberi nama untuk user agent asing", () => {
    expect(namaPerangkat("")).toBe("Perangkat");
  });
});
