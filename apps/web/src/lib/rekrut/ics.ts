// M-14: berkas kalender .ics untuk undangan wawancara (RFC 5545, dibaca 6 Nov 2026). Tanpa METHOD: berkas ini salinan acara untuk
// disimpan ke kalender, bukan transaksi penjadwalan iTIP (Pasal 3.7.2). Baris dipisah CRLF dan dilipat sebelum 75 oktet (Pasal 3.1);
// TEXT meng-escape backslash, titik koma, koma, dan baris baru sebagai \n (Pasal 3.3.11); waktu UTC berakhiran Z (Pasal 3.3.5).

export type AcaraIcs = { uid: string; mulai: Date; selesai: Date; judul: string; lokasi?: string | null; keterangan?: string | null; urutan?: number; dibuat?: Date };

export const escapeTeks = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export const waktuUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Lipat satu baris konten menjadi potongan <= 75 oktet UTF-8 tanpa memotong karakter multibita. */
export function lipat(baris: string): string {
  const enc = new TextEncoder();
  const keluar: string[] = [];
  let kini = "", oktet = 0, batas = 75;
  for (const ch of baris) {
    const n = enc.encode(ch).length;
    if (oktet + n > batas) {
      keluar.push(kini);
      kini = " ";
      oktet = 1;
      batas = 75;
    }
    kini += ch;
    oktet += n;
  }
  keluar.push(kini);
  return keluar.join("\r\n");
}

export function buatIcs(a: AcaraIcs): string {
  const baris = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nadi//Rekrutmen//ID",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${a.uid}`,
    `DTSTAMP:${waktuUtc(a.dibuat ?? new Date())}`,
    `DTSTART:${waktuUtc(a.mulai)}`,
    `DTEND:${waktuUtc(a.selesai)}`,
    `SEQUENCE:${a.urutan ?? 0}`,
    `SUMMARY:${escapeTeks(a.judul)}`,
    ...(a.lokasi ? [`LOCATION:${escapeTeks(a.lokasi)}`] : []),
    ...(a.keterangan ? [`DESCRIPTION:${escapeTeks(a.keterangan)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return baris.map(lipat).join("\r\n") + "\r\n";
}

/** Pesan WhatsApp undangan wawancara: selalu bahasa Indonesia karena penerimanya pelamar di Indonesia (keputusan 4 Nov 2026). */
export const undanganWawancara = (v: { nama: string; lowongan: string; usaha: string; waktu: string; lokasi: string }) =>
  `Halo ${v.nama}, kamu diundang wawancara ${v.lowongan} di ${v.usaha} pada ${v.waktu}, tempat: ${v.lokasi}. Simpan ke kalender lewat tautan status lamaranmu.`;

/** "2026-11-10T09:30" (jam dinding di zona usaha) menjadi Date UTC. Zona Indonesia tanpa musim panas, satu kali koreksi cukup. */
export function waktuZona(lokal: string, zona: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokal);
  if (!m) return null;
  const tebak = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const b = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(tebak)).map((x) => [x.type, x.value]));
  const tampil = Date.UTC(+b.year, +b.month - 1, +b.day, +b.hour, +b.minute);
  return new Date(tebak - (tampil - tebak));
}
