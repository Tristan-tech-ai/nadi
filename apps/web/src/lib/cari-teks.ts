import type { Bahasa } from "@/lib/i18n/bahasa";
import type { TeksCari } from "@/components/app/cari-fitur";

// Teks dialog cari fitur (U-02) dua bahasa; dipakai kerangka aplikasi dan halaman Semua menu.
export function teksCari(b: Bahasa): TeksCari {
  return b === "en"
    ? { judul: "Find a feature", isian: "What do you want to do?", petunjuk: "Type an everyday word, for example payroll, stock, or invoice.",
        kosong: "No feature matches that word.", semuaMenu: "See all menus", tutup: "Close", hasil: "Matching features" }
    : { judul: "Cari fitur", isian: "Mau mengerjakan apa?", petunjuk: "Ketik kata sehari-hari, misalnya gaji, stok, atau tagihan.",
        kosong: "Belum ada fitur dengan kata itu.", semuaMenu: "Lihat semua menu", tutup: "Tutup", hasil: "Fitur yang cocok" };
}
