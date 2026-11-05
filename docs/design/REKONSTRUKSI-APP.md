# Rekonstruksi UI/UX aplikasi Nadi (6 Nov 2026)

Perintah Tristan 6 Nov 2026: tampilan di dalam aplikasi "sangat membingungkan, tidak tahu harus ke mana dan ngapain, ada apa saja". Fokus utama sekarang UI/UX di dalam SaaS untuk semua jenis layar, lalu peningkatan teknis (Nadi belajar format sendiri).

## 1. Kenapa membingungkan (audit 6 Nov 2026)

| Temuan | Angka | Akibat |
|---|---|---|
| Bagian aplikasi di bawah /app | 50 halaman | Fitur banyak, tetapi tidak ada peta |
| Yang tampil di navigasi pemilik | 8 (Feed, Lempar, Kerja, Izin, Gaji, Magang, Orang, Usaha) | 42 halaman lain tidak terlihat dari mana pun |
| Fitur yang hanya berupa tautan teks di halaman pengaturan Usahamu | 31 | Invoice, kasir, buku, pajak, wawasan, tanya data, alur ditemukan hanya kalau orang membuka pengaturan |
| Navigasi bawah HP dipakai sama persis di desktop 1440 px | 1 kerangka untuk semua layar | Desktop terasa seperti HP yang diregangkan; ruang samping kosong |
| Pencarian fitur | tidak ada | Orang harus ingat nama halaman |
| Judul halaman | tanpa posisi (tidak ada "Uang > Invoice") | Orang tidak tahu sedang di bagian mana |
| Onboarding dengan AI (W-04) | ada di /app/siapkan, tidak ada di /app/mulai | Pengguna baru tidak pernah melihat tombol yang diminta Tristan |
| Panduan pemakaian | halaman /panduan publik, tidak ada di dalam aplikasi | Tidak ada "langkah berikutnya" saat pertama masuk |

Penyebab akar: setiap tugas loop menambah halaman dan satu tautan di Usahamu, tanpa ada yang memiliki arsitektur informasi.

## 2. Sumber yang dibaca

- Page Laubheimer, "Onboarding Tutorials vs. Contextual Help", Nielsen Norman Group, 12 Feb 2023 (nngroup.com/articles/onboarding-tutorials), dibaca 6 Nov 2026. Tutorial dan tur kartu di awal (push revelation) sering dilewati dan cepat dilupakan, karena orang ingin langsung bekerja. Bantuan kontekstual yang muncul saat dibutuhkan (pull revelation) lebih efektif: tooltip, coach mark, wizard langkah demi langkah. Bantuan harus mudah ditutup dan dipanggil lagi; pakai progressive disclosure.
- Android Developers, "Use window size classes" (developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes), dibaca 6 Nov 2026. Lebar: compact < 600 dp (HP tegak), medium 600-839 (tablet tegak, layar lipat terbuka tegak), expanded 840-1199 (tablet mendatar), large 1200-1599 (tablet besar), extra-large >= 1600 (desktop). Tinggi compact < 480 dp (HP mendatar). Tata letak ditentukan ukuran jendela, bukan jenis perangkat (split screen, lipat, jendela desktop yang diubah ukurannya).
- MDN, "@media horizontal-viewport-segments" (Media Queries Level 5, eksperimental), dibaca 6 Nov 2026. `(horizontal-viewport-segments: 2)` untuk perangkat dua layar/lipat berdampingan; `env(viewport-segment-width 0 0)`, `env(viewport-segment-left 1 0)`, `env(viewport-segment-right 0 0)` untuk lebar tiap layar dan engsel.

## 3. Arsitektur informasi baru: ruang

Semua halaman masuk ke satu ruang. Ruang yang tidak dipakai jenis usahanya disembunyikan tetapi tetap bisa dicari dan dinyalakan.

