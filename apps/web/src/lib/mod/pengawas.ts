// Pengawas manifest Nadi Mod: pemeriksa deterministik (bukan AI). Manifest dari AI, impor, atau pembangun visual baru
// boleh disimpan sebagai draf bila lolos; daftar alasan ditulis dalam bahasa sehari-hari supaya bisa diperbaiki.
// Prinsip: semua kunci yang tidak dikenal ditolak, semua rujukan harus ke daftar putih, tidak ada teks mirip skrip.
import { AKSES, AKSES_MAKS, BATAS, IKON_MOD, JENIS_TAMPILAN, PERAN, RUANG_MOD, TIPE_BIDANG, VERSI_SKEMA } from "./skema";
import { rujukan, urai } from "./rumus";

type O = Record<string, unknown>;
const obj = (v: unknown): v is O => typeof v === "object" && v !== null && !Array.isArray(v);
const KODE_MOD = /^[a-z][a-z0-9-]{2,39}$/;
const KODE = /^[a-z][a-z0-9_]{1,29}$/;
const SEMVER = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
// Teks tampil: huruf (termasuk non-Latin), angka, spasi, dan tanda baca umum. Tanpa < > { } [ ] ` $ \ | ^ ~ dan karakter kendali.
const TEKS = /^[\p{L}\p{N} .,:;()/&%+'"!?#@*=_-]*$/u;
const LARANG = /(javascript|vbscript|data)\s*:|\bon[a-z]+\s*=|<\s*\/?\s*script|--|\/\*|\bdrop\s+table\b|\bdelete\s+from\b|\binsert\s+into\b|\bunion\s+select\b|\bselect\b.+\bfrom\b/i;
const TERLARANG_KODE = new Set(["__proto__", "constructor", "prototype", "id", "status", "perusahaan_id", "mod_id", "dibuat_oleh", "dibuat_at", "diubah_at"]);
const PERAN_TRANSISI = new Set<string>([...PERAN, "pembuat", "ditugaskan"]);
const TIPE_TANGGAL = new Set(["tanggal", "tanggal_jam"]);
const TIPE_KELOMPOK = new Set(["pilihan", "orang", "pelanggan", "produk", "proyek", "rujukan", "centang"]);
const WARNA = new Set(["abu", "kunyit", "daun", "laut", "cap"]);

function teks(v: unknown, maks: number, wajib = true): string | null {
  if (v === undefined && !wajib) return null;
  if (typeof v !== "string") return "harus teks";
  const t = v.trim();
  if (wajib && !t) return "tidak boleh kosong";
  if (t.length > maks) return `lebih dari ${maks} huruf`;
  if (!TEKS.test(t)) return "memuat karakter yang tidak boleh (< > { } [ ] ` $ \\ | atau karakter kendali)";
  if (LARANG.test(t)) return "memuat teks mirip skrip atau perintah database";
  return null;
}

function kunci(o: O, boleh: string[], di: string, alasan: string[]) {
  for (const k of Object.keys(o)) if (!boleh.includes(k)) alasan.push(`${di}: kunci "${k}" tidak dikenal`);
}

/** Periksa manifest. Kembalian: daftar alasan (kosong = lolos). */
export function periksaManifest(m: unknown): string[] {
  const a: string[] = [];
  if (!obj(m)) return ["manifest harus berupa objek JSON"];
  let ukuran = 0;
  try { ukuran = new TextEncoder().encode(JSON.stringify(m)).length; } catch { return ["manifest tidak bisa dibaca sebagai JSON"]; }
  if (ukuran > BATAS.manifestByte) return [`manifest ${Math.round(ukuran / 1024)} KB, batasnya ${BATAS.manifestByte / 1024} KB`];
  kunci(m, ["skema", "kode", "nama", "deskripsi", "ikon", "ruang", "versi", "koleksi", "otomasi", "laporan"], "manifest", a);
  if (m.skema !== VERSI_SKEMA) a.push(`skema harus ${VERSI_SKEMA}`);
  if (typeof m.kode !== "string" || !KODE_MOD.test(m.kode)) a.push("kode mod harus huruf kecil, angka, atau tanda hubung (3-40 huruf)");
  const tn = teks(m.nama, BATAS.teksLabel); if (tn) a.push(`nama ${tn}`);
  const td = teks(m.deskripsi, BATAS.teksDeskripsi); if (td) a.push(`deskripsi ${td}`);
  if (!(IKON_MOD as readonly unknown[]).includes(m.ikon)) a.push("ikon harus salah satu dari daftar ikon Nadi");
  if (!(RUANG_MOD as readonly unknown[]).includes(m.ruang)) a.push("ruang harus salah satu ruang aplikasi");
  if (typeof m.versi !== "string" || !SEMVER.test(m.versi)) a.push("versi harus seperti 1.0.0");

  const koleksi = Array.isArray(m.koleksi) ? m.koleksi : [];
  if (!Array.isArray(m.koleksi) || koleksi.length < 1 || koleksi.length > BATAS.koleksi) a.push(`koleksi harus 1 sampai ${BATAS.koleksi}`);
  const kodeKoleksi = new Map<string, O>();
  for (const k of koleksi) if (obj(k) && typeof k.kode === "string") {
    if (kodeKoleksi.has(k.kode)) a.push(`kode koleksi ${k.kode} dipakai dua kali`);
    kodeKoleksi.set(k.kode, k);
  }
  const bidangKoleksi = new Map<string, Map<string, O>>();
  koleksi.forEach((k, i) => { if (obj(k)) bidangKoleksi.set(String(k.kode), periksaKoleksi(k, `koleksi ${i + 1}`, kodeKoleksi, a)); });

  const otomasi = m.otomasi === undefined ? [] : m.otomasi;
  if (!Array.isArray(otomasi) || otomasi.length > BATAS.otomasi) a.push(`otomasi harus daftar, maksimal ${BATAS.otomasi}`);
  else {
    const kode = new Set<string>();
    otomasi.forEach((o, i) => periksaOtomasi(o, `otomasi ${i + 1}`, kodeKoleksi, bidangKoleksi, kode, a));
  }
  const laporan = m.laporan === undefined ? [] : m.laporan;
  if (!Array.isArray(laporan) || laporan.length > BATAS.laporan) a.push(`laporan harus daftar, maksimal ${BATAS.laporan}`);
  else laporan.forEach((l, i) => periksaLaporan(l, `laporan ${i + 1}`, bidangKoleksi, a));
  return a;
}

function periksaKoleksi(k: O, di: string, semua: Map<string, O>, a: string[]): Map<string, O> {
  const bidangPeta = new Map<string, O>();
  kunci(k, ["kode", "nama", "judul", "bidang", "status", "tampilan", "akses"], di, a);
  if (typeof k.kode !== "string" || !KODE.test(k.kode) || TERLARANG_KODE.has(k.kode)) a.push(`${di}: kode harus huruf kecil/angka/garis bawah (2-30 huruf)`);
  const tn = teks(k.nama, BATAS.teksLabel); if (tn) a.push(`${di}: nama ${tn}`);
  const bidang = Array.isArray(k.bidang) ? k.bidang : [];
  if (!Array.isArray(k.bidang) || bidang.length < 1 || bidang.length > BATAS.bidangPerKoleksi) a.push(`${di}: bidang harus 1 sampai ${BATAS.bidangPerKoleksi}`);
  for (const b of bidang) if (obj(b) && typeof b.kode === "string") {
    if (bidangPeta.has(b.kode)) a.push(`${di}: kode bidang ${b.kode} dipakai dua kali`);
    bidangPeta.set(b.kode, b);
  }
  const adaPenugasan = bidang.some((b) => obj(b) && b.tipe === "orang" && b.penugasan === true);
  bidang.forEach((b, i) => periksaBidang(b, `${di} bidang ${i + 1}`, semua, bidangPeta, a));
  const judul = bidangPeta.get(String(k.judul));
  if (!judul || judul.tipe !== "teks") a.push(`${di}: judul harus kode bidang bertipe teks`);

  const kodeStatus = new Set<string>();
  if (k.status !== undefined) {
    const s = k.status;
    if (!obj(s)) a.push(`${di}: status harus objek`);
    else {
      kunci(s, ["awal", "daftar", "transisi"], `${di} status`, a);
      const daftar = Array.isArray(s.daftar) ? s.daftar : [];
      if (daftar.length < 1 || daftar.length > BATAS.status) a.push(`${di}: status harus 1 sampai ${BATAS.status}`);
      daftar.forEach((d, i) => {
        if (!obj(d)) return a.push(`${di} status ${i + 1}: harus objek`);
        kunci(d, ["kode", "label", "akhir", "warna"], `${di} status ${i + 1}`, a);
        if (typeof d.kode !== "string" || !KODE.test(d.kode)) a.push(`${di} status ${i + 1}: kode tidak sah`);
        else if (kodeStatus.has(d.kode)) a.push(`${di}: status ${d.kode} dipakai dua kali`);
        else kodeStatus.add(d.kode);
        const tl = teks(d.label, BATAS.teksLabel); if (tl) a.push(`${di} status ${i + 1}: label ${tl}`);
        if (d.akhir !== undefined && typeof d.akhir !== "boolean") a.push(`${di} status ${i + 1}: akhir harus benar/salah`);
        if (d.warna !== undefined && !WARNA.has(String(d.warna))) a.push(`${di} status ${i + 1}: warna tidak dikenal`);
      });
      if (!kodeStatus.has(String(s.awal))) a.push(`${di}: status awal harus salah satu status`);
      const transisi = Array.isArray(s.transisi) ? s.transisi : [];
      if (!Array.isArray(s.transisi) || transisi.length > BATAS.transisi) a.push(`${di}: transisi harus daftar, maksimal ${BATAS.transisi}`);
      transisi.forEach((t, i) => {
        const dt = `${di} transisi ${i + 1}`;
        if (!obj(t)) return a.push(`${dt}: harus objek`);
        kunci(t, ["dari", "ke", "peran", "wajib_isi", "label"], dt, a);
        if (t.dari !== "*" && !(Array.isArray(t.dari) && t.dari.length > 0 && t.dari.every((x) => kodeStatus.has(String(x))))) a.push(`${dt}: dari harus "*" atau daftar status`);
        if (!kodeStatus.has(String(t.ke))) a.push(`${dt}: ke harus salah satu status`);
        if (!Array.isArray(t.peran) || t.peran.length < 1 || !t.peran.every((p) => PERAN_TRANSISI.has(String(p)))) a.push(`${dt}: peran harus dari pemilik, admin, akuntan, staf, pembuat, ditugaskan`);
        else if (t.peran.includes("ditugaskan") && !adaPenugasan) a.push(`${dt}: peran ditugaskan butuh bidang orang dengan penugasan`);
        if (t.wajib_isi !== undefined && !(Array.isArray(t.wajib_isi) && t.wajib_isi.every((x) => bidangPeta.has(String(x)) && bidangPeta.get(String(x))!.tipe !== "rumus"))) a.push(`${dt}: wajib_isi harus kode bidang`);
        if (t.label !== undefined) { const tl = teks(t.label, BATAS.teksLabel); if (tl) a.push(`${dt}: label ${tl}`); }
      });
    }
  }
  const adaKolom = (x: unknown) => typeof x === "string" && (bidangPeta.has(x) || (x === "status" && kodeStatus.size > 0));
  const tampilan = Array.isArray(k.tampilan) ? k.tampilan : [];
  if (tampilan.length < 1 || tampilan.length > BATAS.tampilanPerKoleksi) a.push(`${di}: tampilan harus 1 sampai ${BATAS.tampilanPerKoleksi}`);
  tampilan.forEach((t, i) => {
    const dt = `${di} tampilan ${i + 1}`;
    if (!obj(t) || !(JENIS_TAMPILAN as readonly unknown[]).includes(t.jenis)) return a.push(`${dt}: jenis harus daftar, papan, kalender, formulir, atau rincian`);
    const daftarBidang = (x: unknown, isian = false) => Array.isArray(x) && x.length > 0 && x.length <= BATAS.bidangPerKoleksi
      && x.every((y) => adaKolom(y) && (!isian || (bidangPeta.get(String(y))?.tipe !== "rumus" && y !== "status")));
    if (t.jenis === "daftar") {
      kunci(t, ["jenis", "kolom", "urut", "saring"], dt, a);
      if (!daftarBidang(t.kolom)) a.push(`${dt}: kolom harus kode bidang`);
      if (t.urut !== undefined && !(obj(t.urut) && adaKolom(t.urut.bidang) && ["naik", "turun"].includes(String(t.urut.arah)) && Object.keys(t.urut).length === 2)) a.push(`${dt}: urut tidak sah`);
      if (t.saring !== undefined && !(Array.isArray(t.saring) && t.saring.every((x) => x === "status" ? kodeStatus.size > 0 : TIPE_KELOMPOK.has(String(bidangPeta.get(String(x))?.tipe))))) a.push(`${dt}: saring hanya untuk status atau bidang pilihan/rujukan`);
    } else if (t.jenis === "papan") {
      kunci(t, ["jenis", "kolom_kartu"], dt, a);
      if (kodeStatus.size === 0) a.push(`${dt}: papan butuh alur status`);
      if (!daftarBidang(t.kolom_kartu)) a.push(`${dt}: kolom_kartu harus kode bidang`);
    } else if (t.jenis === "kalender") {
      kunci(t, ["jenis", "tanggal"], dt, a);
      if (!TIPE_TANGGAL.has(String(bidangPeta.get(String(t.tanggal))?.tipe))) a.push(`${dt}: kalender butuh bidang tanggal`);
    } else {
      kunci(t, ["jenis", "bidang"], dt, a);
      if (!daftarBidang(t.bidang, t.jenis === "formulir")) a.push(`${dt}: bidang harus kode bidang${t.jenis === "formulir" ? " yang bisa diisi" : ""}`);
    }
  });
  if (!obj(k.akses)) a.push(`${di}: akses harus objek per peran`);
  else {
    kunci(k.akses, [...PERAN], `${di} akses`, a);
    for (const p of PERAN) {
      const v = k.akses[p];
      if (!(AKSES as readonly unknown[]).includes(v)) a.push(`${di}: akses ${p} harus tidak, lihat, milik_sendiri, tulis, atau kelola`);
      else if (AKSES.indexOf(v as never) > AKSES.indexOf(AKSES_MAKS[p])) a.push(`${di}: akses ${p} paling tinggi ${AKSES_MAKS[p]}`);
      else if ((p === "pemilik" || p === "admin") && v !== "kelola") a.push(`${di}: pemilik dan admin selalu kelola`);
    }
  }
  return bidangPeta;
}

function periksaBidang(b: unknown, di: string, semua: Map<string, O>, sejawat: Map<string, O>, a: string[]) {
  if (!obj(b)) return a.push(`${di}: harus objek`);
  kunci(b, ["kode", "label", "tipe", "wajib", "petunjuk", "pilihan", "min", "max", "banyak", "koleksi", "penugasan", "rumus"], di, a);
  if (typeof b.kode !== "string" || !KODE.test(b.kode) || TERLARANG_KODE.has(b.kode)) a.push(`${di}: kode harus huruf kecil/angka/garis bawah (2-30 huruf, bukan nama sistem)`);
  const tl = teks(b.label, BATAS.teksLabel); if (tl) a.push(`${di}: label ${tl}`);
  const tp = teks(b.petunjuk, BATAS.teksDeskripsi, false); if (tp) a.push(`${di}: petunjuk ${tp}`);
  if (!(TIPE_BIDANG as readonly unknown[]).includes(b.tipe)) return a.push(`${di}: tipe "${String(b.tipe).slice(0, 20)}" tidak dikenal`);
  if (b.wajib !== undefined && typeof b.wajib !== "boolean") a.push(`${di}: wajib harus benar/salah`);
  const pilihan = b.tipe === "pilihan" || b.tipe === "pilihan_banyak";
  if (pilihan) {
    const p = Array.isArray(b.pilihan) ? b.pilihan : [];
    if (p.length < 1 || p.length > BATAS.pilihanPerBidang) a.push(`${di}: pilihan harus 1 sampai ${BATAS.pilihanPerBidang}`);
    const kode = new Set<string>();
    p.forEach((x, i) => {
      if (!obj(x)) return a.push(`${di} pilihan ${i + 1}: harus objek`);
      kunci(x, ["kode", "label", "warna"], `${di} pilihan ${i + 1}`, a);
      if (typeof x.kode !== "string" || !KODE.test(x.kode) || kode.has(x.kode)) a.push(`${di} pilihan ${i + 1}: kode tidak sah atau ganda`);
      else kode.add(x.kode);
      const tx = teks(x.label, BATAS.teksLabel); if (tx) a.push(`${di} pilihan ${i + 1}: label ${tx}`);
      if (x.warna !== undefined && !WARNA.has(String(x.warna))) a.push(`${di} pilihan ${i + 1}: warna tidak dikenal`);
    });
  } else if (b.pilihan !== undefined) a.push(`${di}: pilihan hanya untuk tipe pilihan`);
  const angka = b.tipe === "angka" || b.tipe === "rupiah";
  for (const k of ["min", "max"] as const) if (b[k] !== undefined && (!angka || typeof b[k] !== "number" || !Number.isFinite(b[k]))) a.push(`${di}: ${k} hanya angka untuk tipe angka/rupiah`);
  if (typeof b.min === "number" && typeof b.max === "number" && b.min > b.max) a.push(`${di}: min lebih besar dari max`);
  if (b.banyak !== undefined && (typeof b.banyak !== "boolean" || b.tipe !== "orang")) a.push(`${di}: banyak hanya untuk tipe orang`);
  if (b.penugasan !== undefined && (typeof b.penugasan !== "boolean" || b.tipe !== "orang")) a.push(`${di}: penugasan hanya untuk tipe orang`);
  if (b.tipe === "rujukan") { if (typeof b.koleksi !== "string" || !semua.has(b.koleksi)) a.push(`${di}: rujukan harus ke koleksi di mod yang sama`); }
  else if (b.koleksi !== undefined) a.push(`${di}: koleksi hanya untuk tipe rujukan`);
  if (b.tipe === "rumus") {
    if (b.wajib) a.push(`${di}: rumus tidak bisa wajib diisi`);
    try {
      for (const r of rujukan(urai(String(b.rumus ?? "")))) {
        const tujuan = sejawat.get(r);
        if (!tujuan) a.push(`${di}: rumus merujuk bidang ${r} yang tidak ada`);
        else if (tujuan.tipe === "rumus") a.push(`${di}: rumus tidak boleh merujuk rumus lain (${r})`);
      }
    } catch (e) {
      a.push(`${di}: ${(e as Error).message}`);
    }
  } else if (b.rumus !== undefined) a.push(`${di}: rumus hanya untuk tipe rumus`);
}

function periksaOtomasi(o: unknown, di: string, koleksi: Map<string, O>, bidang: Map<string, Map<string, O>>, sudah: Set<string>, a: string[]) {
  if (!obj(o)) return a.push(`${di}: harus objek`);
  kunci(o, ["kode", "pemicu", "syarat", "aksi"], di, a);
  if (typeof o.kode !== "string" || !KODE_MOD.test(o.kode) || sudah.has(o.kode)) a.push(`${di}: kode tidak sah atau ganda`);
  else sudah.add(o.kode);
  const p = o.pemicu;
  let b: Map<string, O> | undefined;
  if (!obj(p) || !["buat", "status", "tenggat"].includes(String(p.jenis))) a.push(`${di}: pemicu harus buat, status, atau tenggat`);
  else {
    b = bidang.get(String(p.koleksi));
    if (!koleksi.has(String(p.koleksi)) || !b) a.push(`${di}: pemicu harus ke koleksi di mod ini`);
    if (p.jenis === "buat") kunci(p, ["jenis", "koleksi"], `${di} pemicu`, a);
    if (p.jenis === "status") {
      kunci(p, ["jenis", "koleksi", "ke"], `${di} pemicu`, a);
      const st = koleksi.get(String(p.koleksi))?.status;
      const ada = obj(st) && Array.isArray(st.daftar) && st.daftar.some((d) => obj(d) && d.kode === p.ke);
      if (!ada) a.push(`${di}: pemicu status harus ke status yang ada`);
    }
    if (p.jenis === "tenggat") {
      kunci(p, ["jenis", "koleksi", "bidang", "hari_sebelum"], `${di} pemicu`, a);
      if (!TIPE_TANGGAL.has(String(b?.get(String(p.bidang))?.tipe))) a.push(`${di}: pemicu tenggat butuh bidang tanggal`);
      if (typeof p.hari_sebelum !== "number" || !Number.isInteger(p.hari_sebelum) || p.hari_sebelum < 0 || p.hari_sebelum > 30) a.push(`${di}: hari_sebelum harus 0 sampai 30`);
    }
  }
  if (o.syarat !== undefined) {
    if (!Array.isArray(o.syarat) || o.syarat.length > 5) a.push(`${di}: syarat maksimal 5`);
    else o.syarat.forEach((s, i) => {
      if (!obj(s) || !b?.has(String(s.bidang)) || !["sama", "beda", "lebih", "kurang", "berisi"].includes(String(s.op))
        || !["string", "number", "boolean"].includes(typeof s.nilai) || Object.keys(s).some((k) => !["bidang", "op", "nilai"].includes(k))) a.push(`${di} syarat ${i + 1}: tidak sah`);
      else if (typeof s.nilai === "string") { const t = teks(s.nilai, BATAS.teksLabel, false); if (t) a.push(`${di} syarat ${i + 1}: nilai ${t}`); }
    });
  }
  const x = o.aksi;
  if (!obj(x) || !["kartu", "pengingat", "kerja"].includes(String(x.jenis))) return a.push(`${di}: aksi harus kartu, pengingat, atau kerja (tidak ada aksi lain di mod)`);
  kunci(x, ["jenis", "judul", "kepada"], `${di} aksi`, a);
  const kepada = x.jenis === "kerja" ? ["ditugaskan", "pengelola"] : ["pengelola", "pembuat", "ditugaskan"];
  if (!kepada.includes(String(x.kepada))) a.push(`${di}: kepada harus ${kepada.join(", ")}`);
  if (typeof x.judul !== "string") return a.push(`${di}: judul aksi harus teks`);
  const tanpaIsian = x.judul.replace(/\{([a-z][a-z0-9_]{0,29})\}/g, (_, k: string) => {
    if (!b?.has(k)) a.push(`${di}: judul merujuk bidang ${k} yang tidak ada`);
    return "x";
  });
  const t = teks(tanpaIsian, 120); if (t) a.push(`${di}: judul ${t}`);
}

function periksaLaporan(l: unknown, di: string, bidang: Map<string, Map<string, O>>, a: string[]) {
  if (!obj(l)) return a.push(`${di}: harus objek`);
  kunci(l, ["kode", "judul", "koleksi", "kelompok", "hitung"], di, a);
  if (typeof l.kode !== "string" || !KODE_MOD.test(l.kode)) a.push(`${di}: kode tidak sah`);
  const tj = teks(l.judul, BATAS.teksLabel); if (tj) a.push(`${di}: judul ${tj}`);
  const b = bidang.get(String(l.koleksi));
  if (!b) return a.push(`${di}: koleksi harus di mod ini`);
  if (l.kelompok !== "status" && !TIPE_KELOMPOK.has(String(b.get(String(l.kelompok))?.tipe))) a.push(`${di}: kelompok harus status atau bidang pilihan/rujukan`);
  if (l.hitung !== "jumlah" && !(obj(l.hitung) && Object.keys(l.hitung).length === 1 && ["angka", "rupiah"].includes(String(b.get(String(l.hitung.total))?.tipe)))) a.push(`${di}: hitung harus jumlah atau total bidang angka/rupiah`);
}
