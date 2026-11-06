// L-14 navigasi halaman depan bertingkat (setara menu Produk, Solusi, Resources Mekari, dilihat Tristan 6 Nov 2026).
// Fitur tetap memakai daftar k.fitur; dua panel lain didefinisikan di sini. Setiap tautan diuji menuju halaman yang ada.
import { JENIS_USAHA } from "@/components/landing/untuk-usaha";
import type { Bahasa } from "@/lib/i18n/bahasa";

type T2 = { id: string; en: string };
export type ButirMenu = { href: string; label: string; ket: string };
export type KelompokMenu = { judul: string; butir: ButirMenu[]; semua?: { href: string; label: string } };
export type PanelMenu = { id: string; label: string; kelompok: KelompokMenu[] };

const b = (href: string, label: T2, ket: T2) => ({ href, label, ket });
// Halaman yang punya versi /en: diberi awalan bahasa. Sisanya (kamus, alat, yang baru) hanya berbahasa Indonesia.
const PUNYA_EN = ["/untuk", "/panduan", "/integrasi", "/keamanan", "/privasi", "/tentang", "/harga", "/bantuan"];

const SOLUSI = {
  label: { id: "Solusi", en: "Solutions" },
  kelompok: [
    { judul: { id: "Jenis usaha", en: "Business types" },
      butir: JENIS_USAHA.map((j) => b(`/untuk/${j.slug}`, j.nama, j.pendukung)),
      semua: { href: "/untuk", label: { id: "Semua jenis usaha", en: "All business types" } } },
    { judul: { id: "Peran", en: "Roles" }, butir: [
      b("/panduan#pemilik", { id: "Pemilik", en: "Owner" }, { id: "Memutuskan uang, orang, dan aturan dari HP.", en: "Decides money, people, and rules from a phone." }),
      b("/panduan#admin", { id: "Admin", en: "Admin" }, { id: "Merapikan data orang, berkas, dan jadwal.", en: "Keeps people, files, and schedules tidy." }),
      b("/panduan#akuntan", { id: "Akuntan", en: "Accountant" }, { id: "Laporan keuangan, pajak, dan kunci periode.", en: "Financial reports, tax, and period locks." }),
      b("/panduan#staf", { id: "Staf", en: "Staff" }, { id: "Absen, izin, kerja, dan slip tanpa email.", en: "Attendance, leave, work, and payslips without email." }),
    ] },
    { judul: { id: "Sambungan", en: "Connections" }, butir: [
      b("/integrasi", { id: "Integrasi", en: "Integrations" }, { id: "Sambungan yang sudah berjalan dan yang belum.", en: "Connections that work today and those that do not yet." }),
      b("/bantuan/artikel/sambung-ai", { id: "Sambungkan AI-mu", en: "Connect your AI" }, { id: "ChatGPT, Gemini, atau AI lain lewat MCP.", en: "ChatGPT, Gemini, or another AI through MCP." }),
      b("/bantuan/artikel/pindah-aplikasi", { id: "Pindah dari aplikasi lain", en: "Move from another app" }, { id: "Bawa akun, kontak, karyawan, dan produk.", en: "Bring accounts, contacts, employees, and products." }),
    ] },
  ],
};

const SUMBER = {
  label: { id: "Sumber belajar", en: "Resources" },
  kelompok: [
    { judul: { id: "Panduan dan literasi", en: "Guides" }, butir: [
      b("/bantuan", { id: "Pusat bantuan", en: "Help center" }, { id: "Cara memakai setiap layar Nadi.", en: "How to use every Nadi screen." }),
      b("/panduan", { id: "Panduan per peran", en: "Guide by role" }, { id: "Langkah untuk pemilik, admin, akuntan, dan staf.", en: "Steps for owners, admins, accountants, and staff." }),
      b("/kamus", { id: "Kamus istilah", en: "Glossary (Indonesian)" }, { id: "PPh 21, BPJS, piutang, dan istilah lain.", en: "Income tax, social security, receivables, and more." }),
      b("/baru", { id: "Yang baru", en: "What is new (Indonesian)" }, { id: "Fitur yang baru bisa dipakai.", en: "Features you can use now." }),
    ] },
    { judul: { id: "Alat gratis tanpa akun", en: "Free tools (Indonesian)" }, butir: [
      b("/alat/gaji", { id: "Kalkulator gaji bersih", en: "Take-home pay calculator" }, { id: "PPh 21, BPJS, dan lembur.", en: "Income tax, social security, overtime." }),
      b("/alat/thr", { id: "Kalkulator THR", en: "THR calculator" }, { id: "Tunjangan hari raya menurut masa kerja.", en: "Religious holiday allowance by service length." }),
      b("/alat/pesangon", { id: "Kalkulator pesangon", en: "Severance calculator" }, { id: "Pesangon dan kompensasi kontrak.", en: "Severance and contract compensation." }),
      b("/alat/slip", { id: "Slip gaji online", en: "Online payslip" }, { id: "Slip siap cetak atau PDF.", en: "A payslip ready to print or save." }),
      b("/alat/invoice", { id: "Pembuat invoice", en: "Invoice maker" }, { id: "Invoice bernomor, total otomatis.", en: "Numbered invoice, automatic total." }),
      b("/alat/dokumen", { id: "Templat dokumen kerja", en: "Work document templates" }, { id: "Surat keterangan, peringatan, izin.", en: "Employment letters, warnings, leave forms." }),
    ], semua: { href: "/alat", label: { id: "Semua alat gratis", en: "All free tools" } } },
    { judul: { id: "Tentang Nadi", en: "About Nadi" }, butir: [
      b("/tentang", { id: "Tentang", en: "About" }, { id: "Siapa yang membuat Nadi dan kenapa.", en: "Who builds Nadi and why." }),
      b("/keamanan", { id: "Keamanan", en: "Security" }, { id: "Cara data usahamu dijaga.", en: "How your business data is protected." }),
      b("/demo", { id: "Coba usaha contoh", en: "Try the sample business" }, { id: "Aplikasi sungguhan tanpa daftar.", en: "The real app without signing up." }),
    ] },
  ],
};

const jalur = (href: string, awal: string) => (awal && PUNYA_EN.some((p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}#`)) ? `${awal}${href}` : href);

export function panelMenu(bahasa: Bahasa, awal: string): PanelMenu[] {
  const l = (t: T2) => (bahasa === "en" ? t.en : t.id);
  return ([["solusi", SOLUSI], ["sumber", SUMBER]] as const).map(([id, p]) => ({
    id, label: l(p.label),
    kelompok: p.kelompok.map((k) => ({
      judul: l(k.judul),
      butir: k.butir.map((x) => ({ href: jalur(x.href, awal), label: l(x.label), ket: l(x.ket) })),
      semua: "semua" in k && k.semua ? { href: jalur(k.semua.href, awal), label: l(k.semua.label) } : undefined,
    })),
  }));
}
