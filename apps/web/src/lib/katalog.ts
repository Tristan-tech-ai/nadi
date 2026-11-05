// M-16B: tautan pesan WhatsApp dari katalog publik (tanpa WhatsApp API). Format resmi tautan klik-untuk-chat: https://wa.me/<nomor>
// dengan nomor format internasional tanpa +, nol, tanda kurung, atau tanda hubung, dan ?text= berisi teks yang di-URL-encode.
export function tautanWa(nomor: string, teks: string): string | null {
  const n = nomor.replace(/\D/g, "");
  if (!/^62\d{8,13}$/.test(n)) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(teks.slice(0, 1000))}`;
}

/** Hari ISO (1 Senin sampai 7 Minggu) dari tanggal YYYY-MM-DD, sama dengan extract(isodow) di database. */
export function hariIso(tanggal: string): number {
  const d = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
