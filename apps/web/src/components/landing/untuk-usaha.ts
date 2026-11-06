// L-02: halaman publik per jenis usaha (/untuk/<slug>). Isi diturunkan dari docs/research/kebutuhan-usaha.md (W-07, hari kerja 10
// jenis usaha dari BPS SE2016 + majoo) dan hanya menyebut modul yang sudah jadi. Menu yang menyala dibaca dari MODUL
// (src/lib/fitur-usaha.ts) memakai kode paket yang sama dengan aplikasi, jadi halaman ini tidak bisa berbeda dari menu sungguhan.
import type { Teks2 } from "@/lib/ruang";

export type JenisUsaha = {
  slug: string;
  paket: string;
  warna: "kunyit" | "laut" | "daun" | "cap" | "tulang";
  nama: Teks2;
  judul: Teks2;
  pendukung: Teks2;
  /** Pagi, siang, tutup: kejadian lalu yang dikerjakan Nadi. */
  hari: { saat: Teks2; kejadian: Teks2; nadi: Teks2 }[];
  fitur: string[];
  contoh: "/demo" | "/demo/toko";
};

const PAGI = { id: "Pagi", en: "Morning" };
const SIANG = { id: "Siang", en: "Midday" };
const TUTUP = { id: "Tutup", en: "Closing" };

