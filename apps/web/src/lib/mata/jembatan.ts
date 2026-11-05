// W-10A Mata dari CCTV lewat jembatan lokal go2rtc (MIT, github.com/AlexxIT/go2rtc v1.9.15, dibaca 6 Nov 2026).
// Peramban tidak bisa membuka RTSP. Jembatan di komputer toko membaca kamera lalu memberi WebRTC ke halaman Mata di komputer yang
// sama (http://127.0.0.1:1984). Berkas konfigurasi dibuat di peramban dan diunduh; alamat kamera berikut kata sandinya tidak pernah
// dikirim ke Nadi, dan video tidak pernah keluar dari jaringan toko. Pola alamat per merek dari manual resmi: docs/research/mata-cctv.md.

export type Merek = "hikvision" | "dahua" | "ezviz" | "tapo" | "lengkap";
export const MEREK: Merek[] = ["hikvision", "dahua", "ezviz", "tapo", "lengkap"];
export const NAMA_ALIRAN = "mata";
export const ALAMAT_JEMBATAN = "http://127.0.0.1:1984";

export type IsianKamera = {
  merek: Merek;
  /** Alamat IP kamera di jaringan toko (untuk merek), atau alamat RTSP lengkap (untuk "lengkap"). */
  alamat: string;
  pengguna?: string;
  sandi?: string;
  /** Kanal NVR/DVR, mulai 1. Kamera tunggal = 1. */
  kanal?: number;
  /** Aliran kecil (sub stream): cukup untuk Mata yang membaca 160 px dan lebih ringan untuk jaringan. */
  kecil?: boolean;
};

export type HasilAlamat = { ok: true; url: string } | { ok: false; galat: "alamat" | "pengguna" | "sandi" | "kanal" };

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Kamera harus di jaringan toko: IPv4 pribadi (RFC 1918), loopback, atau nama .local. Alamat publik ditolak (video tidak lewat internet). */
export function alamatLokal(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/.test(h)) return true;
  const m = IPV4.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m.slice(1).some((x) => Number(x) > 255)) return false;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

const kode = (s: string) => encodeURIComponent(s);

/** Alamat RTSP dari pola manual resmi tiap merek. */
export function alamatKamera(k: IsianKamera): HasilAlamat {
  const kanal = k.kanal ?? 1;
  if (!Number.isInteger(kanal) || kanal < 1 || kanal > 64) return { ok: false, galat: "kanal" };
  if (k.merek === "lengkap") {
    let u: URL;
    try {
      u = new URL(k.alamat.trim());
    } catch {
      return { ok: false, galat: "alamat" };
    }
    if (!["rtsp:", "rtsps:"].includes(u.protocol) || !alamatLokal(u.hostname)) return { ok: false, galat: "alamat" };
    return { ok: true, url: u.toString() };
  }
  const ip = k.alamat.trim();
  if (!alamatLokal(ip)) return { ok: false, galat: "alamat" };
  const sandi = k.sandi ?? "";
  if (!sandi) return { ok: false, galat: "sandi" };
  // EZVIZ: pengguna selalu admin, sandi = kode verifikasi 6 huruf di label (atau sandi enkripsi yang sudah diganti).
  const pengguna = k.merek === "ezviz" ? "admin" : (k.pengguna ?? "").trim();
  if (!pengguna) return { ok: false, galat: "pengguna" };
  const awal = `rtsp://${kode(pengguna)}:${kode(sandi)}@${ip}:554`;
  switch (k.merek) {
    case "hikvision":
      // ID = kanal x 100 + jenis aliran (1 utama, 2 kecil).
      return { ok: true, url: `${awal}/Streaming/Channels/${kanal * 100 + (k.kecil ? 2 : 1)}` };
    case "dahua":
      return { ok: true, url: `${awal}/cam/realmonitor?channel=${kanal}&subtype=${k.kecil ? 1 : 0}` };
    case "ezviz":
      // Manual EZVIZ hanya menyebut aliran utama ch1/main.
      return { ok: true, url: `${awal}/ch1/main` };
    case "tapo":
      return { ok: true, url: `${awal}/${k.kecil ? "stream2" : "stream1"}` };
  }
}

const yamlTeks = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Berkas go2rtc.yaml. Modul hanya api, rtsp, webrtc (tanpa exec/echo yang bisa menjalankan program); API hanya di 127.0.0.1 dan hanya
 * jalur /api/webrtc yang dibuka, sehingga halaman lain di peramban tidak bisa menambah sumber atau membaca daftar kamera. CORS "*"
 * diperlukan karena halaman Mata ada di domain Nadi; Chrome tetap meminta izin akses jaringan lokal dari pemilik.
 */
export function konfigJembatan(url: string): string {
  return [
    "# Jembatan kamera untuk Mata (Nadi). Dibuat di peramban; berkas ini dan kata sandi kamera tidak pernah dikirim ke Nadi.",
    "# Jalankan go2rtc.exe di folder yang sama dengan berkas ini, lalu buka halaman Mata di komputer ini.",
    "app:",
    "  modules: [api, rtsp, webrtc]",
    "api:",
    '  listen: "127.0.0.1:1984"',
    '  origin: "*"',
    "  allow_paths: [/api/webrtc]",
    "rtsp:",
    '  listen: "127.0.0.1:8554"',
    "webrtc:",
    '  listen: ":8555"',
    "  ice_servers: []",
    "streams:",
    `  ${NAMA_ALIRAN}: ${yamlTeks(url)}`,
    "",
  ].join("\n");
}

/** Alamat jembatan hanya boleh di komputer ini. */
export function jembatanSah(alamat: string): boolean {
  try {
    const u = new URL(alamat);
    return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) && u.pathname === "/" && !u.search && !u.username;
  } catch {
    return false;
  }
}

/**
 * Buka aliran WebRTC dari jembatan (go2rtc POST /api/webrtc?src=, SDP mentah: permintaan sederhana tanpa preflight). Hanya di peramban.
 * Mengembalikan aliran video dan fungsi tutup.
 */
export async function bukaJembatan(alamat: string, nama = NAMA_ALIRAN, batasMs = 10_000): Promise<{ aliran: MediaStream; pc: RTCPeerConnection }> {
  if (!jembatanSah(alamat)) throw new Error("alamat");
  const pc = new RTCPeerConnection();
  try {
    pc.addTransceiver("video", { direction: "recvonly" });
    const jalur = new Promise<MediaStream>((ok) => {
      pc.addEventListener("track", (e) => ok(e.streams[0] ?? new MediaStream([e.track])), { once: true });
    });
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise<void>((ok) => {
      if (pc.iceGatheringState === "complete") return ok();
      pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && ok());
      setTimeout(ok, 2000);
    });
    const r = await fetch(`${new URL(alamat).origin}/api/webrtc?src=${encodeURIComponent(nama)}`, { method: "POST", body: pc.localDescription!.sdp });
    if (!r.ok) throw new Error(`jembatan ${r.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await r.text() });
    const aliran = await Promise.race([jalur, new Promise<never>((_, gagal) => setTimeout(() => gagal(new Error("waktu")), batasMs))]);
    return { aliran, pc };
  } catch (e) {
    pc.close();
    throw e;
  }
}
