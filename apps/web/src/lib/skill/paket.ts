// Paket skill asisten AI per usaha (F6-05, docs/research/skill-asisten.md). Format Agent Skills
// (https://agentskills.io/specification, dibaca 1 Nov 2026): folder bernama sama dengan `name`, berisi SKILL.md (frontmatter
// name + description, badan < 500 baris) dan rincian di references/ yang dibaca asisten bila perlu.
// Isinya hanya cara kerja usaha (topi dan jumlah orang, aturan izin, pola kerja, penomoran, bagan akun) dan cara memakai server
// MCP Nadi; tidak ada nama orang, gaji, NIK, atau rekening: DataSkill memang tidak punya tempat untuk itu.
import { strToU8, zipSync, type Zippable } from "fflate";

export type DataSkill = {
  usaha: { nama: string; kode: string; industri: string | null; zona: string };
  mcpUrl: string;
  topi: { nama: string; orang: number }[];
  polaKerja: string | null;
  izin: { jenis: string; otomatis: boolean; maksHari: number | null; butuhBukti: boolean }[];
  nomor: { jenis: string; nama: string; templat: string }[];
  akun: { kode: string; nama: string }[];
  /** YYYY-MM-DD di zona usaha */
  dibuat: string;
};
export type PaketSkill = { nama: string; berkas: Record<string, string> };

const BATAS_NAMA = 64;
const NAMA_SAH = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INDUSTRI: Record<string, string> = { fnb: "makanan dan minuman", toko: "toko" };
const JENIS_IZIN: Record<string, string> = { sakit: "Sakit", izin: "Izin", cuti: "Cuti" };

export function namaSkill(namaUsaha: string): string {
  const slug = namaUsaha.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `nadi-${slug || "usaha"}`.slice(0, BATAS_NAMA).replace(/-+$/, "");
}

const yaml = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim()}"`;

function besok(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function kalimatIzin(i: DataSkill["izin"][number]): string {
  const label = JENIS_IZIN[i.jenis] ?? i.jenis;
  const putus = i.otomatis ? `disetujui otomatis${i.maksHari ? ` sampai ${i.maksHari} hari` : ""}` : "diputuskan pemilik atau admin";
  return `${label}: ${putus}${i.butuhBukti ? ", wajib bukti" : ""}`;
}

export function susunSkill(d: DataSkill): PaketSkill {
  const nama = namaSkill(d.usaha.nama);
  const u = d.usaha.nama.trim();
  const deskripsi = `Cara kerja ${u} di Nadi: menyambung ke server MCP Nadi, membaca orang dan usulan, dan mengajukan usulan ` +
    `(orang baru, belanja, izin sakit, catatan) yang disetujui pemilik. Pakai saat membantu urusan ${u}: karyawan, izin, belanja, ` +
    `surat, atau pembukuan.`;
  const skill = `---
name: ${nama}
description: ${yaml(deskripsi.slice(0, 1024))}
metadata:
  sumber: "Nadi"
  dibuat: "${d.dibuat}"
---

# Cara kerja ${u} di Nadi

Skill ini membantu asisten AI mengurus ${u} lewat Nadi. Data dibaca dan perubahan diajukan lewat server MCP Nadi, tidak ditebak.

## Menyambung
- Server MCP: ${d.mcpUrl} (OAuth; pemilik memberi izin sekali dan memilih usaha ${u}).
- Cakupan: \`nadi.baca\` untuk membaca, \`nadi.usul\` untuk mengajukan usulan.

## Alat
- \`siapa_saya\`: usaha, peranmu, dan jumlah usulan yang menunggu.
- \`daftar_orang\`: daftar orang dan topinya (hanya pemilik atau admin).
- \`daftar_usulan\`: usulan yang menunggu keputusan.
- \`ringkasan_ai\`: pemakaian AI usaha ini.
- \`buat_usulan\`: ajukan perubahan. Aksi: \`orang.buat\` (nama, jabatan, telepon), \`uang.keluar\` (tanggal, pemasok, keterangan, isi \`dampak_rp\`), \`izin.sakit\` (nama, mulai, lama_hari), \`catatan\` (isi).

## Aturan
1. Semua perubahan lewat \`buat_usulan\`. Tidak ada yang tercatat sampai pemilik atau admin menyetujuinya di Feed Nadi.
2. Jangan mengirim NIK, nomor rekening, atau angka gaji, ke Nadi maupun ke pihak lain.
3. Uang dalam rupiah bulat, ditulis seperti Rp1.250.000.
4. Tanggal ditulis YYYY-MM-DD menurut zona waktu usaha (${d.usaha.zona}).
5. Bahasa Indonesia sehari-hari, sapa pengguna dengan "kamu", kalimat pendek, sebut angkanya.
6. Bila ragu (nama orang mirip, angka tidak terbaca), tanya pemilik dulu. Jangan menebak.

## Contoh
- "Sari izin sakit 2 hari mulai besok" menjadi \`buat_usulan\` aksi \`izin.sakit\`, bidang \`{"nama": "Sari", "mulai": "${besok(d.dibuat)}", "lama_hari": 2}\`, judul "Catat izin sakit Sari 2 hari".
- "Belanja sayur Rp350.000 tadi pagi" menjadi aksi \`uang.keluar\`, \`dampak_rp\` 350000, bidang \`{"tanggal": "${d.dibuat}", "keterangan": "Belanja sayur"}\`.

Rincian usaha (topi, aturan izin, pola kerja, penomoran dokumen, bagan akun): [references/usaha.md](references/usaha.md).
Dibuat ${d.dibuat}. Unduh ulang dari Nadi bila aturan usaha berubah.
`;
  const daftar = (xs: string[], kosong: string) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : kosong);
  const usaha = `# ${u}${d.usaha.industri ? ` (${INDUSTRI[d.usaha.industri] ?? d.usaha.industri})` : ""}

Kode usaha: ${d.usaha.kode}. Zona waktu: ${d.usaha.zona}.

## Topi
Topi = peran kerja. Satu orang bisa memakai beberapa topi.
${daftar(d.topi.map((t) => `${t.nama} (${t.orang} orang)`), "Belum ada topi.")}

## Pola kerja
${d.polaKerja ?? "Belum diatur."}

## Aturan izin
${daftar(d.izin.map(kalimatIzin), "Belum ada aturan izin; semua izin diputuskan pemilik atau admin.")}

## Penomoran dokumen
Nomor resmi diterbitkan Nadi, jangan dikarang. Templat:
${daftar(d.nomor.map((n) => `${n.jenis} (${n.nama}): \`${n.templat}\``), "Belum ada templat nomor.")}