export const JENIS_USAHA: JenisUsaha[] = [
  {
    slug: "warung", paket: "toko", warna: "kunyit", contoh: "/demo/toko",
    nama: { id: "Warung dan toko", en: "Shops and grocers" },
    judul: { id: "Nadi untuk warung dan toko", en: "Nadi for shops" },
    pendukung: { id: "Nota pemasok, kasir, dan stok di satu tempat. Kamu tinggal menyetujui dari HP.", en: "Supplier receipts, checkout, and stock in one place. You approve from your phone." },
    hari: [
      { saat: PAGI, kejadian: { id: "Barang pemasok datang dengan nota.", en: "Supplier goods arrive with a receipt." }, nadi: { id: "Foto notanya. Nadi menyiapkan catatan belanja dan stok masuk untuk kamu setujui.", en: "Snap the receipt. Nadi prepares the purchase and stock-in for you to approve." } },
      { saat: SIANG, kejadian: { id: "Pembeli bayar tunai atau QRIS.", en: "Customers pay cash or QRIS." }, nadi: { id: "Kasir tetap mencatat saat sinyal putus, lalu mengirim begitu tersambung lagi.", en: "Checkout keeps recording when the signal drops and syncs once it is back." } },
      { saat: TUTUP, kejadian: { id: "Laci dihitung.", en: "The cash drawer is counted." }, nadi: { id: "Tutup shift menghitung selisih kas dan membukukannya.", en: "Closing the shift works out the cash difference and books it." } },
    ],
    fitur: ["lempar", "feed", "tagihan", "mata"],
  },
  {
    slug: "kafe", paket: "fnb", warna: "cap", contoh: "/demo",
    nama: { id: "Kafe dan rumah makan", en: "Cafes and restaurants" },
    judul: { id: "Nadi untuk kafe dan rumah makan", en: "Nadi for cafes" },
    pendukung: { id: "Bahan, kasir, meja, dan shift karyawan tanpa buku catatan.", en: "Ingredients, checkout, tables, and staff shifts without a notebook." },
    hari: [
      { saat: PAGI, kejadian: { id: "Bahan disiapkan dari resep.", en: "Ingredients are prepared from recipes." }, nadi: { id: "Resep mengurangi stok bahan dan menghitung biaya per porsi.", en: "Recipes draw down ingredient stock and cost each portion." } },
      { saat: SIANG, kejadian: { id: "Meja penuh, antrean memanjang.", en: "Tables fill up and the queue grows." }, nadi: { id: "Mata menghitung meja terisi dan antrean di perangkatmu. Gambar tidak disimpan.", en: "Mata counts occupied tables and the queue on your device. Images are not stored." } },
      { saat: TUTUP, kejadian: { id: "Karyawan minta tukar shift.", en: "A staff member asks to swap shifts." }, nadi: { id: "Tukar shift diajukan lewat HP dan batas lemburnya diperiksa.", en: "Shift swaps are requested by phone and overtime limits are checked." } },
    ],
    fitur: ["mata", "jadwal", "absen", "gaji"],
  },
  {
    slug: "katering", paket: "produksi", warna: "daun", contoh: "/demo",
    nama: { id: "Katering dan roti", en: "Catering and bakeries" },
    judul: { id: "Nadi untuk katering dan roti", en: "Nadi for caterers" },
    pendukung: { id: "Pesanan, produksi, dan belanja bahan dihitung dari biaya sebenarnya.", en: "Orders, production, and ingredient buying costed from real prices." },
    hari: [
      { saat: PAGI, kejadian: { id: "Produksi sesuai pesanan.", en: "Production follows the orders." }, nadi: { id: "Perintah kerja mengambil bahan dari resep bertingkat dan menilai hasil dengan biaya sebenarnya.", en: "Work orders take ingredients from layered recipes and value output at actual cost." } },
      { saat: SIANG, kejadian: { id: "Pesanan diantar dan ditagih.", en: "Orders are delivered and billed." }, nadi: { id: "Tagihan dengan QRIS dikirim lewat tautan, dengan pengingat saat jatuh tempo.", en: "Invoices with QRIS go out by link, with a reminder on the due date." } },
      { saat: TUTUP, kejadian: { id: "Belanja bahan untuk besok.", en: "Ingredients are bought for tomorrow." }, nadi: { id: "Nota pasar difoto dan menjadi usulan belanja.", en: "Market receipts are photographed and become purchase suggestions." } },
    ],
    fitur: ["lempar", "tagihan", "gaji"],
  },
  {
    slug: "konveksi", paket: "produksi", warna: "laut", contoh: "/demo",
    nama: { id: "Konveksi dan penjahit", en: "Tailors and garment makers" },
    judul: { id: "Nadi untuk konveksi dan penjahit", en: "Nadi for tailors" },
    pendukung: { id: "Pesanan titipan punya tiket, tahap, dan janji selesai yang bisa dicek pelanggan.", en: "Each order gets a ticket, stages, and a due date the customer can check." },
    hari: [
      { saat: PAGI, kejadian: { id: "Pesanan seragam masuk dengan ukuran.", en: "A uniform order comes in with sizes." }, nadi: { id: "Order titipan mencatat isi pesanan dan janji selesai.", en: "The order records the details and the promised date." } },
      { saat: SIANG, kejadian: { id: "Pelanggan bertanya lewat WA: sudah sampai mana?", en: "A customer asks on WhatsApp how far along it is." }, nadi: { id: "Kirim tautan status. Pelanggan melihat tahapnya tanpa melihat data pelanggan lain.", en: "Send the status link. They see the stage without seeing anyone else's data." } },
      { saat: TUTUP, kejadian: { id: "Pesanan diambil dan dibayar.", en: "The order is collected and paid." }, nadi: { id: "Tagihan dibuat dari tiket, sekali saja.", en: "The invoice is made from the ticket, once." } },
    ],
    fitur: ["tagihan", "lempar", "gaji"],
  },
  {
    slug: "bengkel", paket: "bengkel", warna: "tulang", contoh: "/demo/toko",
    nama: { id: "Bengkel", en: "Repair workshops" },
    judul: { id: "Nadi untuk bengkel", en: "Nadi for workshops" },
    pendukung: { id: "Order servis per kendaraan, suku cadang, dan komisi mekanik sampai ke slip gaji.", en: "Service orders per vehicle, spare parts, and mechanic commission through to payslips." },
    hari: [
      { saat: PAGI, kejadian: { id: "Motor masuk dengan keluhan.", en: "A motorbike arrives with a complaint." }, nadi: { id: "Order servis mencatat kendaraan, keluhan, dan janji selesai.", en: "The service order records the vehicle, the complaint, and the due time." } },
      { saat: SIANG, kejadian: { id: "Suku cadang dipakai.", en: "Spare parts are used." }, nadi: { id: "Stok suku cadang berkurang saat tagihan dibuat dari order.", en: "Spare-part stock goes down when the invoice is made from the order." } },
      { saat: TUTUP, kejadian: { id: "Akhir bulan, komisi mekanik dihitung.", en: "At month end, mechanic commission is worked out." }, nadi: { id: "Komisi dari tagihan yang sudah lunas masuk ke slip gaji.", en: "Commission from paid invoices goes into the payslip." } },
    ],
    fitur: ["tagihan", "gaji", "absen"],
  },
  {
    slug: "salon", paket: "salon", warna: "cap", contoh: "/demo/toko",
    nama: { id: "Salon dan barbershop", en: "Salons and barbershops" },
    judul: { id: "Nadi untuk salon dan barbershop", en: "Nadi for salons" },
    pendukung: { id: "Janji temu tanpa bentrok, poin pelanggan, dan komisi kapster.", en: "Bookings without clashes, customer points, and stylist commission." },
    hari: [
      { saat: PAGI, kejadian: { id: "Pelanggan memesan jam.", en: "Customers book a time." }, nadi: { id: "Database menolak dua janji di jam yang sama.", en: "The database refuses two bookings at the same time." } },
      { saat: SIANG, kejadian: { id: "Layanan selesai, pelanggan bayar.", en: "The service is done and the customer pays." }, nadi: { id: "Kasir mencatat penjualan; poin dihitung dari tagihan yang lunas.", en: "Checkout records the sale; points are counted from paid invoices." } },
      { saat: TUTUP, kejadian: { id: "Komisi kapster dibagi.", en: "Stylist commission is shared out." }, nadi: { id: "Aturan komisi per layanan masuk ke slip gaji bulan itu.", en: "Per-service commission rules flow into that month's payslip." } },
    ],
    fitur: ["absen", "gaji", "tagihan"],
  },
  {
    slug: "laundry", paket: "laundry", warna: "laut", contoh: "/demo/toko",
    nama: { id: "Laundry", en: "Laundries" },
    judul: { id: "Nadi untuk laundry", en: "Nadi for laundries" },
    pendukung: { id: "Setiap titipan punya tiket dan status: dicuci, disetrika, siap diambil.", en: "Every drop-off gets a ticket and a status: washing, ironing, ready." },
    hari: [
      { saat: PAGI, kejadian: { id: "Cucian kiloan diterima.", en: "Laundry by the kilo is dropped off." }, nadi: { id: "Order titipan mencatat berat atau jumlah potong dan janji selesai.", en: "The order records the weight or item count and the due date." } },
      { saat: SIANG, kejadian: { id: "Status cucian maju.", en: "The laundry moves along." }, nadi: { id: "Staf memajukan status; pelanggan melihatnya lewat tautan.", en: "Staff move the status forward; the customer sees it by link." } },
      { saat: TUTUP, kejadian: { id: "Cucian diambil.", en: "The laundry is collected." }, nadi: { id: "Bayar tunai atau QRIS di kasir, lalu tiket ditutup.", en: "Pay cash or QRIS at checkout, then the ticket closes." } },
    ],
    fitur: ["tagihan", "absen", "jadwal"],
  },
  {
    slug: "kos", paket: "hotel", warna: "daun", contoh: "/demo/toko",
    nama: { id: "Kos dan penginapan", en: "Boarding houses and guesthouses" },
    judul: { id: "Nadi untuk kos dan penginapan", en: "Nadi for guesthouses" },
    pendukung: { id: "Sewa bulanan ditagih sendiri, lengkap dengan QRIS dan pengingat.", en: "Monthly rent bills itself, with QRIS and reminders." },
    hari: [
      { saat: PAGI, kejadian: { id: "Tanggal tagih sewa tiba.", en: "Rent day arrives." }, nadi: { id: "Tagihan berulang terbit pukul 06.30 WIB per penghuni, tanpa ganda.", en: "Recurring invoices go out at 06.30 WIB per tenant, never twice." } },
      { saat: SIANG, kejadian: { id: "Penghuni bayar lewat QRIS.", en: "A tenant pays by QRIS." }, nadi: { id: "Pembayaran ke rekeningmu sendiri; Nadi tidak memegang uang.", en: "Money goes to your own account; Nadi never holds it." } },
      { saat: TUTUP, kejadian: { id: "Ada kamar yang perlu diperbaiki.", en: "A room needs fixing." }, nadi: { id: "Catat sebagai kerja untuk penjaga, lalu pantau sampai selesai.", en: "Log it as a job for the caretaker and follow it to done." } },
    ],
    fitur: ["tagihan", "lempar", "feed"],
  },
  {
    slug: "kursus", paket: "pendidikan", warna: "kunyit", contoh: "/demo",
    nama: { id: "Kursus dan bimbel", en: "Courses and tutoring" },
    judul: { id: "Nadi untuk kursus dan bimbel", en: "Nadi for tutoring" },
    pendukung: { id: "SPP bulanan, jadwal pengajar, dan gaji pengajar tanpa rekap manual.", en: "Monthly fees, teacher schedules, and teacher pay without manual tallies." },
    hari: [
      { saat: PAGI, kejadian: { id: "Awal bulan, SPP ditagih.", en: "At the start of the month, fees are billed." }, nadi: { id: "Tagihan berulang terbit per siswa dengan QRIS.", en: "Recurring invoices go out per student with QRIS." } },
      { saat: SIANG, kejadian: { id: "Pengajar mengajar sesuai jadwal.", en: "Teachers teach to the schedule." }, nadi: { id: "Jadwal dan absen QR mencatat jam mengajar.", en: "The schedule and QR attendance record teaching hours." } },
      { saat: TUTUP, kejadian: { id: "Ada orang tua minta les privat.", en: "A parent asks for private lessons." }, nadi: { id: "Janji temu memesan jam tanpa bentrok dengan kelas lain.", en: "Bookings reserve a time without clashing with other classes." } },
    ],
    fitur: ["tagihan", "jadwal", "absen", "gaji"],
  },
  {
    slug: "kontraktor", paket: "konstruksi", warna: "tulang", contoh: "/demo/toko",
    nama: { id: "Kontraktor dan jasa proyek", en: "Contractors and project services" },
    judul: { id: "Nadi untuk kontraktor", en: "Nadi for contractors" },
    pendukung: { id: "Anggaran per proyek dibandingkan belanja sungguhan dan jam kerja tim.", en: "Each project budget compared with real spending and team hours." },
    hari: [
      { saat: PAGI, kejadian: { id: "Belanja material di toko bangunan.", en: "Materials are bought at the hardware store." }, nadi: { id: "Nota difoto lalu dimasukkan ke proyeknya.", en: "The receipt is photographed and assigned to its project." } },
      { saat: SIANG, kejadian: { id: "Tukang bekerja di lokasi.", en: "Workers are on site." }, nadi: { id: "Jam kerja dicatat per proyek, paling banyak 24 jam per orang per hari.", en: "Hours are logged per project, at most 24 per person per day." } },
      { saat: TUTUP, kejadian: { id: "Termin ditagih.", en: "A progress payment is billed." }, nadi: { id: "Laporan proyek menunjukkan anggaran, realisasi, dan sisa.", en: "The project report shows budget, actual, and what is left." } },
    ],
    fitur: ["lempar", "tagihan", "gaji"],
  },
];

