// Mata v2 (W-02): menghitung kunjungan dari kamera atas di perangkat. Murni (tanpa DOM, tanpa model), dipakai sama persis di
// layar Mata, skrip korpus, dan tes akurasi. Alurnya: bingkai abu-abu kecil -> beda terhadap latar -> gumpal (titik tengah) ->
// pelacak tetangga terdekat yang hanya menyimpan posisi -> kunjungan anonim -> rekap per jam per zona. Tidak ada gambar wajah,
// warna baju, atau ciri lain yang disimpan; nomor jejak hanya hidup di memori dan tidak pernah dikirim (UU 27/2022 Pasal 17
// ayat (1) huruf c: tidak digunakan untuk mengidentifikasi seseorang). Rancangan: docs/research/mata-v2.md.

import { dalamPoligon, type JenisZona, type Titik } from "./resep.ts";

export type JenisZonaV2 = JenisZona;
export type ZonaV2 = { id: string; nama: string; jenis: JenisZonaV2; poligon: Titik[] };
export type Bingkai = { lebar: number; tinggi: number; data: Uint8Array };
/** kutub: 1 bila lebih terang dari lantai, -1 bila lebih gelap. Hanya isyarat sesaat untuk memisahkan dua orang yang berpapasan. */
export type Gumpal = { x: number; y: number; luas: number; kutub: 1 | -1 };

export type OpsiDeteksi = {
  /** Selisih kecerahan minimal (0..255) agar piksel dianggap bukan latar. */
  ambang: number;
  /** Luas gumpal minimal, bagian dari luas bingkai. */
  luasMin: number;
  /** Perkiraan luas satu orang, bagian dari luas bingkai; gumpal jauh lebih besar dipecah (orang berdempetan). */
  luasOrang: number;
};
export const OPSI_DETEKSI: OpsiDeteksi = { ambang: 45, luasMin: 0.002, luasOrang: 0.0059 };

/**
 * Latar dari median beberapa bingkai yang tersebar waktunya: rekaman sungguhan jarang dimulai dari ruang kosong, dan orang yang
 * lewat tidak terekam di median selama ia tidak berdiri di tempat yang sama di lebih dari separuh bingkai.
 */
export function latarMedian(bingkai: Bingkai[]): Float32Array {
  const n = bingkai[0].data.length;
  const latar = new Float32Array(n);
  const nilai = new Uint8Array(bingkai.length);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < bingkai.length; k++) nilai[k] = bingkai[k].data[i];
    nilai.sort();
    latar[i] = nilai[nilai.length >> 1];
  }
  return latar;
}

/** Latar awal dari satu bingkai (toko kosong). */
export function latarDari(b: Bingkai): Float32Array {
  return Float32Array.from(b.data);
}

/**
 * Perbarui latar (rata-rata bergerak): cepat di piksel lantai agar perubahan cahaya diikuti, sangat lambat di piksel orang
 * supaya orang yang antre beberapa menit tidak terserap, tetapi benda yang dipindah (atau orang yang ada saat kamera mulai)
 * akhirnya menjadi latar dan tidak menjadi gumpal hantu selamanya.
 */
export function perbaruiLatar(latar: Float32Array, b: Bingkai, topeng: ArrayLike<number> | null, laju = 0.03) {
  for (let i = 0; i < latar.length; i++) latar[i] += (b.data[i] - latar[i]) * (!topeng || !topeng[i] ? laju : laju * 0.004);
}

/** Lama dalam menit dan detik untuk layar: "4 mnt 10 dtk" / "4 min 10 s"; di bawah satu menit hanya detik. */
export function formatDurasi(detik: number, bahasa = "id"): string {
  const d = Math.max(0, Math.round(detik));
  const m = Math.floor(d / 60);
  const s = d % 60;
  const [mn, dt] = bahasa === "en" ? ["min", "s"] : ["mnt", "dtk"];
  if (!m) return `${s} ${dt}`;
  return s ? `${m} ${mn} ${s} ${dt}` : `${m} ${mn}`;
}

/** Bingkai abu-abu kecil dari data RGBA kanvas (luma BT.601). */
export function abuDari(rgba: Uint8ClampedArray, lebar: number, tinggi: number): Bingkai {
  const data = new Uint8Array(lebar * tinggi);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return { lebar, tinggi, data };
}

