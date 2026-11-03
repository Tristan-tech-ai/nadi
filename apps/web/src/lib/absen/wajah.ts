// Penilai cek wajah hidup untuk absen (docs/research/absen.md). Murni: menerima ringkasan per bingkai dari MediaPipe
// Face Landmarker dan memutuskan lulus atau tidak. Gambar kamera tidak pernah keluar dari perangkat.

/** Ringkasan satu bingkai kamera. */
export type Bingkai = {
  /** Jumlah wajah terdeteksi. */
  wajah: number;
  /** Rata-rata blendshape eyeBlinkLeft dan eyeBlinkRight (0 terbuka, 1 tertutup). */
  kedip: number;
  /**
   * Posisi hidung di antara kedua pipi pada gambar kamera (tidak dicerminkan), -1 sampai 1. Positif berarti hidung ke kanan
   * gambar, yaitu orang menoleh ke kirinya sendiri. Foto yang diputar tetap ~konstan karena hidung menempel di bidang foto.
   */
  yaw: number;
};

export type Arah = "kiri" | "kanan";
export type Penilaian = { lulus: boolean; kedip: boolean; menoleh: Arah | ""; alasan: string };

export const BATAS = { minBingkai: 8, terbuka: 0.25, tertutup: 0.5, lurus: 0.15, menoleh: 0.35 } as const;

export const tantanganAcak = (acak: () => number = Math.random): Arah => (acak() < 0.5 ? "kiri" : "kanan");

/** Rasio yaw dari landmark: titik hidung (1) dan tepi pipi (234, 454), koordinat x ternormalisasi. */
export function yawDariLandmark(hidungX: number, pipiAX: number, pipiBX: number): number {
  const kiri = Math.min(pipiAX, pipiBX);
  const lebar = Math.abs(pipiBX - pipiAX);
  if (lebar < 1e-6) return 0;
  return Math.max(-1, Math.min(1, ((hidungX - kiri) / lebar - 0.5) * 2));
}

/** Kedip: mata terbuka, lalu tertutup, lalu terbuka lagi (urutan wajib). */
function adaKedip(b: Bingkai[]): boolean {
  let tahap = 0;
  for (const x of b) {
    if (tahap === 0 && x.kedip < BATAS.terbuka) tahap = 1;
    else if (tahap === 1 && x.kedip > BATAS.tertutup) tahap = 2;
    else if (tahap === 2 && x.kedip < BATAS.terbuka) return true;
  }
  return false;
}

/** Menoleh ke arah yang diminta: mulai dari wajah lurus, lalu melewati batas ke arah itu. */
function adaMenoleh(b: Bingkai[], arah: Arah): boolean {
  const tanda = arah === "kiri" ? 1 : -1;
  let lurus = false;
  for (const x of b) {
    if (Math.abs(x.yaw) < BATAS.lurus) lurus = true;
    else if (lurus && x.yaw * tanda > BATAS.menoleh) return true;
  }
  return false;
}

/** Kalimat alasan gagal (bawaan bahasa Indonesia; layar mengoper kamus absen). */
export type TeksWajah = { duaWajah: string; wajahBelum: string; belumKedip: string; belumToleh: string; kiri: string; kanan: string };
const TEKS_WAJAH_ID: TeksWajah = {
  duaWajah: "Ada lebih dari satu wajah. Absen sendiri-sendiri, ya.",
  wajahBelum: "Wajah belum terlihat jelas. Hadapkan wajah ke kamera di tempat yang terang.",
  belumKedip: "Belum terlihat berkedip. Kedipkan mata sekali.",
  belumToleh: "Belum terlihat menoleh ke {arah}mu. Tolehkan kepala pelan-pelan.",
  kiri: "kiri", kanan: "kanan",
};

export function nilaiWajah(bingkai: Bingkai[], arah: Arah, t: TeksWajah = TEKS_WAJAH_ID): Penilaian {
  const gagal = (alasan: string, kedip = false): Penilaian => ({ lulus: false, kedip, menoleh: "", alasan });
  if (bingkai.some((x) => x.wajah > 1)) return gagal(t.duaWajah);
  const ada = bingkai.filter((x) => x.wajah === 1);
  if (ada.length < BATAS.minBingkai) return gagal(t.wajahBelum);
  const kedip = adaKedip(ada);
  if (!kedip) return gagal(t.belumKedip);
  if (!adaMenoleh(ada, arah)) return gagal(t.belumToleh.replace("{arah}", t[arah]), true);
  return { lulus: true, kedip: true, menoleh: arah, alasan: "" };
}