| Ruang | Halaman |
|---|---|
| Hari ini | Feed keputusan (/app), Lempar, Tanya data, Wawasan, Sarapan Data |
| Uang | Kas dan bank, Invoice, Pembelian, Laporan keuangan (+ lanjutan, paket pembiayaan), Pajak (+ faktur), Aset tetap, Klaim pengeluaran, Ruang Akuntan |
| Jual dan pelanggan | Kasir, Penjualan, Pelanggan dan deal, Layanan pelanggan, Janji temu dan katalog, Order servis, Proyek |
| Barang | Barang dan stok, Produksi, Impor, Ekspor |
| Orang | Orang, Kerja hari ini, Jadwal, Izin, Gaji (+ kasbon, THR), Rekrutmen, Magang, Kinerja, Kursus, Pengumuman, Survei, Serah terima, Rekam ilmu |
| Tempat dan kamera | Mata, Peta usaha |
| Dokumen | Surat masuk, Surat keluar, Tanda tangan, Kalender kepatuhan |
| Otomasi dan data | Alur otomatis, Pindah dari aplikasi lain, Siapkan dengan AI, Sambungkan AI (MCP, skill), Pintu data, Mitra |
| Pengaturan | Usahamu, Akun dan keamanan |

Aturan: halaman pengaturan tidak boleh lagi menjadi daftar fitur. Setiap fitur baru wajib mendaftarkan diri di satu peta rute (sumber tunggal untuk navigasi, pencarian, kepala halaman, dan tes).

## 4. Kerangka per ukuran layar

| Kelas lebar | Contoh | Navigasi | Isi |
|---|---|---|---|
| Compact < 600 | HP tegak 360-430 px | Bilah atas (nama usaha, cari, akun) + bilah bawah 5: Hari ini, Lempar, Kerja (atau Kasir), Cari, Menu. Menu membuka lembar "Semua menu" per ruang | Satu kolom; aksi utama di jangkauan ibu jari |
| Compact tinggi < 480 | HP mendatar | Bilah bawah tanpa label, bilah atas dipadatkan | Satu kolom |
| Medium 600-839 | Tablet tegak, lipat terbuka tegak | Rail ikon + label ruang di kiri | Satu kolom lebar terbatas (max 720 px) |
| Expanded 840-1199 | Tablet mendatar, laptop kecil | Rail + menu ruang terbuka saat diketuk | Daftar-detail dua panel untuk halaman daftar (invoice, orang, usulan) |
| Large 1200-1599 | Laptop, desktop | Sidebar penuh: ruang dan sub-halaman, pencarian di atas | Isi + panel samping (ringkasan, langkah berikutnya, bantuan) |
| Extra-large >= 1600 | Monitor lebar, dua monitor | Sidebar penuh | Isi dibatasi lebar baca; panel samping tetap; tidak diregangkan tanpa batas |
| Dua layar / lipat berdampingan | `(horizontal-viewport-segments: 2)` | Seperti expanded | Daftar di layar kiri, detail di layar kanan, tidak ada isi di engsel |

Ditegakkan oleh tes: setiap halaman dicek di 360, 412, 600, 768, 1024, 1280, 1440, 1920, dan 2560 px, terang dan gelap. Kriteria: axe tanpa pelanggaran serius, tanpa gulir samping, dan navigasi yang benar untuk kelasnya.

### 4b. Sidebar yang benar untuk SaaS (koreksi 6 Nov 2026, pertanyaan Tristan)

Tristan: angka di samping ruang terbaca seperti notifikasi, dan sidebar terasa kosong karena bagian bawahnya tidak berisi apa pun. Dua-duanya benar. Sumber: LEARN 6 Nov 2026, navigasi samping.

