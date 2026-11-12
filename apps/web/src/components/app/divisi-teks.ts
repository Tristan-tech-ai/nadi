import type { Bahasa } from "@/lib/i18n/bahasa";

// X-13 divisi: teks bagian Divisi di halaman Orang (id dan en).
export const TEKS_DIVISI = {
  id: {
    judul: "Divisi",
    ket: "Kepala divisi menyetujui izin anggotanya bila mereka belum punya atasan langsung, lalu meninjau hasil kerja anggota. Kepala divisi tetap tidak melihat gaji.",
    kosong: "Belum ada divisi. Buat divisi pertama, misalnya Desain atau Gudang.",
    kepala: "kepala", belumKepala: "belum ada", anggota: "anggota", ubah: "Ubah divisi", buat: "Buat divisi",
    nama: "Nama divisi", kepalaLabel: "Kepala divisi", tanpaKepala: "Belum ada kepala", anggotaLabel: "Anggota", simpan: "Simpan divisi",
    namaPanjang: "Nama divisi 2 sampai 60 huruf.", sudahAda: "Divisi {nama} sudah ada. Pakai nama lain atau ubah divisi itu.",
    gagal: "Nadi gagal menyimpan divisi. Coba lagi sebentar.", tersimpan: "Divisi {nama} tersimpan dengan {n} anggota.",
  },
  en: {
    judul: "Divisions",
    ket: "A division head approves leave for members without a direct manager, then reviews members' work results. Division heads still cannot see payroll.",
    kosong: "No divisions yet. Create the first one, for example Design or Warehouse.",
    kepala: "head", belumKepala: "none yet", anggota: "members", ubah: "Edit division", buat: "Create division",
    nama: "Division name", kepalaLabel: "Division head", tanpaKepala: "No head yet", anggotaLabel: "Members", simpan: "Save division",
    namaPanjang: "Division name must be 2 to 60 characters.", sudahAda: "Division {nama} already exists. Use another name or edit that division.",
    gagal: "Nadi could not save the division. Try again in a moment.", tersimpan: "Division {nama} saved with {n} members.",
  },
} as const satisfies Record<Bahasa, Record<string, string>>;
export type TeksDivisi = (typeof TEKS_DIVISI)[Bahasa];