/** Topeng piksel yang berbeda dari latar (1 lebih terang, -1 lebih gelap), dikoreksi pergeseran cahaya seluruh bingkai. */
export function topengBeda(latar: Float32Array, b: Bingkai, ambang: number): Int8Array {
  const n = b.data.length;
  // Pergeseran cahaya global: rata-rata selisih pada sampel piksel yang selisihnya kecil (latar).
  let jumlah = 0;
  let cacah = 0;
  for (let i = 0; i < n; i += 7) {
    const d = b.data[i] - latar[i];
    if (Math.abs(d) < ambang) {
      jumlah += d;
      cacah++;
    }
  }
  const geser = cacah ? jumlah / cacah : 0;
  const t = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const d = b.data[i] - latar[i] - geser;
    t[i] = d > ambang ? 1 : d < -ambang ? -1 : 0;
  }
  return t;
}

/** Gumpal terhubung (4 tetangga) dari topeng; gumpal besar dipecah menjadi beberapa titik dengan k-means sepanjang sumbunya. */
export function gumpalDari(t: ArrayLike<number>, lebar: number, tinggi: number, opsi: OpsiDeteksi = OPSI_DETEKSI): Gumpal[] {
  const luasBingkai = lebar * tinggi;
  const label = new Int32Array(t.length).fill(-1);
  const hasil: Gumpal[] = [];
  const tumpuk: number[] = [];
  const px: number[] = [];
  for (let mulai = 0; mulai < t.length; mulai++) {
    if (!t[mulai] || label[mulai] >= 0) continue;
    px.length = 0;
    tumpuk.push(mulai);
    label[mulai] = mulai;
    while (tumpuk.length) {
      const i = tumpuk.pop()!;
      px.push(i);
      const x = i % lebar;
      const tetangga = [x > 0 ? i - 1 : -1, x < lebar - 1 ? i + 1 : -1, i - lebar, i + lebar];
      for (const j of tetangga) {
        if (j < 0 || j >= t.length || !t[j] || label[j] >= 0) continue;
        label[j] = mulai;
        tumpuk.push(j);
      }
    }
    const luas = px.length / luasBingkai;
    if (luas < opsi.luasMin) continue;
    const k = Math.max(1, Math.min(6, Math.round(luas / opsi.luasOrang)));
    for (const g of pecah(px, lebar, k, t)) hasil.push({ x: g.x / lebar, y: g.y / tinggi, luas: g.n / luasBingkai, kutub: g.kutub >= 0 ? 1 : -1 });
  }
  return hasil;
}

/** k-means kecil pada koordinat piksel; titik awal disebar rata sepanjang sumbu terpanjang gumpal (deterministik). */
function pecah(px: number[], lebar: number, k: number, t: ArrayLike<number>): { x: number; y: number; n: number; kutub: number }[] {
  let sx = 0;
  let sy = 0;
  let sk = 0;
  let xmin = Infinity;
  let xmaks = -Infinity;
  let ymin = Infinity;
  let ymaks = -Infinity;
  for (const i of px) {
    const x = i % lebar;
    const y = (i - x) / lebar;
    sx += x;
    sy += y;
    sk += t[i];
    xmin = Math.min(xmin, x);
    xmaks = Math.max(xmaks, x);
    ymin = Math.min(ymin, y);
    ymaks = Math.max(ymaks, y);
  }
  if (k === 1) return [{ x: sx / px.length, y: sy / px.length, n: px.length, kutub: sk }];
  const mendatar = xmaks - xmin >= ymaks - ymin;
  let pusat = Array.from({ length: k }, (_, j) => {
    const f = (j + 0.5) / k;
    return mendatar ? { x: xmin + f * (xmaks - xmin), y: sy / px.length } : { x: sx / px.length, y: ymin + f * (ymaks - ymin) };
  });
  let kelompok: { x: number; y: number; n: number; kutub: number }[] = [];
  for (let ulang = 0; ulang < 6; ulang++) {
    kelompok = pusat.map(() => ({ x: 0, y: 0, n: 0, kutub: 0 }));
    for (const i of px) {
      const x = i % lebar;
      const y = (i - x) / lebar;
      let terbaik = 0;
      let jarak = Infinity;
      pusat.forEach((p, j) => {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < jarak) {
          jarak = d;
          terbaik = j;
        }
      });
      kelompok[terbaik].x += x;
      kelompok[terbaik].y += y;
      kelompok[terbaik].n++;
      kelompok[terbaik].kutub += t[i];
    }
    pusat = kelompok.map((g, j) => (g.n ? { x: g.x / g.n, y: g.y / g.n } : pusat[j]));
  }
  return kelompok.filter((g) => g.n > 0).map((g) => ({ x: g.x / g.n, y: g.y / g.n, n: g.n, kutub: g.kutub }));
}

