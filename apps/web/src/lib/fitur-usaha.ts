// U-06 fitur per jenis usaha: modul opsional, nyala bawaannya menurut paket industri (perusahaan.industri), lalu pilihan pemilik
// (perusahaan.pengaturan.fitur, ditulis RPC set_feature_module) menang. Halaman di luar modul selalu tampil. Usaha tanpa paket
// melihat semuanya, supaya usaha lama tidak kehilangan menu. Modul yang mati hanya disembunyikan dari menu; halamannya tetap bisa
// dicari dan dibuka. Daftar kode modul juga ada di SQL (app.feature_modules) dan dicocokkan tes SQL.
import type { Teks2 } from "@/lib/ruang";

export type Modul = { kode: string; label: Teks2; guna: Teks2; halaman: readonly string[]; paket: readonly string[] };

export const MODUL: readonly Modul[] = [
  { kode: "kasir", label: { id: "Kasir", en: "Point of sale" }, guna: { id: "Jual di toko dan struk.", en: "Sell in store with receipts." },
    halaman: ["/app/kasir"], paket: ["toko", "fnb", "salon", "laundry", "bengkel", "pertanian"] },
  { kode: "stok", label: { id: "Barang dan stok", en: "Products and stock" }, guna: { id: "Produk, gudang, hitung stok.", en: "Products, warehouses, counts." },
    halaman: ["/app/barang"], paket: ["toko", "fnb", "produksi", "bengkel", "pertanian", "logistik", "konstruksi", "klinik"] },
  { kode: "produksi", label: { id: "Produksi", en: "Production" }, guna: { id: "Resep dan perintah kerja.", en: "Recipes and work orders." },
    halaman: ["/app/produksi"], paket: ["produksi", "fnb", "pertanian"] },
  { kode: "dagang_luar", label: { id: "Impor dan ekspor", en: "Import and export" }, guna: { id: "Biaya impor, invoice ekspor.", en: "Import costs, export invoices." },
    halaman: ["/app/impor", "/app/ekspor"], paket: ["produksi", "logistik"] },
  { kode: "servis", label: { id: "Order servis", en: "Service orders" }, guna: { id: "Titipan servis, laundry, jahit.", en: "Repairs, laundry, tailoring." },
    halaman: ["/app/servis"], paket: ["bengkel", "laundry"] },
  { kode: "janji", label: { id: "Janji temu dan katalog", en: "Bookings and catalog" }, guna: { id: "Jadwal janji pelanggan dan katalog.", en: "Customer bookings and catalog." },
    halaman: ["/app/janji-temu"], paket: ["salon", "klinik", "pendidikan", "bengkel", "hotel"] },
  { kode: "proyek", label: { id: "Proyek", en: "Projects" }, guna: { id: "Anggaran proyek dan jam kerja.", en: "Project budgets and timesheets." },
    halaman: ["/app/proyek"], paket: ["konstruksi", "kantor"] },
  { kode: "mata", label: { id: "Mata dan peta usaha", en: "Vision and floor map" }, guna: { id: "Kamera menghitung pengunjung, denah tempat.", en: "Cameras count visitors; floor plan." },
    halaman: ["/app/mata", "/app/peta-usaha"], paket: ["toko", "fnb", "hotel", "salon", "klinik"] },
  { kode: "crm", label: { id: "Pelanggan dan deal", en: "Customers and deals" }, guna: { id: "Peluang penjualan dan kunjungan sales.", en: "Sales pipeline and visits." },
    halaman: ["/app/pelanggan", "/app/jual"], paket: ["toko", "kantor", "konstruksi", "logistik", "produksi", "pertanian", "pendidikan"] },
  { kode: "layanan", label: { id: "Layanan pelanggan", en: "Customer service" }, guna: { id: "Obrolan web, tiket, basis pengetahuan.", en: "Web chat, tickets, knowledge base." },
    halaman: ["/app/layanan"], paket: ["kantor", "hotel", "klinik", "pendidikan", "logistik"] },
];

export const KODE_MODUL = MODUL.map((m) => m.kode);

/** Modul yang menyala untuk satu usaha: bawaan paket, ditimpa pilihan pemilik. Tanpa paket: semua menyala. */
export function modulNyala(industri: string | null | undefined, pilihan: Record<string, unknown> | null | undefined): Set<string> {
  const nyala = new Set<string>();
  for (const m of MODUL) {
    const p = pilihan?.[m.kode];
    const bawaan = !industri || m.paket.includes(industri);
    if (typeof p === "boolean" ? p : bawaan) nyala.add(m.kode);
  }
  return nyala;
}

/** Halaman yang disembunyikan dari menu karena modulnya mati. */
export function halamanTersembunyi(nyala: ReadonlySet<string>): Set<string> {
  return new Set(MODUL.filter((m) => !nyala.has(m.kode)).flatMap((m) => m.halaman));
}

export const modulHalaman = (href: string) => MODUL.find((m) => m.halaman.includes(href));
