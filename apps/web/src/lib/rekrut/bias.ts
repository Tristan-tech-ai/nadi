// Penjaga bias lowongan (F2-02). Dasar: SE Menaker M/6/HK.04/V/2025 (28 Mei 2025) butir 2-4,
// UU 13/2003 Pasal 5 dan Penjelasan Pasal 6, UU 8/2016 (disabilitas). Rincian di docs/research/rubrik.md.
// Pemeriksa ini memberi peringatan, bukan vonis: syarat usia boleh bila sifat pekerjaan nyata memengaruhinya (SE butir 3a).

export type KodeBias = "usia" | "penampilan" | "status_kawin" | "jenis_kelamin" | "agama" | "suku_ras" | "politik" | "disabilitas";

export type PeringatanBias = { kode: KodeBias; kutipan: string; alasan: string; saran: string };

const SE = "SE Menaker M/6/HK.04/V/2025";

const ATURAN: { kode: KodeBias; pola: RegExp[]; alasan: string; saran: string }[] = [
  {
    kode: "usia",
    pola: [
      /\b(?:usia|umur|berusia)\b[^.;\n]{0,25}?\d{2}/g,
      /\b(?:usia|umur)\s+(?:produktif|muda)\b/g,
      /\b(?:maks(?:imal|imum)?|max|min(?:imal|imum)?|di ?bawah|di ?atas|paling (?:tinggi|rendah)|batas)\.?\s*(?:usia\s*)?\d{2}\s*(?:th|thn|tahun)\b/g,
      /\b\d{2}\s*(?:-|s\/d|sd|sampai)\s*\d{2}\s*(?:th|thn|tahun)\b/g,
    ],
    alasan: `Batas usia hanya boleh bila sifat pekerjaannya nyata memengaruhi kemampuan kerja (${SE} butir 3).`,
    saran: "Hapus batas usia, atau tulis alasan pekerjaannya, misalnya mengangkat beban 25 kg.",
  },
  {
    kode: "penampilan",
    pola: [
      /\b(?:ber)?penampilan\s+(?:menarik|baik|rapi dan menarik)\b/g,
      /\bgood[ -]?looking\b/g,
      /\b(?:wajah\s+)?(?:cantik|ganteng|tampan)\b/g,
      /\b(?:tinggi|berat)\s+badan\b/g,
      /\b(?:tb|bb)\s*(?:min(?:imal)?|maks(?:imal)?|ideal|\d)/g,
      /\b(?:badan|tubuh|postur)\s+(?:ideal|proporsional|tegap)\b/g,
    ],
    alasan: `Syarat penampilan, tinggi, atau berat badan termasuk pembedaan yang dilarang dalam rekrutmen (${SE} butir 2).`,
    saran: "Ganti dengan hal yang bisa dinilai, misalnya rapi dan bersih saat bertugas.",
  },
  {
    kode: "status_kawin",
    pola: [/\bbelum\s+(?:menikah|kawin)\b/g, /\bsudah\s+(?:menikah|kawin)\b/g, /\blajang\b/g, /\bsingle\b/g, /\btidak\s+(?:sedang\s+)?(?:hamil|menikah)\b/g, /\bstatus\s+(?:perkawinan|pernikahan|menikah)\b/g],
    alasan: `Status perkawinan tidak berhubungan dengan kemampuan kerja (${SE} butir 2).`,
    saran: "Hapus syarat ini.",
  },
  {
    kode: "jenis_kelamin",
    pola: [/\b(?:pria|wanita|laki[- ]?laki|perempuan|cowok|cewek)\b/g],
    alasan: "Membedakan jenis kelamin dilarang (UU 13/2003 Pasal 5 dan Penjelasan Pasal 6).",
    saran: "Tulis pekerjaannya saja, misalnya pelayan, tanpa pria atau wanita.",
  },
  {
    kode: "agama",
    pola: [/\b(?:muslim|muslimah|nasrani|kristen|katolik|hindu|buddha|budha|konghucu|beragama|berjilbab|berhijab|seiman)\b/g],
    alasan: "Membedakan agama dilarang (UU 13/2003 Pasal 5 dan Penjelasan Pasal 6).",
    saran: "Hapus syarat ini. Aturan seragam kerja boleh ditulis terpisah tanpa menyebut agama.",
  },
  {
    kode: "suku_ras",
    pola: [/\bsuku\b/g, /\bras\b/g, /\bketurunan\b/g, /\bwarna\s+kulit\b/g, /\bkulit\s+(?:putih|cerah|terang|bersih)\b/g, /\bpribumi\b/g, /\b(?:tionghoa|chinese)\b/g],
    alasan: `Membedakan suku, ras, atau warna kulit dilarang (UU 13/2003 Penjelasan Pasal 6; ${SE} butir 2).`,
    saran: "Hapus syarat ini. Bila butuh bahasa daerah, tulis kemampuan bahasanya.",
  },
  {
    kode: "politik",
    pola: [/\bpartai\b/g, /\b(?:aliran|afiliasi|pilihan)\s+politik\b/g],
    alasan: "Membedakan aliran politik dilarang (UU 13/2003 Penjelasan Pasal 6).",
    saran: "Hapus syarat ini.",
  },
  {
    kode: "disabilitas",
    pola: [
      /\bsehat\s+jasmani(?:\s+(?:dan|&)\s+rohani)?\b/g,
      /\btidak\s+(?:cacat|memiliki\s+(?:cacat|disabilitas))\b/g,
      /\bbebas\s+(?:cacat|disabilitas)\b/g,
      /\bfisik\s+(?:sempurna|normal|lengkap)\b/g,
      /\bpanca\s*indera?\s+(?:lengkap|normal|sempurna)\b/g,
    ],
    alasan: `Syarat fisik umum menutup pelamar penyandang disabilitas (${SE} butir 4; UU 8/2016).`,
    saran: "Tulis kemampuan yang benar-benar dibutuhkan, misalnya bisa berdiri selama shift 8 jam.",
  },
];

/** Periksa teks lowongan (judul + ringkasan). Satu peringatan per jenis, kutipan pertama yang ditemukan. */
export function cekLowongan(teks: string): PeringatanBias[] {
  const t = teks.toLowerCase().replace(/\s+/g, " ");
  const hasil: PeringatanBias[] = [];
  for (const a of ATURAN) {
    const m = a.pola.map((p) => cari(p, t, a.kode)).find(Boolean);
    if (m) hasil.push({ kode: a.kode, kutipan: m, alasan: a.alasan, saran: a.saran });
  }
  return hasil;
}

function cari(pola: RegExp, t: string, kode: KodeBias): string | null {
  pola.lastIndex = 0;
  for (let m = pola.exec(t); m; m = pola.exec(t)) {
    // "pengalaman minimal 2 tahun" bukan batas usia.
    if (kode === "usia" && /pengalaman|masa kerja|kontrak/.test(t.slice(Math.max(0, m.index - 20), m.index))) continue;
    return m[0].trim();
  }
  return null;
}
