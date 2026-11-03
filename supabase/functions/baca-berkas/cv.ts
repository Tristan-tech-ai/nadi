// Pengurai CV tanpa model (H-02). CV adalah jenis berkas dengan token AI terbanyak, dan setiap pelamar memakai tata letak
// sendiri sehingga aturan per tata letak (ekstraktor.ts) tidak pernah terpakai ulang. CV berteks (PDF, teks OCR) dibaca dari
// judul bagiannya. Bila ada satu baris pengalaman yang tidak terurai, atau nama tidak ditemukan, hasilnya null dan berkas
// jatuh ke model seperti biasa: lebih baik membayar token daripada mengisi data pelamar yang salah.
type HasilCv = { jenis: "cv"; keyakinan: number; ringkasan: string; bidang: { nama: string; posisi: string; pengalaman: { tempat: string; peran: string; tahun: string }[]; keahlian: string[] } };

const PISAH = "[-–—]";
const AKHIR = "(\\d{4}|sekarang|kini|saat ini|now|present)";
const JUDUL: [RegExp, "pengalaman" | "keahlian" | "pendidikan" | "lain"][] = [
  [/^(pengalaman( kerja)?|riwayat (pekerjaan|kerja)|work experience|experience)$/, "pengalaman"],
  [/^(keahlian|kemampuan|keterampilan|skills?)$/, "keahlian"],
  [/^(pendidikan|riwayat pendidikan|education)$/, "pendidikan"],
  [/^(data (diri|pribadi)|profil|tentang saya|sertifikat|sertifikasi|organisasi|referensi|bahasa|hobi|summary|profile|kontak)$/, "lain"],
];
const POSISI = /^(melamar sebagai|posisi yang dilamar|posisi dilamar|posisi|lamaran|applying for|position)\s*:?\s*(.+)$/i;
const BUKAN_NAMA = /^(daftar riwayat hidup|riwayat hidup|curriculum vitae|cv|resume)$/i;

const bersih = (s: string) => s.replace(/^[-•*·]\s*/, "").replace(/\s+/g, " ").trim();
const tahun = (a: string, b: string) => `${a}-${/^\d{4}$/.test(b) ? b : "sekarang"}`;

function judulDari(baris: string) {
  const k = baris.toLowerCase().replace(/[:\s]+$/, "").trim();
  return JUDUL.find(([re]) => re.test(k))?.[1] ?? null;
}

function pengalamanDari(baris: string): { tempat: string; peran: string; tahun: string } | null {
  const b = bersih(baris);
  const rentang = `\\(?\\s*(\\d{4})\\s*${PISAH}\\s*${AKHIR}\\s*\\)?`;
  // Peran, Tempat (2020-2023)   atau   Peran, Tempat, 2020 - 2023
  let m = new RegExp(`^(.+?),\\s*(.+?),?\\s*${rentang}$`, "i").exec(b);
  if (m && !/\sdi\s/i.test(m[1])) return { peran: m[1].trim(), tempat: m[2].trim(), tahun: tahun(m[3], m[4].toLowerCase()) };
  // Peran di Tempat, 2020 - 2023
  m = new RegExp(`^(.+?)\\s+di\\s+(.+?),?\\s*${rentang}$`, "i").exec(b);
  if (m) return { peran: m[1].trim(), tempat: m[2].trim(), tahun: tahun(m[3], m[4].toLowerCase()) };
  return null;
}

export function bacaCv(teks: string): HasilCv | null {
  const baris = teks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const awalBagian = baris.findIndex((x) => judulDari(x) !== null);
  if (awalBagian < 1) return null;
  const bagian: Record<string, string[]> = {};
  let kini: string | null = null;
  for (const x of baris.slice(awalBagian)) {
    const j = judulDari(x);
    if (j) {
      kini = j;
      bagian[j] ??= [];
      continue;
    }
    if (kini) bagian[kini].push(x);
  }
  const dikenal = ["pengalaman", "keahlian", "pendidikan"].filter((k) => k in bagian).length;
  if (dikenal < 2) return null;

  const kepala = baris.slice(0, awalBagian);
  const posisi = kepala.map((x) => POSISI.exec(x)?.[2]?.trim()).find(Boolean) ?? "";
  const nama = kepala.find((x) => !BUKAN_NAMA.test(x) && !POSISI.test(x) && /^[A-Za-zÀ-ɏ'. ]{3,60}$/.test(x) && x.split(" ").length <= 5);
  if (!nama) return null;

  const pengalaman = [];
  for (const x of bagian.pengalaman ?? []) {
    const p = pengalamanDari(x);
    if (!p) return null; // satu baris tak terurai: jangan menebak, serahkan ke model
    pengalaman.push(p);
  }
  let keahlian = (bagian.keahlian ?? []).map(bersih).filter(Boolean);
  if (keahlian.length === 1 && keahlian[0].includes(",")) keahlian = keahlian[0].split(",").map((s) => s.trim()).filter(Boolean);

  return {
    jenis: "cv",
    keyakinan: 0.9,
    ringkasan: `CV ${nama}${posisi ? `, melamar ${posisi}` : ""}.`,
    bidang: { nama, posisi, pengalaman, keahlian },
  };
}