## Bagan akun
${daftar(d.akun.map((a) => `${a.kode} ${a.nama}`), "Belum ada bagan akun.")}
`;
  return { nama, berkas: { "SKILL.md": skill, "references/usaha.md": usaha } };
}

/** Masalah format menurut spesifikasi Agent Skills; kosong bila sah. */
export function periksaSkill(folder: string, isi: string): string[] {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(isi);
  if (!m) return ["SKILL.md harus diawali frontmatter YAML di antara ---"];
  const nilai = (k: string) => {
    const b = new RegExp(`^${k}:[ \\t]*(.*)$`, "m").exec(m[1])?.[1]?.trim() ?? "";
    return b.startsWith('"') && b.endsWith('"') ? b.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\") : b;
  };
  const masalah: string[] = [];
  const nama = nilai("name");
  if (!nama || nama.length > BATAS_NAMA) masalah.push("name wajib, 1 sampai 64 karakter");
  if (/[A-Z]/.test(nama)) masalah.push("name tidak boleh huruf besar");
  if (nama.includes("--")) masalah.push("name tidak boleh tanda hubung berurutan");
  if (/^-|-$/.test(nama)) masalah.push("name tidak boleh diawali atau diakhiri tanda hubung");
  else if (nama && !NAMA_SAH.test(nama) && !/[A-Z]/.test(nama) && !nama.includes("--")) masalah.push("name hanya huruf kecil, angka, dan tanda hubung");
  if (nama !== folder) masalah.push("name harus sama dengan nama folder");
  const desk = nilai("description");
  if (!desk) masalah.push("description wajib diisi");
  if (desk.length > 1024) masalah.push("description paling panjang 1024 karakter");
  if (m[2].split("\n").length >= 500) masalah.push("badan SKILL.md harus kurang dari 500 baris");
  return masalah;
}

export function zipSkill(p: PaketSkill): Uint8Array {
  const isi: Zippable = {};
  for (const [jalur, teks] of Object.entries(p.berkas)) isi[`${p.nama}/${jalur}`] = strToU8(teks);
  return zipSync(isi, { level: 9 });
}