/** Satu langkah detektor: topeng, gumpal, lalu latar diperbarui di luar orang. */
export function deteksi(latar: Float32Array, b: Bingkai, opsi: OpsiDeteksi = OPSI_DETEKSI): Gumpal[] {
  const t = topengBeda(latar, b, opsi.ambang);
  const g = gumpalDari(t, b.lebar, b.tinggi, opsi);
  perbaruiLatar(latar, b, t);
  return g;
}

export type Kunjungan = {
  /** Detik sejak awal rekaman (bukan jam dinding); rekapJam mengubahnya ke jam. */
  mulai: number;
  selesai: number;
  lama: number;
  /** Urutan zona yang dilewati (nama, berurutan, minimal 1 detik di zona itu). */
  urutan: string[];
  /** Detik per id zona. */
  zonaDetik: Record<string, number>;
  tunggu: number;
  layan: number;
};

export type OpsiPelacak = {
  /** Jarak maksimal (bagian lebar bingkai) antara perkiraan posisi jejak dan gumpal baru. */
  gerbang: number;
  /** Jejak yang tidak terlihat selama ini (detik) dianggap sudah pergi: berlaku di zona pintu, atau di mana saja bila tidak ada pintu. */
  umurHilang: number;
  /** Bila denah punya pintu, jejak yang hilang di dalam toko (tertutup orang lain atau tiang) ditunggu selama ini sebelum ditutup. */
  umurHilangDalam: number;
  /** Kunjungan lebih pendek dari ini dibuang (lewat di depan pintu, bayangan, barang dipindah). */
  minLama: number;
  /** Jejak yang sebagian besar waktunya di zona kerja dianggap karyawan dan tidak dihitung sebagai kunjungan. */
  porsiKerja: number;
};
export const OPSI_PELACAK: OpsiPelacak = { gerbang: 0.09, umurHilang: 3, umurHilangDalam: 20, minLama: 4, porsiKerja: 0.6 };

type JejakAktif = {
  mulai: number;
  akhir: number;
  x0: number;
  y0: number;
  awalPintu: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rata-rata kutub gumpal (-1..1); tidak pernah disimpan atau dikirim. */
  kutub: number;
  zonaDetik: Record<string, number>;
  urutan: string[];
  zonaKini: string | null;
};

/** Potongan jejak yang sudah ditutup; potongan disambung menjadi satu kunjungan bila orangnya hilang di dalam toko lalu muncul lagi. */
type Rantai = {
  mulai: number;
  akhir: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  awalPintu: boolean;
  akhirPintu: boolean;
  zonaDetik: Record<string, number>;
  urutan: string[];
  bagian: number;
};

const SAMBUNG_DETIK = 30;
const SAMBUNG_TUMPANG = 2;

/**
 * Pelacak anonim: hanya posisi dan kecepatan per jejak. Jejak yang hilang sebentar (tertutup orang lain, tiang, deteksi
 * meleset) dipasangkan lagi; potongan yang tetap terputus disambung bila ujung dan awalnya berdekatan di dalam toko. Bila denah
 * punya pintu, rantai yang tidak pernah menyentuh pintu dibuang (bayangan, barang dipindah, gumpal palsu).
 */
export class Pelacak {
  private jejak: JejakAktif[] = [];
  private kolam: Rantai[] = [];
  /** Rantai yang tidak bisa disambung lagi tetapi hanya punya satu ujung di pintu; menunggu pasangannya (neraca pintu). */
  private yatim: Rantai[] = [];
  private tAkhir = 0;
  private adaPintu: boolean;
  private zona: ZonaV2[];
  private opsi: OpsiPelacak;
  constructor(zona: ZonaV2[], opsi: OpsiPelacak = OPSI_PELACAK) {
    this.zona = zona;
    this.opsi = opsi;
    this.adaPintu = zona.some((z) => z.jenis === "pintu");
  }

  private zonaDi(x: number, y: number): ZonaV2 | null {
    return this.zona.find((z) => dalamPoligon([x, y], z.poligon)) ?? null;
  }
  private diPintu(x: number, y: number) {
    return this.adaPintu && this.zona.some((z) => z.jenis === "pintu" && dalamPoligon([x, y], z.poligon));
  }

