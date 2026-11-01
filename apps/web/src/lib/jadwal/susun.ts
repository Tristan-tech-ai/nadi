// Penyusun jadwal shift (F3-06, docs/research/solver-shift.md): serakah lalu perbaikan lokal, TypeScript murni dan deterministik.
// Hanya mengusulkan; simpan_shift di database tetap menegakkan batas PP 35/2021. Batas keras di sini: topi cocok, hari yang tidak
// bisa, satu shift per orang per hari, jam normal harian dari pola (7 jam pola 6, 8 jam pola 5) tanpa lembur, 40 jam seminggu,
// hari kerja paling banyak 6 (pola 6) atau 5 (pola 5). Slot yang tidak bisa diisi dilaporkan, tidak dipaksa jadi lembur.

export type Slot = { id: string; hari: number; mulai: string; selesai: string; topi: string; butuh: number; istirahat?: number };
export type OrangJadwal = { id: string; topi: string[]; tidakBisa?: number[] };
export type Opsi = { pola: "6_hari" | "5_hari"; malamLalu?: Record<string, number>; cekLibur?: boolean };
export type Penugasan = { slot: string; orang: string; hari: number; mulai: string; selesai: string };
export type HasilJadwal = { penugasan: Penugasan[]; kosong: { slot: string; kurang: number; alasan: string }[] };

const menit = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5));
function durasi(s: { mulai: string; selesai: string }) {
  const d = menit(s.selesai) - menit(s.mulai);
  return d > 0 ? d : d + 1440;
}
const bersih = (s: Slot) => durasi(s) - (s.istirahat ?? 0);
const normalHarian = (o: Opsi) => (o.pola === "5_hari" ? 480 : 420);
const maksHari = (o: Opsi) => (o.pola === "5_hari" ? 5 : 6);

/** Shift malam = menyentuh 22.00 sampai 06.00. */
export function malamKah(s: { mulai: string; selesai: string }): boolean {
  const m = menit(s.mulai);
  const akhir = m + durasi(s);
  return m < 360 || akhir > 1320 || (akhir > 1440 && akhir - 1440 > 0);
}

export function selisihMalam(malam: Record<string, number>, ids: string[]): number {
  const n = ids.map((id) => malam[id] ?? 0);
  return n.length ? Math.max(...n) - Math.min(...n) : 0;
}

type Keadaan = { hari: Map<string, Set<number>>; menit: Map<string, number>; malam: Map<string, number>; shift: Map<string, number> };

function bisa(o: OrangJadwal, s: Slot, k: Keadaan, opsi: Opsi): boolean {
  if (!o.topi.includes(s.topi) || o.tidakBisa?.includes(s.hari)) return false;
  const hari = k.hari.get(o.id)!;
  if (hari.has(s.hari)) return false;
  if (bersih(s) > normalHarian(opsi)) return false;
  if ((k.menit.get(o.id) ?? 0) + bersih(s) > 2400) return false;
  if (opsi.cekLibur !== false && hari.size + 1 > maksHari(opsi)) return false;
  return true;
}

function pasang(o: string, s: Slot, k: Keadaan, tanda: 1 | -1) {
  if (tanda === 1) k.hari.get(o)!.add(s.hari);
  else k.hari.get(o)!.delete(s.hari);
  k.menit.set(o, (k.menit.get(o) ?? 0) + tanda * bersih(s));
  k.shift.set(o, (k.shift.get(o) ?? 0) + tanda);
  if (malamKah(s)) k.malam.set(o, (k.malam.get(o) ?? 0) + tanda);
}

