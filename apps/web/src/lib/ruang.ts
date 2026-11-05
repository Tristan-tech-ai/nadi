// U-01 peta ruang: SATU sumber untuk navigasi (bilah bawah, rail, sidebar), Semua menu, pencarian fitur, dan kepala halaman.
// Setiap halaman baru di /app wajib didaftarkan di sini (tes e2e/ruang dan src/lib/ruang.test.ts menolak halaman yang terlewat).
// Peran: P = pemilik dan admin, A = akuntan, S = staf. Halaman tetap memeriksa izinnya sendiri; peta ini hanya menentukan yang tampil.

export type Peran = "pemilik" | "admin" | "akuntan" | "staf";
export type Teks2 = { id: string; en: string };
export type Halaman = { href: string; label: Teks2; guna: Teks2; peran: readonly Peran[]; cari?: string };
export type Ruang = { id: string; label: Teks2; halaman: Halaman[] };

const P = ["pemilik", "admin"] as const;
const PA = ["pemilik", "admin", "akuntan"] as const;
const PS = ["pemilik", "admin", "staf"] as const;
const SEMUA = ["pemilik", "admin", "akuntan", "staf"] as const;
const h = (href: string, id: string, en: string, gId: string, gEn: string, peran: readonly Peran[], cari = ""): Halaman =>
  ({ href, label: { id, en }, guna: { id: gId, en: gEn }, peran, cari });