  /** Masukkan gumpal pada waktu t (detik). Mengembalikan kunjungan yang sudah pasti selesai pada langkah ini. */
  langkah(t: number, gumpal: { x: number; y: number; kutub?: number }[]): Kunjungan[] {
    const dt = Math.max(1e-3, t - this.tAkhir);
    this.tAkhir = t;
    // Pasangan jejak-gumpal diurutkan dari yang terdekat (rakus); gerbang melebar pelan untuk jejak yang lama tidak terlihat.
    const pasangan: { j: number; g: number; d: number }[] = [];
    this.jejak.forEach((jk, j) => {
      const hilang = t - jk.akhir;
      // Orang yang hilang di pintu hampir pasti sudah keluar; jangan pasangkan dengan orang yang baru masuk di titik yang sama.
      if (hilang > 1 && this.diPintu(jk.x, jk.y)) return;
      const px = jk.x + jk.vx * Math.min(hilang, 1.5);
      const py = jk.y + jk.vy * Math.min(hilang, 1.5);
      const batas = this.opsi.gerbang + Math.min(0.1, 0.02 * hilang);
      gumpal.forEach((g, gi) => {
        const beda = g.kutub !== undefined && jk.kutub * g.kutub < -0.3 ? 0.04 : 0;
        const d = Math.hypot(g.x - px, g.y - py) + (hilang > dt + 1e-6 ? 0.01 : 0) + beda;
        if (d <= batas) pasangan.push({ j, g: gi, d });
      });
    });
    const jPakai = new Set<number>();
    const gPakai = new Set<number>();
    for (const p of tugaskan(pasangan, this.jejak.length, gumpal.length)) {
      jPakai.add(p.j);
      gPakai.add(p.g);
      const jk = this.jejak[p.j];
      const g = gumpal[p.g];
      const langkahDt = Math.max(dt, t - jk.akhir);
      jk.vx = 0.6 * jk.vx + 0.4 * ((g.x - jk.x) / langkahDt);
      jk.vy = 0.6 * jk.vy + 0.4 * ((g.y - jk.y) / langkahDt);
      this.isiZona(jk, t);
      jk.x = g.x;
      jk.y = g.y;
      jk.akhir = t;
      if (g.kutub !== undefined) jk.kutub = 0.8 * jk.kutub + 0.2 * g.kutub;
    }
    gumpal.forEach((g, gi) => {
      if (gPakai.has(gi)) return;
      const z = this.zonaDi(g.x, g.y);
      this.jejak.push({ mulai: t, akhir: t, x0: g.x, y0: g.y, awalPintu: this.diPintu(g.x, g.y), x: g.x, y: g.y, vx: 0, vy: 0, kutub: g.kutub ?? 0, zonaDetik: {}, urutan: [], zonaKini: z?.id ?? null });
    });
    this.jejak = this.jejak.filter((jk) => {
      const pintu = !this.adaPintu || this.diPintu(jk.x, jk.y);
      if (t - jk.akhir <= (pintu ? this.opsi.umurHilang : this.opsi.umurHilangDalam)) return true;
      this.simpanPotongan(jk);
      return false;
    });
    return this.lepas(t);
  }

  /** Tambah lama tinggal di zona yang sedang ditempati sampai waktu t, lalu pindah zona bila posisi baru di zona lain. */
  private isiZona(jk: JejakAktif, t: number) {
    const lalu = t - jk.akhir;
    if (jk.zonaKini) jk.zonaDetik[jk.zonaKini] = (jk.zonaDetik[jk.zonaKini] ?? 0) + lalu;
    if (jk.zonaKini && (jk.zonaDetik[jk.zonaKini] ?? 0) >= 1) {
      const nama = this.zona.find((x) => x.id === jk.zonaKini)!.nama;
      if (jk.urutan[jk.urutan.length - 1] !== nama) jk.urutan.push(nama);
    }
    jk.zonaKini = this.zonaDi(jk.x, jk.y)?.id ?? null;
  }

  private simpanPotongan(jk: JejakAktif) {
    this.kolam.push({
      mulai: jk.mulai, akhir: jk.akhir, x0: jk.x0, y0: jk.y0, x1: jk.x, y1: jk.y, awalPintu: jk.awalPintu, akhirPintu: this.diPintu(jk.x, jk.y),
      zonaDetik: jk.zonaDetik, urutan: jk.urutan, bagian: 1,
    });
    this.sambung();
  }