/** L-02 halaman integrasi: hanya sambungan yang sudah berjalan, ditambah yang belum dengan alasannya. */
export type Sambungan = { kode: string; nama: Teks2; isi: Teks2; contoh: Teks2 };
export const SAMBUNGAN: Sambungan[] = [
  { kode: "mcp", nama: { id: "AI milikmu lewat MCP", en: "Your own AI through MCP" },
    isi: { id: "ChatGPT, Claude, Gemini, atau AI lain yang mendukung MCP bisa membaca data usahamu dan menyiapkan draf. Keputusan tetap di Feed.", en: "ChatGPT, Claude, Gemini, or any AI that supports MCP can read your business data and prepare drafts. Decisions stay in the Feed." },
    contoh: { id: "Sambungkan dari halaman Usahamu.", en: "Connect from the Your business page." } },
  { kode: "pintu", nama: { id: "Pintu data untuk n8n, Make, dan Zapier", en: "Data door for n8n, Make, and Zapier" },
    isi: { id: "Kirim JSON atau CSV dengan kunci usahamu. Isinya menjadi satu usulan di Feed; tidak ada yang tercatat sebelum kamu setujui.", en: "Send JSON or CSV with your business key. It becomes one suggestion in the Feed; nothing is recorded until you approve." },
    contoh: { id: "Pesanan toko online dari alur n8n masuk sebagai usulan penjualan.", en: "Online shop orders from an n8n flow arrive as sales suggestions." } },
  { kode: "webhook", nama: { id: "Webhook keluar dari alur otomatis", en: "Outgoing webhooks from automations" },
    isi: { id: "Alur bisa mengirim kejadian ke alamat https milikmu, ditandatangani HMAC-SHA256 supaya penerima tahu kirimannya asli.", en: "Automations can send events to your https address, signed with HMAC-SHA256 so the receiver knows they are genuine." },
    contoh: { id: "Saat invoice lunas, kirim pesanan ke sistem gudang.", en: "When an invoice is paid, send the order to the warehouse system." } },
  { kode: "qris", nama: { id: "QRIS usahamu", en: "Your business QRIS" },
    isi: { id: "QRIS statis usahamu tampil di tagihan dan kasir. Uang masuk langsung ke rekeningmu; Nadi tidak memegang uang.", en: "Your static business QRIS shows on invoices and at checkout. Money goes straight to your account; Nadi never holds it." },
    contoh: { id: "Pelanggan memindai dari tautan tagihan.", en: "Customers scan from the invoice link." } },
  { kode: "pindah", nama: { id: "Pindah dari aplikasi lain", en: "Moving from another app" },
    isi: { id: "Daftar akun, kontak, dan saldo awal dari Jurnal, daftar karyawan, dan daftar produk dibaca dari berkas ekspornya. Semua data bisa diunduh kembali sebagai XLSX.", en: "Chart of accounts, contacts, and opening balances from Jurnal, employee lists, and product lists are read from their export files. All data can be downloaded again as XLSX." },
    contoh: { id: "Hasilnya satu usulan yang kamu periksa dulu.", en: "The result is one suggestion you check first." } },
  { kode: "coretax", nama: { id: "Faktur pajak Coretax", en: "Coretax tax invoices" },
    isi: { id: "Invoice bulan ini disusun menjadi berkas XML impor Faktur Pajak Keluaran untuk Coretax.", en: "This month's invoices are assembled into an XML import file of output tax invoices for Coretax." },
    contoh: { id: "Unggah berkasnya sendiri di Coretax.", en: "You upload the file in Coretax yourself." } },
  { kode: "cctv", nama: { id: "CCTV yang sudah terpasang", en: "CCTV you already have" },
    isi: { id: "Hikvision, Dahua, EZVIZ, Tapo, atau kamera RTSP lain dibaca lewat jembatan go2rtc di komputer toko. Video tidak keluar dari jaringan toko.", en: "Hikvision, Dahua, EZVIZ, Tapo, or other RTSP cameras are read through a go2rtc bridge on the shop computer. Video never leaves the shop network." },
    contoh: { id: "Mata menghitung kunjungan per jam.", en: "Mata counts visits per hour." } },
  { kode: "kalender", nama: { id: "Kalender dan WhatsApp", en: "Calendars and WhatsApp" },
    isi: { id: "Undangan wawancara berupa berkas .ics untuk kalender HP mana pun, dan pesan siap kirim lewat WhatsApp. Nadi tidak mengirim pesan atas namamu.", en: "Interview invitations come as .ics files for any phone calendar, with a message ready to send on WhatsApp. Nadi never sends messages for you." },
    contoh: { id: "Tautan status servis juga dikirim lewat WhatsApp milikmu.", en: "Service status links also go out from your own WhatsApp." } },
];

export const BELUM_SAMBUNG: Teks2[] = [
  { id: "Pesanan Shopee dan TikTok Shop langsung: menunggu akun mitra platform. Sementara itu lewat Pintu data.", en: "Shopee and TikTok Shop orders directly: waiting for platform partner accounts. Until then, through the data door." },
  { id: "Mutasi langsung dari bank: belum. Unggah mutasi CSV lewat Lempar, lalu cocokkan.", en: "Bank feeds straight from the bank: not yet. Upload a CSV statement through Lempar and match it." },
  { id: "Tanda tangan elektronik tersertifikasi: butuh mitra PSrE. Nadi membuat tanda tangan tidak tersertifikasi dan menyebutnya.", en: "Certified e-signatures: need a licensed PSrE partner. Nadi makes uncertified signatures and says so." },
];