export const RUANG: Ruang[] = [
  { id: "hari-ini", label: { id: "Hari ini", en: "Today" }, halaman: [
    h("/app", "Feed keputusan", "Decision feed", "Usulan yang menunggu persetujuanmu, dengan buktinya.", "Proposals waiting for your approval, with evidence.", SEMUA, "beranda home usulan setujui approve"),
    h("/app/lempar", "Lempar berkas", "Drop files", "Lempar nota, Excel, slip, atau foto apa saja; Nadi membacanya jadi usulan.", "Drop receipts, spreadsheets, payslips, or photos; Nadi turns them into proposals.", SEMUA, "unggah upload nota struk foto excel"),
    h("/app/tanya", "Tanya data", "Ask your data", "Tanyakan angka usahamu dengan kalimat sehari-hari.", "Ask about your business numbers in everyday words.", PA, "pertanyaan berapa angka"),
    h("/app/wawasan", "Wawasan", "Insights", "Ringkasan orang dan usaha bulan ini, plus susun laporan sendiri.", "This month's people and business summary, plus your own reports.", P, "dasbor dashboard laporan report"),
  ] },
  { id: "uang", label: { id: "Uang", en: "Money" }, halaman: [
    h("/app/invoice", "Invoice", "Invoices", "Buat tagihan ber-QRIS dan pantau yang belum dibayar.", "Create QRIS invoices and track unpaid ones.", PA, "tagihan faktur piutang tagih"),
    h("/app/kas", "Kas dan bank", "Cash and bank", "Saldo, mutasi bank, dan pencocokan transaksi.", "Balances, bank statements, and matching.", PA, "rekening mutasi saldo bank"),
    h("/app/beli", "Pembelian", "Purchases", "Pesanan ke pemasok dan tagihan yang harus dibayar.", "Orders to suppliers and bills to pay.", PA, "pemasok supplier hutang utang beli"),
    h("/app/klaim", "Klaim pengeluaran", "Expense claims", "Ganti biaya yang dikeluarkan karyawan.", "Reimburse what employees paid.", SEMUA, "reimburse ganti biaya struk"),
    h("/app/buku", "Laporan keuangan", "Financial reports", "Neraca, laba rugi, arus kas, dan buku besar.", "Balance sheet, profit and loss, cash flow, ledger.", PA, "laba rugi neraca untung"),
    h("/app/buku/lanjut", "Akuntansi lanjutan", "Advanced accounting", "Anggaran, cabang, jurnal berulang, valas, konsolidasi.", "Budgets, branches, recurring journals, currency, consolidation.", PA, "anggaran budget valas"),
    h("/app/buku/pembiayaan", "Paket pembiayaan", "Financing pack", "Laporan 12 bulan dalam satu PDF untuk bank atau koperasi.", "A 12 month report PDF for banks or lenders.", PA, "pinjaman kredit bank pdf"),
    h("/app/pajak", "Kompas Pajak", "Tax compass", "Posisi pajak usahamu dengan dasar hukumnya.", "Your tax position with its legal basis.", PA, "pajak tax pph ppn coretax"),
    h("/app/pajak/faktur", "Faktur pajak", "Tax invoices", "Berkas impor e-Faktur dan e-Bupot untuk Coretax.", "e-Faktur and e-Bupot import files for Coretax.", PA, "efaktur ebupot coretax"),
    h("/app/aset", "Aset tetap", "Fixed assets", "Peralatan dan penyusutannya.", "Equipment and its depreciation.", PA, "penyusutan peralatan"),
    h("/app/akuntan", "Ruang Akuntan", "Accountant room", "Ajak akuntanmu dan kunci periode.", "Invite your accountant and lock periods.", PA, "akuntan accountant"),
  ] },
  { id: "jual", label: { id: "Jual dan pelanggan", en: "Sales and customers" }, halaman: [
    h("/app/kasir", "Kasir", "Point of sale", "Jual di toko, tetap jalan saat sinyal hilang.", "Sell in store, even offline.", SEMUA, "pos kasir jual toko struk"),
    h("/app/jual", "Penjualan", "Sales", "Penawaran, pesanan, dan surat jalan.", "Quotes, orders, and delivery notes.", PA, "penawaran pesanan surat jalan"),
    h("/app/pelanggan", "Pelanggan dan deal", "Customers and deals", "Daftar pelanggan, peluang, dan kunjungan sales.", "Customers, deals, and sales visits.", P, "crm pelanggan customer deal"),
    h("/app/layanan", "Layanan pelanggan", "Customer service", "Obrolan web, tiket, dan basis pengetahuan.", "Web chat, tickets, and knowledge base.", P, "tiket chat bantuan"),
    h("/app/janji-temu", "Janji temu dan katalog", "Bookings and catalog", "Jadwal janji, katalog WhatsApp, poin pelanggan.", "Bookings, WhatsApp catalog, loyalty points.", P, "booking reservasi poin katalog"),
    h("/app/servis", "Order servis", "Service orders", "Titipan servis, laundry, atau jahit dengan status untuk pelanggan.", "Service, laundry, or tailoring orders with customer status.", SEMUA, "servis laundry bengkel titipan"),
    h("/app/proyek", "Proyek", "Projects", "Anggaran proyek, realisasi, dan jam kerja.", "Project budgets, actuals, and hours.", SEMUA, "rab proyek timesheet jam"),
  ] },
  { id: "barang", label: { id: "Barang", en: "Goods" }, halaman: [
    h("/app/barang", "Barang dan stok", "Products and stock", "Produk, gudang, stok, dan hitung stok.", "Products, warehouses, stock, and counts.", P, "produk stok inventory gudang opname"),
    h("/app/produksi", "Produksi", "Production", "Resep, perintah kerja, dan biaya produksi.", "Recipes, work orders, and production cost.", P, "bom resep manufaktur"),
    h("/app/impor", "Impor", "Import", "Perkiraan biaya barang impor sampai di gudang.", "Landed cost estimate for imports.", PA, "bea cukai pib impor"),
    h("/app/ekspor", "Ekspor", "Export", "Invoice ekspor dan dokumen pabean.", "Export invoices and customs documents.", PA, "peb ekspor valas"),
  ] },
  { id: "orang", label: { id: "Orang", en: "People" }, halaman: [
    h("/app/orang", "Orang", "People", "Karyawan, topi (peran kerja), dan akun staf.", "Employees, hats (work roles), and staff accounts.", P, "karyawan pegawai staf employee"),
    h("/app/orang/kerja", "Data kerja", "Employment data", "Jabatan, atasan, riwayat, dan surat peringatan.", "Positions, managers, history, and warnings.", P, "jabatan atasan sp"),
    h("/app/kerja", "Kerja hari ini", "Today's work", "Tugas yang dibagi adil dan KPI.", "Fairly shared tasks and KPIs.", PS, "tugas task kpi"),
    h("/app/jadwal", "Jadwal", "Schedule", "Shift, libur, dan tukar jadwal.", "Shifts, holidays, and swaps.", PS, "shift jadwal libur"),
    h("/app/izin", "Izin dan cuti", "Leave", "Ajukan dan setujui izin, sakit, cuti, lembur.", "Request and approve leave and overtime.", PS, "cuti sakit lembur izin"),
    h("/app/gaji", "Gaji", "Payroll", "Hitung gaji, slip, PPh 21, BPJS.", "Payroll, payslips, income tax, social security.", PS, "slip payroll upah bpjs pph21"),
    h("/app/gaji/kasbon", "Kasbon", "Salary advances", "Pinjaman karyawan yang dicicil lewat gaji.", "Employee advances repaid through payroll.", P, "kasbon pinjaman"),
    h("/app/gaji/thr", "THR", "Religious holiday allowance", "Hitung THR menurut masa kerja.", "Holiday allowance by length of service.", P, "thr tunjangan hari raya"),
    h("/app/rekrutmen", "Rekrutmen", "Recruitment", "Lowongan, pelamar, wawancara, dan tawaran.", "Jobs, applicants, interviews, and offers.", P, "lowongan pelamar loker hiring"),
    h("/app/magang", "Magang", "Internships", "Rencana magang dan mentor.", "Internship plans and mentors.", PS, "magang pkl intern"),
    h("/app/kinerja", "Kinerja", "Performance", "Tujuan, review berkala, dan rencana pengembangan.", "Goals, reviews, and development plans.", PS, "review kpi okr penilaian"),
    h("/app/kursus", "Kursus", "Courses", "Materi kerja, kuis, dan sertifikat.", "Work material, quizzes, and certificates.", SEMUA, "pelatihan lms training sertifikat"),
    h("/app/pengumuman", "Pengumuman", "Announcements", "Kabar untuk tim dan siapa yang sudah membaca.", "News for the team and who has read it.", PS, "info kabar"),
    h("/app/survei", "Survei", "Surveys", "Survei anonim untuk tim.", "Anonymous team surveys.", PS, "survei angket"),
    h("/app/serah-terima", "Serah terima", "Handover", "Karyawan berhenti: kerja, ilmu, dan akses dipindahkan.", "Leaving employees: work, knowledge, and access handed over.", P, "resign berhenti keluar"),
    h("/app/ilmu", "Rekam ilmu", "Record knowledge", "Rekam cara kerja sebelum berhenti.", "Record how the work is done before leaving.", ["staf"], "rekam suara sop"),
  ] },
  { id: "tempat", label: { id: "Tempat dan kamera", en: "Place and cameras" }, halaman: [
    h("/app/mata", "Mata", "Eye (cameras)", "Kamera menghitung pengunjung, antrean, dan meja.", "Cameras count visitors, queues, and tables.", P, "kamera cctv antrean pengunjung"),
    h("/app/peta-usaha", "Peta usaha", "Business map", "Denah tempat usaha dan peta panas.", "Floor plan and heat map.", P, "denah peta panas heatmap"),
  ] },
  { id: "dokumen", label: { id: "Dokumen", en: "Documents" }, halaman: [
    h("/app/surat", "Surat masuk", "Incoming letters", "Agenda surat masuk bernomor.", "Numbered incoming letter register.", PA, "agenda surat"),
    h("/app/surat-keluar", "Surat keluar", "Outgoing letters", "Surat bernomor dengan QR verifikasi.", "Numbered letters with QR verification.", P, "sk surat nomor qr"),
    h("/app/tanda-tangan", "Tanda tangan", "Signatures", "Kirim dokumen untuk ditandatangani.", "Send documents for signature.", P, "ttd esign tanda tangan"),
    h("/app/kepatuhan", "Kalender kepatuhan", "Compliance calendar", "Tenggat pajak, BPJS, izin, dan kontrak.", "Tax, social security, permit, and contract deadlines.", PA, "tenggat deadline kepatuhan"),
  ] },
  { id: "otomasi", label: { id: "Otomasi dan data", en: "Automation and data" }, halaman: [
    h("/app/alur", "Alur otomatis", "Automations", "Jika terjadi sesuatu, Nadi menjalankan aksinya; juga formulir.", "When something happens, Nadi acts; plus forms.", SEMUA, "otomasi workflow formulir webhook"),
    h("/app/siapkan", "Siapkan dengan AI", "Set up with AI", "Pakai AI milikmu untuk mengisi data awal.", "Use your own AI to fill initial data.", P, "ai chatgpt mcp onboarding"),
    h("/app/pindah", "Pindah dari aplikasi lain", "Move from another app", "Bawa data dari aplikasi lama dan unduh semua data.", "Bring data from your old app and download all data.", P, "migrasi impor ekspor jurnal excel"),
    h("/app/mitra", "Mitra", "Partners", "Psikolog, akuntan publik, dan konsultan pajak.", "Psychologists, public accountants, tax consultants.", P, "konsultan psikolog"),
  ] },
  { id: "pengaturan", label: { id: "Pengaturan", en: "Settings" }, halaman: [
    h("/app/perusahaan", "Usahamu", "Your business", "Data usaha, topi, tempat, aturan kerja.", "Business details, hats, places, work rules.", PA, "pengaturan setting usaha perusahaan absen absensi hadir kehadiran tablet attendance"),
    h("/app/akun/keamanan", "Akun dan keamanan", "Account and security", "2FA, sesi, dan log aktivitas.", "2FA, sessions, and activity log.", SEMUA, "password sandi 2fa keamanan"),
  ] },
];

/** Halaman di bawah /app yang sengaja tidak masuk menu (alur sekali jalan, halaman detail, atau peta menu itu sendiri). */
export const DI_LUAR_MENU = ["/app/mulai", "/app/mulai/lanjut", "/app/wawancara/[lamaran]", "/app/menu", "/app/siapkan/draf/[id]"] as const;

export const SEMUA_HALAMAN = RUANG.flatMap((r) => r.halaman.map((x) => ({ ...x, ruang: r.id })));

/** Ruang yang punya minimal satu halaman untuk peran ini, berisi hanya halaman yang boleh dilihat. */
export function ruangUntuk(peran: string): Ruang[] {
  return RUANG.map((r) => ({ ...r, halaman: r.halaman.filter((x) => (x.peran as readonly string[]).includes(peran)) })).filter((r) => r.halaman.length > 0);
}

/** Halaman (dan ruangnya) untuk satu jalur; jalur bersarang memakai awalan terpanjang. */
export function halamanDari(jalur: string): (Halaman & { ruang: string }) | null {
  const cocok = SEMUA_HALAMAN.filter((x) => x.href === "/app" ? jalur === "/app" : jalur === x.href || jalur.startsWith(`${x.href}/`));
  return cocok.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
