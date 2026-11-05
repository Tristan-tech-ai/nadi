// Pengurai log mesin absen sidik jari/wajah tanpa model (M-12). Ekspor mesin berisi satu baris per tempelan jari (nama, waktu,
// kadang status masuk/keluar). Baris dikelompokkan per orang per tanggal: masuk = tempelan pertama (atau pertama berstatus masuk),
// pulang = tempelan terakhir (atau terakhir berstatus keluar) bila berjarak minimal 30 menit. Hasilnya jenis "absen" yang sama
// dengan rekap absen biasa, jadi usulannya memakai alur absen.impor. Tidak dikenali = null, berkas jatuh ke model seperti biasa.
type Baris = { nama: string; tanggal: string; masuk: string; pulang: string; keterangan: string };
export type HasilLog = { jenis: "absen"; keyakinan: number; ringkasan: string; bidang: { baris: Baris[] } };

const NAMA = /^(nama|name|nama karyawan|nama pegawai|employee|employee name)$/;
const WAKTU = /^(waktu|time|date ?time|tanggal ?(&|dan)? ?jam|tanggal ?waktu|tgl ?jam|check ?time|scan ?time|datetime)$/;
const TANGGAL = /^(tanggal|tgl|date)$/;
const JAM = /^(jam|pukul|time of day|clock)$/;
const STATUS = /^(state|status|keterangan|tipe|type|in ?\/ ?out|check ?type)$/;

function pecah(baris: string, pemisah: string): string[] {
  const hasil: string[] = [];
  let kini = "", kutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') { if (kutip && baris[i + 1] === '"') { kini += '"'; i++; } else kutip = !kutip; }
    else if (c === pemisah && !kutip) { hasil.push(kini.trim()); kini = ""; } else kini += c;
  }
  hasil.push(kini.trim());
  return hasil;
}

/** "04/11/2026 07:58", "2026-11-04 07:58:12", "4-11-2026 7.58" -> [YYYY-MM-DD, menit sejak tengah malam]. */
export function waktuLog(teks: string): [string, number] | null {
  const t = teks.trim().replace(/\s+/g, " ");
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/.exec(t);
  let y: string, mo: string, d: string, h: number, mi: number;
  if (m) [y, mo, d, h, mi] = [m[1], m[2], m[3], Number(m[4]), Number(m[5])];
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}) (\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/.exec(t);
    if (!m) return null;
    [d, mo, y, h, mi] = [m[1], m[2], m[3], Number(m[4]), Number(m[5])];
  }
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || h > 23 || mi > 59) return null;
  return [`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, h * 60 + mi];
}

const jam = (menit: number) => `${String(Math.floor(menit / 60)).padStart(2, "0")}.${String(menit % 60).padStart(2, "0")}`;

export function bacaLogMesin(teks: string): HasilLog | null {
  const garis = (teks.charCodeAt(0) === 0xfeff ? teks.slice(1) : teks).split(/\r?\n/).filter((g) => g.trim() && !g.startsWith("# "));
  for (let iJudul = 0; iJudul < Math.min(garis.length, 5); iJudul++) {
    const pemisah = (garis[iJudul].match(/;/g)?.length ?? 0) > (garis[iJudul].match(/,/g)?.length ?? 0) ? ";" : garis[iJudul].includes("\t") ? "\t" : ",";
    const judul = pecah(garis[iJudul], pemisah).map((j) => j.toLowerCase().replace(/[.:]/g, "").trim());
    const iNama = judul.findIndex((j) => NAMA.test(j));
    const iWaktu = judul.findIndex((j) => WAKTU.test(j));
    const iTanggal = judul.findIndex((j) => TANGGAL.test(j));
    const iJam = judul.findIndex((j) => JAM.test(j));
    const iStatus = judul.findIndex((j) => STATUS.test(j));
    if (iNama < 0 || (iWaktu < 0 && (iTanggal < 0 || iJam < 0))) continue;
    const per = new Map<string, { nama: string; tanggal: string; semua: number[]; masuk: number[]; keluar: number[] }>();
    let rusak = 0, dibaca = 0;
    for (const g of garis.slice(iJudul + 1)) {
      const s = pecah(g, pemisah);
      const nama = (s[iNama] ?? "").replace(/\s+/g, " ").trim();
      const w = iWaktu >= 0 ? waktuLog(s[iWaktu] ?? "") : waktuLog(`${s[iTanggal] ?? ""} ${s[iJam] ?? ""}`);
      if (!nama || !w) { rusak++; continue; }
      dibaca++;
      const kunci = `${nama.toLowerCase()}|${w[0]}`;
      const e = per.get(kunci) ?? { nama, tanggal: w[0], semua: [], masuk: [], keluar: [] };
      e.semua.push(w[1]);
      const st = (iStatus >= 0 ? s[iStatus] ?? "" : "").toLowerCase();
      if (/\b(in|masuk|check ?in|c\/in)\b|^0$/.test(st)) e.masuk.push(w[1]);
      else if (/\b(out|keluar|pulang|check ?out|c\/out)\b|^1$/.test(st)) e.keluar.push(w[1]);
      per.set(kunci, e);
    }
    // Ini log mesin hanya bila hampir semua baris terbaca dan ada orang yang menempel lebih dari sekali.
    if (dibaca < 2 || rusak > Math.max(2, dibaca * 0.1)) return null;
    const baris: Baris[] = [...per.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama)).map((e) => {
      const masuk = e.masuk.length ? Math.min(...e.masuk) : Math.min(...e.semua);
      const akhir = e.keluar.length ? Math.max(...e.keluar) : Math.max(...e.semua);
      const pulang = akhir - masuk >= 30 ? akhir : null;
      return { nama: e.nama, tanggal: e.tanggal, masuk: jam(masuk), pulang: pulang === null ? "" : jam(pulang), keterangan: pulang === null ? "tempel sekali" : "" };
    });
    const orang = new Set(baris.map((b) => b.nama.toLowerCase())).size;
    return { jenis: "absen", keyakinan: 0.97, ringkasan: `Log mesin absen: ${dibaca} tempelan dari ${orang} orang, ${baris.length} hari kerja.`, bidang: { baris } };
  }
  return null;
}