  /** Sambung rantai A (berakhir di dalam toko) dengan rantai B (mulai di dalam toko) sesudahnya; rakus dari jarak terkecil. */
  private sambung() {
    if (!this.adaPintu) return;
    for (;;) {
      let terbaik: { a: number; b: number; skor: number } | null = null;
      for (let ai = 0; ai < this.kolam.length; ai++) {
        const a = this.kolam[ai];
        if (a.akhirPintu) continue;
        for (let bi = 0; bi < this.kolam.length; bi++) {
          const b = this.kolam[bi];
          if (ai === bi || b.awalPintu) continue;
          const jeda = b.mulai - a.akhir;
          if (jeda < -SAMBUNG_TUMPANG || jeda > SAMBUNG_DETIK || b.akhir <= a.akhir) continue;
          const d = Math.hypot(b.x0 - a.x1, b.y0 - a.y1);
          if (d > 0.08 + 0.02 * Math.max(0, jeda)) continue;
          const skor = d + 0.005 * Math.abs(jeda);
          if (!terbaik || skor < terbaik.skor) terbaik = { a: ai, b: bi, skor };
        }
      }
      if (!terbaik) return;
      const a = this.kolam[terbaik.a];
      const b = this.kolam[terbaik.b];
      const zonaDetik = { ...a.zonaDetik };
      for (const [k, v] of Object.entries(b.zonaDetik)) zonaDetik[k] = (zonaDetik[k] ?? 0) + v;
      const urutan = [...a.urutan, ...b.urutan.filter((n, i) => i > 0 || n !== a.urutan[a.urutan.length - 1])];
      const gabung: Rantai = { mulai: a.mulai, akhir: b.akhir, x0: a.x0, y0: a.y0, x1: b.x1, y1: b.y1, awalPintu: a.awalPintu, akhirPintu: b.akhirPintu, zonaDetik, urutan, bagian: a.bagian + b.bagian };
      const { a: ai, b: bi } = terbaik;
      this.kolam = this.kolam.filter((_, i) => i !== ai && i !== bi);
      this.kolam.push(gabung);
    }
  }

  /** Rantai dilepas bila tidak mungkin lagi disambung: lewat masa sambung dan tidak ada jejak aktif yang bisa menjadi lanjutannya. */
  private lepas(t: number, semua = false): Kunjungan[] {
    const keluar: Kunjungan[] = [];
    const siap: Rantai[] = [];
    this.kolam = this.kolam.filter((r) => {
      // Tahan selama masa sambung: rantai yang berakhir di dalam toko bisa disambung potongan berikutnya, rantai yang mulai di
      // dalam toko bisa menjadi lanjutan rantai lain. Sesudah itu yang tersisa diserahkan ke neraca pintu.
      const tahan = this.adaPintu && (!r.akhirPintu || !r.awalPintu) && t - r.akhir <= SAMBUNG_DETIK + 1;
      if (!semua && tahan) return true;
      siap.push(r);
      return false;
    });
    for (const r of siap) {
      if (this.adaPintu && r.awalPintu !== r.akhirPintu) this.yatim.push(r);
      else {
        const k = this.kunjunganDari(r);
        if (k) keluar.push(k);
      }
    }
    keluar.push(...this.neraca(t, semua));
    return keluar;
  }