Yang salah di versi U-01:
- Angka jumlah halaman per ruang (Uang 11, Orang 15) memakai bentuk yang di aplikasi lain berarti "belum dibaca". Angka itu tidak membantu memutuskan apa pun.
- Hanya ruang yang aktif yang terbuka, jadi sisa layar kosong. Tidak ada kaki untuk bantuan, pengaturan, dan akun, padahal sistem navigasi besar punya slot kepala, badan, dan kaki.
- Nama usaha, bahasa, dan Keluar ada di bilah atas, jauh dari navigasi.

Bentuk baru (U-09):
1. Kepala: usaha aktif, jenisnya, dan tombol ganti usaha.
2. Badan yang bergulir: bagian Disematkan berisi 4 sampai 6 halaman. Isi bawaannya per peran, dan bisa diubah dari tombol bintang di kepala halaman. Di bawahnya ruang berlabel, dengan halaman ruang aktif terbuka.
3. Kaki tetap: Bantuan dan panduan, Yang baru, Usahamu (pengaturan), dan akun (nama, bahasa, keluar).
4. Lencana hanya untuk hal yang bisa ditindak, misalnya usulan yang menunggu keputusanmu, dan tidak tampil bila nol. Jumlah fitur hanya disebut di halaman Semua menu.
5. Bilah atas tinggal logo dan Cari.

## 5. Arah: "aku di mana, bisa apa, ngapain berikutnya"

- **Kepala halaman seragam**: jejak ruang ("Uang > Invoice"), judul, satu kalimat tujuan halaman, satu aksi utama, dan tombol bantuan "?" ke panduan bagian itu.
- **Semua menu** (/app/menu): kartu per ruang, setiap fitur dengan satu kalimat "untuk apa".
- **Cari fitur** (Ctrl+K atau tombol cari): mencari nama, sinonim sehari-hari, dan kata Inggris ("slip", "payroll", "nota", "hutang", "absen"). Hasil menunjuk halaman atau langsung aksi ("Buat invoice").
- **Fitur per jenis usaha**: paket industri menentukan ruang yang tampil. Pengaturan "Fitur yang dipakai" bisa menyalakan dan mematikannya.

## 6. Tutorial: perlu, tapi bukan tur kartu

Mengikuti NN/g: tidak ada tur pembuka yang memaksa.
1. **Daftar "Mulai di Nadi"** di Hari ini, 5-7 langkah sesuai paket: lempar berkas pertama, tambah orang, buat invoice pertama, sambungkan AI-mu, ajak staf absen. Setiap langkah membawa ke tempatnya dan tercentang otomatis saat dikerjakan. Bisa ditutup dan dipanggil lagi dari Bantuan.
2. **Keadaan kosong yang mengajar**: setiap daftar kosong menjelaskan gunanya dan memberi satu langkah pertama.
3. **Bantuan kontekstual** "?" per halaman, dan tooltip hanya untuk fitur yang tidak lazim (Mata, Teks Nadi, alur).
4. **Tur 60 detik hanya bila diminta**, dari menu Bantuan, dengan pengguna mengerjakan langkahnya sendiri.

## 7. Onboarding sesuai permintaan Tristan (4 Nov 2026), diperiksa ulang 6 Nov 2026

Permintaan: (a) di onboarding ada tombol "onboarding dengan AI kamu sendiri"; (b) pengguna melempar semua dokumen ke AI-nya, AI mengisi onboarding, pengguna tinggal menyetujui fitur dan peran; (c) skala usaha diperhitungkan saat daftar (jenis, tempat, negara); (d) AI pengguna memahami Nadi lewat skill; (e) satu klik ke AI-nya bila mungkin, kalau tidak salin prompt, dan harus jalan di chat AI gratis; (f) keluaran AI berupa berkas atau teks yang dipahami Nadi ("Teks Nadi", seperti SQL tapi ramah) yang ditempel ke Nadi; (g) hanya tombol pilihan, isi sendiri tetap bisa.

