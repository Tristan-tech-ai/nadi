import type { Bahasa } from "@/lib/i18n/bahasa";

// ADMIN-01: teks bagian Admin usaha di halaman Orang (id dan en).
export const TEKS_ADMIN = {
  id: {
    bahasa: "id" as Bahasa,
    judul: "Admin usaha",
    ket: "Admin mengurus hampir semua hal di usaha ini, termasuk gaji dan persetujuan di Feed. Hanya pemilik yang bisa menambah atau mencabut admin.",
    kosong: "Belum ada admin. Tambahkan orang yang kamu percaya, misalnya kepala toko.",
    email: "Email akun Nadi calon admin",
    paham: "Aku paham admin bisa melihat gaji dan menyetujui usulan.",
    tambah: "Jadikan admin", menyimpan: "Menyimpan...", aria: "Tambah admin",
    cabut: "Cabut admin", yakin: "Cabut akses admin {email}? Ia tidak bisa membuka usaha ini lagi sebagai admin.", ya: "Ya, cabut", batal: "Batal",
    dicabut: "Dicabut", aktif: "Admin aktif",
    ditambah: "Bila email itu sudah punya akun Nadi, ia kini admin usaha ini.", dicabutPesan: "Akses admin dicabut.",
    wajibPaham: "Centang dulu bahwa kamu paham hak admin.", emailSalah: "Tulis email akun Nadi milik calon admin.",
    hanyaPemilik: "Hanya pemilik yang mengatur admin.", gagal: "Nadi gagal menyimpan. Coba lagi sebentar.", gagalCabut: "Nadi gagal mencabut akses. Coba lagi sebentar.",
  },
  en: {
    bahasa: "en" as Bahasa,
    judul: "Business admins",
    ket: "Admins handle almost everything in this business, including payroll and approvals in the Feed. Only the owner can add or remove admins.",
    kosong: "No admins yet. Add someone you trust, such as a store manager.",
    email: "Nadi account email of the new admin",
    paham: "I understand admins can see payroll and approve proposals.",
    tambah: "Make admin", menyimpan: "Saving...", aria: "Add admin",
    cabut: "Remove admin", yakin: "Remove admin access for {email}? They can no longer open this business as an admin.", ya: "Yes, remove", batal: "Cancel",
    dicabut: "Removed", aktif: "Active admin",
    ditambah: "If that email has a Nadi account, it is now an admin of this business.", dicabutPesan: "Admin access removed.",
    wajibPaham: "Tick the box to confirm you understand what admins can do.", emailSalah: "Enter the Nadi account email of the new admin.",
    hanyaPemilik: "Only the owner manages admins.", gagal: "Nadi could not save this. Try again in a moment.", gagalCabut: "Nadi could not remove access. Try again in a moment.",
  },
} as const satisfies Record<Bahasa, Record<string, string>>;
export type TeksAdmin = (typeof TEKS_ADMIN)[Bahasa];
