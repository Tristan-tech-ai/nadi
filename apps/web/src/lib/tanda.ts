// M-17: isian penanda tangan dan sidik dokumen. Sidik = SHA-256 heksadesimal dari teks UTF-8, sama dengan app.sign_sidik di database
// (encode(digest(convert_to(isi, 'UTF8'), 'sha256'), 'hex')), sehingga salinan bisa dicocokkan di perangkat pemegangnya.

/** Baris "Nama, nomor WhatsApp" menjadi daftar penanda tangan berurutan (paling banyak 50, baris kosong dilewati). */
export function uraiPenanda(teks: string): { nama: string; kontak: string | null }[] {
  return teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean).slice(0, 50).map((b) => {
    const i = b.lastIndexOf(",");
    const kanan = i > 0 ? b.slice(i + 1).trim() : "";
    const nomor = /^[+\d][\d\s-]{6,}$/.test(kanan);
    return { nama: (nomor ? b.slice(0, i) : b).trim().replace(/\s+/g, " "), kontak: nomor ? kanan : null };
  }).filter((p) => p.nama.length >= 2);
}

export async function sidikTeks(isi: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(isi));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Nomor lokal 08xx menjadi 62xx untuk wa.me; selain itu null. */
export function nomorWa(kontak: string | null): string | null {
  const n = (kontak ?? "").replace(/\D/g, "");
  const x = n.startsWith("0") ? `62${n.slice(1)}` : n;
  return /^62\d{8,13}$/.test(x) ? x : null;
}
