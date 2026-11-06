# Halaman publik Mekari dan Nadi (L-02)

Dilihat 6 Nov 2026. Sumber peta: sitemap resmi `https://mekari.com/sitemap.xml` (page-sitemap 1-5, 345 URL halaman, di luar artikel blog), ditambah tiga halaman yang dibaca isinya: `https://mekari.com/solusi/`, `https://mekari.com/solusi/bisnis/industri-fnb/`, `https://mekari.com/integrasi/`. Yang dicatat di sini hanya jenis halaman dan susunannya. Teks Mekari tidak disalin.

## 1. Peta halaman Mekari

| Jenis halaman | Jumlah URL (id + en) | Contoh URL | Susunan |
|---|---|---|---|
| Landing | 2 | `/` | Pahlawan, logo pelanggan, angka pelanggan, produk, testimoni, ajakan konsultasi |
| Produk dan modul | 165 | `/produk/...` | Satu halaman per produk dan per modul (Talenta, Jurnal, Qontak, Klikpajak, Flex, Expense, Sign, Officeless, dll.) |
| Solusi per skala | 6 | `/solusi/bisnis/skala-umkm/`, `skala-startup`, `skala-enterprise` | Kartu ikon + judul "Mekari untuk ..." + satu kalimat |
| Solusi per divisi | 14 | `/solusi/divisi-hr/`, `divisi-keuangan`, `divisi-sales`, `divisi-marketing`, `divisi-it`, `divisi-legal`, `divisi-procurement` | Sama dengan per skala |
| Solusi per industri | sekitar 48 (24 industri) | `/solusi/bisnis/industri-fnb/`, `industri-ritel`, `industri-manufaktur`, `industri-salon-dan-gym`, `industri-bakery-dan-catering`, `industri-pendidikan`, ... | Pahlawan + ajakan konsultasi; lima blok persentase tantangan; lima kategori solusi (HR, keuangan, pelanggan, pengeluaran, teknologi) masing-masing menautkan produk; enam alasan; dua testimoni; tiga kelompok FAQ; ajakan penutup |
| Solusi alternatif sistem | 2 | `/solusi/alternatif/learning-management-system/` | "Alternatif untuk LMS, ERP, CRM, payroll, WhatsApp API, HRIS" |
| Profesional | 2 | `/solusi/profesional/` | Untuk akuntan dan konsultan |
| Harga | 6 | `/harga/`, `/harga/expense/`, `/harga/stream/` | Per produk |
| Integrasi | 1 | `/integrasi/` | Tab: buatan Mekari, bank, kasir (POS), marketplace; tiap kategori: tiga manfaat, tiga fitur, kartu mitra; ajakan konsultasi |
| Keamanan dan kepatuhan | 2 | `/keamanan-kepatuhan/` | Sertifikasi dan kepatuhan |
| Studi kasus | 2 | `/case-study/` | Cerita pelanggan |
| Sumber belajar | sekitar 14 | `/resources/`, `/ebook/`, `/podcast/`, `/event/`, `/glossary/`, `/blog/`, `/news/` | Konten pemasaran dan istilah |
| Layanan dan komunitas | 4 | `/customer-service/`, `/community/` | Pusat bantuan, komunitas pengguna |
| Perusahaan | sekitar 12 | `/tentang-mekari/`, `/mengapa-mekari/`, `/careers/`, `/hubungi-kami/` | Profil, alasan memilih, karier, kontak |
| Program mitra | sekitar 38 | `/partner/...`, `/partnership/...` | Pendaftaran reseller dan mitra |

## 2. Halaman Nadi dibandingkan

| Jenis | Nadi sebelum L-02 | Keputusan |
|---|---|---|
| Landing | Ada (`/`, `/en`), sejak L-01 dengan film demo | Tetap |
| Produk dan modul | 9 halaman fitur `/fitur/*`, 5 dengan rekaman layar asli | Tetap. Nadi satu produk, jadi pintu per pekerjaan lebih tepat daripada 165 halaman modul |
| Solusi per skala | Tidak ada | Tidak dibuat: Nadi hanya untuk usaha kecil dan menengah, dan harga sudah dibagi per jumlah orang |
| Solusi per divisi | Sebagian: `/panduan` per peran (pemilik, admin, staf, akuntan) | Tetap. Peran di usaha kecil lebih nyata daripada divisi |
| **Solusi per jenis usaha** | **Tidak ada** | **Dibuat `/untuk` + 10 halaman `/untuk/<jenis>`** (id dan en). Isinya: satu hari kerja (pagi, siang, tutup) dari docs/research/kebutuhan-usaha.md, menu yang menyala dibaca dari MODUL di src/lib/fitur-usaha.ts (kode paket yang sama dengan aplikasi), tautan ke fitur dan usaha contoh. Tanpa angka persentase tantangan, karena Nadi tidak punya survei sendiri |
| Harga | Ada (`/harga`) | Tetap |
| **Integrasi** | **Tidak ada** (sambungan tersebar di halaman aplikasi) | **Dibuat `/integrasi`** (id dan en). Delapan sambungan yang sudah berjalan: MCP, Pintu data (n8n, Make, Zapier), webhook keluar, QRIS, pindah dari Jurnal, faktur Coretax, CCTV lewat go2rtc, kalender .ics dan WhatsApp. Tiga yang belum ditulis apa adanya: Shopee/TikTok Shop, mutasi bank langsung, tanda tangan tersertifikasi |
| Keamanan | Ada (`/keamanan`), dikoreksi di L-01 | Tetap |
| Studi kasus | Tidak ada | **Sengaja tidak dibuat**: Nadi belum punya pelanggan berbayar, dan cerita karangan dilarang (ANTI-SLOP S34). Dibuat setelah ada pelanggan yang setuju |
| Sumber belajar | Panduan per peran | Glosarium istilah (piutang, PPh 21, BPJS, QRIS) dicatat sebagai calon tugas, belum dibangun |
| Layanan dan komunitas | Bantuan di dalam aplikasi; obrolan web per usaha (M-16) | Tetap. Alamat kontak resmi menunggu Tristan (UNTUK-TRISTAN 3 Nov) |
| Perusahaan | `/tentang` | Tetap. "Mengapa Nadi" sudah dijawab landing dan harga |
| Program mitra | Tidak ada | Tidak dibuat sebelum ada model kemitraan |

## 3. Yang diambil, yang tidak

- Diambil: halaman per jenis usaha dengan satu ajakan, dan halaman integrasi yang menyebut mitra satu per satu.
- Tidak diambil: blok persentase tantangan tanpa sumber, logo pelanggan, testimoni, dan ajakan "jadwalkan konsultasi". Nadi tidak punya tim sales, jadi ajakannya tetap mencoba usaha contoh atau membuat akun.

## 4. Uji

- `e2e/halaman-publik.spec.ts`: 10 halaman jenis usaha dan halaman integrasi ikut diperiksa (ilustrasi di bingkai, axe 0 serius, tanpa gulir samping, ajakan akhir). Daftar modul di tiap halaman `/untuk/<jenis>` harus sama persis dengan MODUL untuk paket itu.
- Lighthouse mobile `/untuk/warung` dan `/integrasi`.