  /**
   * Neraca pintu: setiap pengunjung masuk dan keluar lewat pintu. Rantai yang hanya punya ujung masuk dipasangkan dengan rantai
   * yang hanya punya ujung keluar sesudahnya (jeda waktu terkecil, lalu jarak), karena jejaknya terputus di keramaian (antrean
   * berdempetan) terlalu lama untuk disambung lewat posisi. Yatim yang tidak menemukan pasangan dilepas apa adanya.
   */
  private neraca(t: number, semua: boolean): Kunjungan[] {
    const JEDA = 150;
    const masuk = this.yatim.filter((r) => r.awalPintu);
    const pergi = this.yatim.filter((r) => r.akhirPintu);
    const calon: { m: Rantai; p: Rantai; skor: number }[] = [];
    for (const m of masuk)
      for (const p of pergi) {
        const jeda = p.mulai - m.akhir;
        if (p.mulai < m.mulai + this.opsi.minLama || p.akhir <= m.akhir || jeda > JEDA) continue;
        calon.push({ m, p, skor: Math.abs(jeda) + 40 * Math.hypot(p.x0 - m.x1, p.y0 - m.y1) });
      }
    calon.sort((a, b) => a.skor - b.skor);
    const pakai = new Set<Rantai>();
    const keluar: Kunjungan[] = [];
    for (const { m, p } of calon) {
      if (pakai.has(m) || pakai.has(p)) continue;
      pakai.add(m);
      pakai.add(p);
      const zonaDetik = { ...m.zonaDetik };
      for (const [k, v] of Object.entries(p.zonaDetik)) zonaDetik[k] = (zonaDetik[k] ?? 0) + v;
      const urutan = [...m.urutan, ...p.urutan.filter((n, i) => i > 0 || n !== m.urutan[m.urutan.length - 1])];
      const k = this.kunjunganDari({ mulai: m.mulai, akhir: p.akhir, x0: m.x0, y0: m.y0, x1: p.x1, y1: p.y1, awalPintu: true, akhirPintu: true, zonaDetik, urutan, bagian: m.bagian + p.bagian });
      if (k) keluar.push(k);
    }
    // Yatim masuk menunggu pasangan selama JEDA detik; yatim keluar dilepas bila tidak ada rantai masuk yang lebih tua yang masih
    // bisa menjadi pasangannya (di kolam atau jejak aktif yang mulai di pintu).
    const masihMasuk = (p: Rantai) =>
      this.kolam.some((r) => r.awalPintu && !r.akhirPintu && r.mulai < p.mulai) || this.jejak.some((j) => j.awalPintu && j.mulai < p.mulai && t - j.akhir > 1);
    this.yatim = this.yatim.filter((r) => {
      if (pakai.has(r)) return false;
      const tunggu = r.awalPintu ? t - r.akhir <= JEDA : masihMasuk(r) && t - r.akhir <= JEDA;
      if (!semua && tunggu) return true;
      const k = this.kunjunganDari(r);
      if (k) keluar.push(k);
      return false;
    });
    return keluar;
  }

  private kunjunganDari(r: Rantai): Kunjungan | null {
    const lama = r.akhir - r.mulai;
    if (lama < this.opsi.minLama) return null;
    if (this.adaPintu && !r.awalPintu && !r.akhirPintu) return null;
    const jenis = (id: string) => this.zona.find((z) => z.id === id)?.jenis;
    let kerja = 0;
    let tunggu = 0;
    let layan = 0;
    for (const [id, d] of Object.entries(r.zonaDetik)) {
      if (jenis(id) === "kerja") kerja += d;
      if (jenis(id) === "antrean") tunggu += d;
      if (jenis(id) === "kasir") layan += d;
    }
    if (kerja >= this.opsi.porsiKerja * lama) return null;
    const bulat = (n: number) => Math.round(n * 10) / 10;
    return {
      mulai: bulat(r.mulai),
      selesai: bulat(r.akhir),
      lama: bulat(lama),
      urutan: r.urutan,
      zonaDetik: Object.fromEntries(Object.entries(r.zonaDetik).map(([k, v]) => [k, bulat(v)])),
      tunggu: bulat(tunggu),
      layan: bulat(layan),
    };
  }

  /** Tutup semua jejak dan rantai (akhir rekaman). */
  selesai(): Kunjungan[] {
    for (const jk of this.jejak) this.simpanPotongan(jk);
    this.jejak = [];
    return this.lepas(this.tAkhir, true);
  }

  /** Posisi jejak yang sedang terlihat (untuk layar). */
  get terlihat(): { x: number; y: number }[] {
    return this.jejak.filter((j) => j.akhir === this.tAkhir).map((j) => ({ x: j.x, y: j.y }));
  }
}

/**
 * Penugasan jejak ke gumpal dengan total jarak terkecil (algoritma Hungaria, O(n^3)); pasangan di luar gerbang tidak boleh
 * dipakai. Rakus (terdekat dulu) menukar identitas saat dua orang berpapasan; penugasan optimal lebih jarang.
 */
