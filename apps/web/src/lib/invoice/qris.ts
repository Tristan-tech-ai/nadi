// Pembaca QRIS statis milik pemilik (docs/research/invoice.md). Struktur EMV MPM: objek = ID 2 digit + panjang 2 digit + nilai;
// CRC ID 63 menurut ISO/IEC 13239 (polinomial 1021, awal FFFF) atas semua objek termasuk "6304". Nadi tidak pernah mengubah
// isi QR (tidak menyisipkan nominal): yang ditampilkan ke pembayar adalah QR asli pemilik.

/** CRC-16 ISO/IEC 13239 (polinomial 0x1021, awal 0xFFFF) dalam 4 huruf heks kapital. */
export function crc16(teks: string): string {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(teks)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Satu objek TLV EMV: ID + panjang 2 digit + nilai. */
export function tlv(id: string, nilai: string): string {
  return `${id}${String(nilai.length).padStart(2, "0")}${nilai}`;
}

/** Urai TLV satu tingkat; null bila panjang objek melewati akhir teks atau tidak berbentuk angka. */
function urai(teks: string): Map<string, string> | null {
  const m = new Map<string, string>();
  let i = 0;
  while (i < teks.length) {
    const id = teks.slice(i, i + 2);
    const pj = teks.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(pj)) return null;
    const akhir = i + 4 + Number(pj);
    if (akhir > teks.length) return null;
    m.set(id, teks.slice(i + 4, akhir));
    i = akhir;
  }
  return m;
}

export type HasilQris = { ok: true; nama: string; kota: string; nmid: string | null } | { ok: false; galat: string };

/** Periksa isi QR stiker QRIS: harus QRIS statis rupiah Indonesia tanpa nominal dengan CRC cocok. */
export function uraiQris(isi: string): HasilQris {
  const p = (isi ?? "").trim();
  const bukan: HasilQris = { ok: false, galat: "Ini bukan QRIS. Foto stiker QRIS usahamu dari dekat, pastikan kotaknya utuh." };
  if (!p.startsWith("000201") || p.length < 30) return bukan;
  const m = urai(p);
  if (!m || !m.has("63") || !p.endsWith(`63${"04"}${m.get("63")}`)) return bukan;
  if (crc16(p.slice(0, -4)) !== (m.get("63") ?? "").toUpperCase()) {
    return { ok: false, galat: "Isi QR terbaca tapi rusak (kode periksa tidak cocok). Foto ulang lebih terang dan lebih dekat." };
  }
  if ((m.has("01") && m.get("01") !== "11") || m.has("54")) {
    return { ok: false, galat: "QR ini hanya berlaku sekali (sudah bernominal). Pakai stiker QRIS tetap usahamu, bukan QR dari mesin kasir." };
  }
  if (m.get("58") !== "ID" || m.get("53") !== "360") return { ok: false, galat: "Ini bukan QRIS rupiah Indonesia." };
  const nama = (m.get("59") ?? "").trim();
  if (!nama) return bukan;
  let nmid: string | null = null;
  for (const [id, v] of m) {
    if (Number(id) < 26 || Number(id) > 51) continue;
    const sub = urai(v);
    if (sub?.get("00") === "ID.CO.QRIS.WWW" && sub.get("02")) nmid = sub.get("02") ?? null;
  }
  return { ok: true, nama, kota: (m.get("60") ?? "").trim(), nmid };
}