| Butir | Keadaan 6 Nov | Yang dibangun |
|---|---|---|
| (a) tombol di onboarding | Belum: ada di /app/siapkan, tidak tertaut dari /app/mulai | Langkah 2 /app/mulai: dua pilihan sejajar "Isi sendiri" dan "Siapkan dengan AI-mu" |
| (b) AI mengisi, pengguna menyetujui | Ada (Teks Nadi lalu pratinjau, MCP usul_onboarding lalu Feed) | Pratinjau per butir dengan centang (fitur, topi, orang) sebelum disimpan |
| (c) skala saat daftar | Ada (jenis, skala orang, cabang, negara, zona) | Tetap; ringkasan skala dipakai memilih ruang yang tampil |
| (d) skill | Ada (/skill, nadi://skill) | Ditautkan langsung dari pilihan AI, tidak tersembunyi |
| (e) satu klik ke AI | Belum: hanya salin prompt | Tombol "Buka di ChatGPT / aplikasi asisten Anthropic / Gemini" dengan prompt terisi bila tautan resminya mendukung (diverifikasi ke sumber resmi saat dibangun), sisanya salin prompt; jalan di akun gratis |
| (f) Teks Nadi | Ada | Juga menerima berkas .txt/.md hasil AI |
| (g) pilihan saja | Ada | Tetap |

### 7b. Draf AI: lihat, ubah, hapus, lalu terapkan sekali (pertanyaan Tristan 6 Nov 2026)

Sumber, dibaca 6 Nov 2026:
- Amershi dkk., Guidelines for Human-AI Interaction (CHI 2019), Microsoft HAX Toolkit. G8: mudah menolak atau mengabaikan saran AI. G9: mudah menyunting, memperbaiki, atau memulihkan saat AI salah. G11: bisa melihat alasan AI berbuat begitu. G16: jelaskan akibat sebuah tindakan.
- Google PAIR Guidebook, bab Feedback + Control. Biarkan pengguna menyesuaikan keluaran. Jalan manual harus tetap ada. Orang ingin memegang kendali saat taruhannya tinggi atau mereka yang bertanggung jawab atas hasilnya.
- Jakob Nielsen, "Confirmation Dialogs Can Prevent User Errors, If Not Overused" (NN/g 2018, ditinjau Agustus 2026). Konfirmasi yang terlalu sering membuat orang mengklik tanpa berpikir. Undo lebih kuat daripada dialog. Konfirmasi disimpan untuk tindakan berat yang tidak bisa dibatalkan, dan harus menyebut akibatnya.
- Forum ide produk resmi Xero, "Reconciliation - Bulk OK". Saran pencocokan yang makin akurat justru menambah klik OK satu per satu. Seorang pengguna menekan OK 5.381 kali padahal 95% sarannya benar.

Pola untuk Nadi:
1. AI (lewat MCP atau Teks Nadi) menulis **draf**, bukan data jadi dan bukan satu usulan per baris. Draf tampil di Nadi saat itu juga dengan label "Draf dari AI-mu".
2. Halaman tinjau berisi satu tabel per bagian (fitur, topi, orang, produk, akun). Setiap baris sudah tercentang. Setiap sel bisa diubah langsung, baris bisa dihapus (ikon tempat sampah) atau ditambah, dan alasan AI ("dari berkas X, yakin 92%") tampil bila diminta.
3. Baris yang ragu (keyakinan rendah, bentrok dengan data yang ada, atau kolom wajib kosong) tidak tercentang, diwarnai, dan ditaruh paling atas dengan saringan "Perlu dicek".
4. Satu tombol **"Terapkan N baris"**, lalu ada jendela batal. Tidak ada konfirmasi per baris.
5. Butir bertaruhan tinggi (gaji, rekening, saldo awal, pajak) tidak pernah tercentang otomatis walau AI yakin. Penerapan yang tidak bisa dibatalkan (jurnal saldo awal) memakai konfirmasi yang menyebut akibatnya.
6. AI pengguna bisa membaca dan merevisi draf yang sama lewat MCP (alat baca_draf, ubah_draf). Pengguna bisa menyuruh AI-nya "ganti topi Sari jadi kasir", dan perubahannya tampil di halaman tinjau. Menerapkan tetap hanya bisa dilakukan pemilik atau admin di Nadi.

Jumlah klik: dengan pola ini kasus terbaik selalu 1 klik (Terapkan) berapa pun jumlah barisnya. Mengubah dan menghapus hanya menambah klik di baris yang memang salah, dan itu lebih murah daripada menolak seluruh draf lalu mengulang. "Setujui saja tanpa bisa mengubah" lebih buruk, karena satu sel salah memaksa ulang semuanya. "Setujui per baris" juga lebih buruk, karena kliknya naik seiring jumlah baris. U-08 mengukur ini: onboarding dengan draf AI 20 baris harus selesai dalam ≤ 3 klik bila semuanya benar.

## 8. Masuk

- Tautan di email konfirmasi jatuh ke localhost. Kode aplikasi sudah memakai alamat produksi; Supabase menolak alamat yang tidak ada di daftar Redirect URLs lalu memakai Site URL proyek. Perlu diubah di dashboard (UNTUK-TRISTAN 6 Nov 2026).
- Masuk dengan Google: tombol di /masuk dan /daftar lewat signInWithOAuth. Klien OAuth Google dibuat Tristan; kodenya disiapkan loop.

## 9. Setelah UI/UX: Nadi belajar format sendiri

Ide Tristan: aturan dulu. Bila aturan tidak mengenali formatnya dan menolak menebak, pakai AI murah, lalu AI menulis aturan baru di server. Berkas berformat sama berikutnya dibaca tanpa AI, lebih cepat dan murah, dan makin banyak pengguna makin cerdas.

Sudah ada untuk Lempar: ekstraktor terkompilasi (`supabase/functions/baca-berkas/ekstraktor.ts`). Model menulis aturan jangkar + regex sekali per tata letak, berkas berikutnya dibaca tanpa token, dan kartu Hemat AI menampilkan "Nadi sudah hafal N tata letak". Yang belum:
- **Struk foto**: OCR lalu model setiap kali. Aturan per tata letak struk belum disimpan.
- **Pindah data**: kolom tak dikenal ditolak. Seharusnya model memetakan judul kolom sekali, lalu pemetaannya disimpan per sidik judul.
- **Tanya data**: kalimat tak dikenal ditolak. Seharusnya model memetakan ke niat, lalu sinonimnya disimpan setelah dikonfirmasi pengguna.
- **Mata**: kalibrasi kamera miring lewat model sekali per kamera.
- **Pemberitahuan** di layar: "Nadi sedang mempelajari format baru, sekali saja" beserta perkiraan waktunya. Format yang sama berikutnya ditandai "dibaca dengan aturan, tanpa AI".

Pengaman:
- Aturan buatan model harus mereproduksi hasil model pada contohnya sebelum dipakai. Aturan baru berjalan bayangan dulu dan dibandingkan dengan model sebelum dipercaya.
- Aturan bersama antar-usaha hanya berisi struktur (posisi, judul kolom), tidak pernah berisi data.
- Tangga model: aturan, lalu model ringan, lalu menengah, lalu besar untuk kasus sulit. ID model disimpan di konfigurasi database, tidak ditulis di kode.

## 10. Urutan kerja

U-01 kerangka adaptif dan peta ruang, U-02 semua menu dan cari fitur, U-03 kepala halaman seragam, U-04 onboarding sesuai butir 7, U-05 Mulai di Nadi dan bantuan kontekstual, U-06 fitur per jenis usaha, U-07 masuk dengan Google, U-08 uji keterpahaman (5 tugas umum diukur langkah dan waktunya sebelum dan sesudah). Setelah itu T-01 sampai T-04 (belajar format: struk, pindah data, tanya data, Mata).