export function tugaskan(pasangan: { j: number; g: number; d: number }[], nj: number, ng: number): { j: number; g: number }[] {
  if (!pasangan.length) return [];
  const n = Math.max(nj, ng);
  const MAHAL = 1e3;
  const biaya: number[][] = Array.from({ length: n }, () => new Array(n).fill(MAHAL));
  for (const p of pasangan) biaya[p.j][p.g] = Math.min(biaya[p.j][p.g], p.d);
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const pa = new Array(n + 1).fill(0);
  const cara = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    pa[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const dipakai = new Array(n + 1).fill(false);
    do {
      dipakai[j0] = true;
      const i0 = pa[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (dipakai[j]) continue;
        const c = biaya[i0 - 1][j - 1] - u[i0] - v[j];
        if (c < minv[j]) {
          minv[j] = c;
          cara[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (dipakai[j]) {
          u[pa[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (pa[j0] !== 0);
    do {
      const j1 = cara[j0];
      pa[j0] = pa[j1];
      j0 = j1;
    } while (j0);
  }
  const hasil: { j: number; g: number }[] = [];
  for (let j = 1; j <= n; j++) if (pa[j] && biaya[pa[j] - 1][j - 1] < MAHAL) hasil.push({ j: pa[j] - 1, g: j - 1 });
  return hasil;
}

export type RekapJam = {
  /** Awal jam (ISO, UTC). */
  jam: string;
  kunjungan: number;
  lamaDetik: number;
  tungguN: number;
  tungguDetik: number;
  layanN: number;
  layanDetik: number;
  zona: Record<string, { lintas: number; detik: number }>;
  jalur: Record<string, number>;
};

/** Jalur paling banyak 6 zona agar ringkasan tidak memecah menjadi jalur unik per orang. */
export function teksJalur(urutan: string[]): string {
  return urutan.slice(0, 6).join(" > ");
}

/** Rekap kunjungan per jam mulai kunjungan; asalMs = jam dinding (epoch ms) saat detik 0 rekaman. */
export function rekapJam(kunjungan: Kunjungan[], asalMs: number): RekapJam[] {
  const peta = new Map<string, RekapJam>();
  for (const k of kunjungan) {
    const d = new Date(asalMs + k.mulai * 1000);
    d.setUTCMinutes(0, 0, 0);
    const jam = d.toISOString();
    const r = peta.get(jam) ?? { jam, kunjungan: 0, lamaDetik: 0, tungguN: 0, tungguDetik: 0, layanN: 0, layanDetik: 0, zona: {}, jalur: {} };
    r.kunjungan++;
    r.lamaDetik += Math.round(k.lama);
    if (k.tunggu >= 1) {
      r.tungguN++;
      r.tungguDetik += Math.round(k.tunggu);
    }
    if (k.layan >= 1) {
      r.layanN++;
      r.layanDetik += Math.round(k.layan);
    }
    for (const [id, detik] of Object.entries(k.zonaDetik)) {
      if (detik < 1) continue;
      const z = (r.zona[id] ??= { lintas: 0, detik: 0 });
      z.lintas++;
      z.detik += Math.round(detik);
    }
    if (k.urutan.length) {
      const j = teksJalur(k.urutan);
      r.jalur[j] = (r.jalur[j] ?? 0) + 1;
    }
    peta.set(jam, r);
  }
  return [...peta.values()].sort((a, b) => a.jam.localeCompare(b.jam));
}

/** Cocokkan kunjungan hasil dengan jawaban (rentang waktu yang paling tumpang tindih, IoU >= 0,3). */
export function cocokkanKunjungan(prediksi: Kunjungan[], jawaban: { mulai: number; selesai: number }[]) {
  const pasangan: { p: number; j: number; iou: number }[] = [];
  prediksi.forEach((p, pi) =>
    jawaban.forEach((j, ji) => {
      const irisan = Math.max(0, Math.min(p.selesai, j.selesai) - Math.max(p.mulai, j.mulai));
      const gabung = Math.max(p.selesai, j.selesai) - Math.min(p.mulai, j.mulai);
      const iou = gabung > 0 ? irisan / gabung : 0;
      if (iou >= 0.3) pasangan.push({ p: pi, j: ji, iou });
    }),
  );
  pasangan.sort((a, b) => b.iou - a.iou);
  const pp = new Set<number>();
  const jj = new Set<number>();
  const cocok: { p: number; j: number }[] = [];
  for (const x of pasangan) {
    if (pp.has(x.p) || jj.has(x.j)) continue;
    pp.add(x.p);
    jj.add(x.j);
    cocok.push({ p: x.p, j: x.j });
  }
  return cocok;
}