export function susunJadwal(slot: Slot[], orang: OrangJadwal[], opsi: Opsi): HasilJadwal {
  const k: Keadaan = { hari: new Map(), menit: new Map(), malam: new Map(), shift: new Map() };
  for (const o of orang) {
    k.hari.set(o.id, new Set());
    k.malam.set(o.id, opsi.malamLalu?.[o.id] ?? 0);
  }
  const calon = (s: Slot) => orang.filter((o) => o.topi.includes(s.topi) && !o.tidakBisa?.includes(s.hari)).length;
  const urut = [...slot].sort((a, b) => Number(malamKah(b)) - Number(malamKah(a)) || calon(a) - calon(b) || a.hari - b.hari || a.mulai.localeCompare(b.mulai) || a.id.localeCompare(b.id));
  const isi = new Map<string, string[]>();
  const kosong: HasilJadwal["kosong"] = [];
  for (const s of urut) {
    const dapat: string[] = [];
    for (let i = 0; i < s.butuh; i++) {
      const malam = malamKah(s);
      const pilih = orang.filter((o) => !dapat.includes(o.id) && bisa(o, s, k, opsi)).sort((a, b) =>
        (malam ? (k.malam.get(a.id)! - k.malam.get(b.id)!) || ((k.shift.get(a.id) ?? 0) - (k.shift.get(b.id) ?? 0))
               : ((k.shift.get(a.id) ?? 0) - (k.shift.get(b.id) ?? 0)) || (k.malam.get(a.id)! - k.malam.get(b.id)!)) || a.id.localeCompare(b.id))[0];
      if (!pilih) break;
      pasang(pilih.id, s, k, 1);
      dapat.push(pilih.id);
    }
    isi.set(s.id, dapat);
    if (dapat.length < s.butuh) {
      kosong.push({ slot: s.id, kurang: s.butuh - dapat.length, alasan: `Hari ke-${s.hari + 1} ${s.mulai}-${s.selesai} butuh ${s.butuh - dapat.length} ${s.topi} lagi: tidak ada yang masih punya jam atau hari kerja` });
    }
  }
  // Perbaikan lokal: pindahkan shift malam dari yang paling banyak ke yang paling sedikit selama sah dan selisih turun.
  const perSlot = new Map(slot.map((s) => [s.id, s]));
  for (let langkah = 0; langkah < 2000; langkah++) {
    let maju = false;
    for (const s of urut.filter(malamKah)) {
      const isiS = isi.get(s.id)!;
      const sekelompok = orang.filter((o) => o.topi.includes(s.topi));
      const banyak = [...isiS].sort((a, b) => k.malam.get(b)! - k.malam.get(a)! || a.localeCompare(b))[0];
      const sedikit = sekelompok.filter((o) => !isiS.includes(o.id)).sort((a, b) => k.malam.get(a.id)! - k.malam.get(b.id)! || a.id.localeCompare(b.id))[0];
      if (!banyak || !sedikit || k.malam.get(banyak)! - k.malam.get(sedikit.id)! < 2) continue;
      pasang(banyak, s, k, -1);
      if (bisa(sedikit, s, k, opsi)) {
        pasang(sedikit.id, s, k, 1);
        isi.set(s.id, isiS.map((x) => (x === banyak ? sedikit.id : x)));
        maju = true;
      } else {
        pasang(banyak, s, k, 1);
      }
    }
    if (!maju) break;
  }
  const penugasan = [...isi].flatMap(([id, ids]) => ids.map((o) => ({ slot: id, orang: o, hari: perSlot.get(id)!.hari, mulai: perSlot.get(id)!.mulai, selesai: perSlot.get(id)!.selesai })))
    .sort((a, b) => a.hari - b.hari || a.mulai.localeCompare(b.mulai) || a.orang.localeCompare(b.orang));
  return { penugasan, kosong: kosong.sort((a, b) => a.slot.localeCompare(b.slot)) };
}

/** Pelanggaran batas keras pada hasil (kosong = sah). Dipakai tes dan layar sebelum menyimpan. */
export function periksa(h: HasilJadwal, slot: Slot[], orang: OrangJadwal[], opsi: Opsi): string[] {
  const perSlot = new Map(slot.map((s) => [s.id, s]));
  const perOrang = new Map(orang.map((o) => [o.id, o]));
  const salah: string[] = [];
  const hari = new Map<string, number[]>();
  const jam = new Map<string, number>();
  const isi = new Map<string, number>();
  for (const p of h.penugasan) {
    const s = perSlot.get(p.slot)!;
    const o = perOrang.get(p.orang)!;
    if (!o.topi.includes(s.topi)) salah.push(`${p.orang} tidak bertopi ${s.topi}`);
    if (o.tidakBisa?.includes(s.hari)) salah.push(`${p.orang} tidak bisa hari ke-${s.hari + 1}`);
    if (bersih(s) > normalHarian(opsi)) salah.push(`${p.slot} lebih dari jam normal harian`);
    hari.set(p.orang, [...(hari.get(p.orang) ?? []), s.hari]);
    jam.set(p.orang, (jam.get(p.orang) ?? 0) + bersih(s));
    isi.set(p.slot, (isi.get(p.slot) ?? 0) + 1);
  }
  for (const [o, hs] of hari) {
    if (new Set(hs).size !== hs.length) salah.push(`${o} dua shift di hari yang sama`);
    if (new Set(hs).size > maksHari(opsi)) salah.push(`${o} kurang hari libur (${new Set(hs).size} hari kerja)`);
  }
  for (const [o, m] of jam) if (m > 2400) salah.push(`${o} lebih dari 40 jam seminggu`);
  for (const [id, n] of isi) if (n > perSlot.get(id)!.butuh) salah.push(`${id} kelebihan orang`);
  return salah;
}
