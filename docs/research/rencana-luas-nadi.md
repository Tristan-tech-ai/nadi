# Rencana: Nadi untuk semua jenis usaha, Mata yang luas, onboarding lewat AI milik pengguna

Ditulis 4 Nov 2026 setelah pertanyaan Tristan. Berkas ini berisi empat bagian:
- maksud pertanyaan Tristan;
- keadaan nyata di kode;
- jawaban jujur;
- rencana kerja dengan kriteria terima.

## 1. Maksud pertanyaan Tristan

1. **Kesan landing terlalu sempit.** Landing terkesan "untuk nota saja", padahal Lempar membaca hampir semua berkas usaha. Hal yang sama terjadi pada fitur lain: setiap fitur ditampilkan dengan satu contoh, sehingga pengunjung mengira itu batasnya.
2. **Mata seharusnya mata usaha, bukan pendeteksi meja.** Yang diharapkan:
   - antrean;
   - rak dan pajangan;
   - kerja karyawan (siapa melayani, berapa lama);
   - pelanggan di toko grosir (berapa lama di toko, jalur yang dilalui, apakah tata letak membuat pelanggan berkeliling ke rak yang dituju).
3. **Kenapa progres wajib sempat 100%** kalau masih banyak yang belum ada.
4. **Satu Nadi untuk hampir semua jenis usaha.** Setiap usaha mendapat penyesuaiannya sendiri.
5. **Onboarding dengan AI milik pengguna.** Satu tombol membawa pengguna ke asisten AI-nya (lewat MCP). Pengguna melempar semua dokumen ke AI-nya sendiri, AI itu menyusun isi onboarding (orang, peran, aturan, fitur yang dipakai), lalu pengguna tinggal menyetujui.
6. **Skala dan konteks usaha dihitung sejak daftar:** jenis, jumlah orang, cabang, kota, negara, mata uang.
7. **Asisten AI pengguna langsung paham Nadi** begitu tersambung. Untuk itu perlu skill berisi konteks.
   - Sambungannya sebaiknya sekali klik. Bila tidak bisa, sediakan prompt untuk disalin.
   - Pertanyaan terbuka: apakah cara salin prompt itu jalan di chat AI gratis.

## 2. Keadaan nyata di kode (diperiksa 4 Nov 2026)

| Hal | Sekarang | Sumber |
|---|---|---|
| Jenis berkas Lempar | 14: nota, invoice, slip gaji, KTP, CV, surat sakit, Excel absen, Excel karyawan, mutasi bank, surat, PIB, PEB, SPPB, lainnya | supabase/functions/baca-berkas/inti.ts JENIS |
| Mata | zona `meja`, `antrean`, `rak`; status terisi/kosong dan jumlah orang di antrean; tanpa kerja karyawan, lama kunjungan, atau jalur pelanggan | supabase/migrations/20261101037000_mata.sql |
| Paket industri | 10: makanan, toko/grosir, kantor, bengkel, klinik, konstruksi, logistik, hotel, salon, laundry | migrasi paket_industri dan paket_tambahan |
| Daftar dan buat usaha | nama usaha + pilihan industri; negara tidak ditanya (paket pajak/gaji hanya Indonesia), skala tidak ditanya | apps/web/src/app/app/mulai |
| MCP | 3 alat: siapa_saya, daftar_usulan, buat_usulan (daftar putih aksi); OAuth 2.1 + CIMD, token per usaha | docs/research/mcp.md, src/lib/mcp |
| Skill untuk AI pengguna | paket zip Agent Skills bisa diunduh di /app/skill (usaha, topi, aturan, nomor, akun) | src/app/app/skill/route.ts |

## 3. Jawaban jujur

- **Kenapa 100%.** Angka 100% dihitung terhadap daftar tugas di loop/DONE.md, yaitu versi 1 yang ditulis 30 Okt 2026. Daftar itu tidak memuat Mata yang luas, onboarding lewat AI, atau usaha lintas negara. Jadi 100% berarti "versi 1 selesai", bukan "visi Nadi selesai". Setiap permintaan baru masuk sebagai tugas wajib baru, karena itu angkanya turun lagi. Seharusnya ini kujelaskan saat melaporkan 100%.
- **Kesan "hanya nota".** Ini salah tulisan dan gambar di landing baru, bukan batas produk. Pahlawan, "Coba sendiri", dan "Foto, Setujui, Beres" semuanya memakai nota sebagai contoh utama. Pengunjung yang memindai (riset Nielsen) menyimpulkan dari contoh pertama.
- **Mata.** Masih pengembangan. Yang ada baru sebagian kecil dari visinya.
- **Semua jenis usaha.** Sebagian sudah: 10 paket peran, dan Lempar membaca berkas umum. Belum ada:
  - penyesuaian per usaha di luar paket bawaan;
  - pertanyaan skala;
  - aturan negara selain Indonesia.
- **Sambung AI sekali klik:**
  - **Aplikasi asisten Anthropic.** Bisa ditambahkan sebagai konektor kustom dengan URL server MCP. Menurut pusat bantuan resminya, ini tersedia juga di paket gratis, maksimal 1 konektor. Pengguna tetap harus menempel URL sekali, karena tidak ditemukan tautan pasang otomatis yang terdokumentasi untuk aplikasi web.
  - **ChatGPT.** Konektor URL kustom butuh Developer Mode di paket berbayar (sumber pihak ketiga, halaman resmi belum terbaca). Aplikasi yang terdaftar di direktori bisa dipakai di paket gratis, tetapi butuh pengajuan dan persetujuan.
  - **Cursor dan VS Code.** Ada tautan pasang MCP sekali klik yang resmi.
  - **Chat AI gratis tanpa MCP.** Cara salin prompt tetap jalan. Bedanya, AI tidak bisa memanggil Nadi secara langsung. AI menghasilkan satu blok "cetak biru onboarding" (JSON), lalu pengguna menempelkan blok itu ke Nadi dan menyetujuinya. Cara ini jalan di chat AI apa pun, gratis atau berbayar.

## 4. Rencana kerja

Urutan dipilih dari dampak ke calon pengguna. Setiap butir menjadi tugas wajib di loop/WORK_QUEUE.json dengan kriteria terima di bawah.

### W-01 Landing dan halaman fitur menampilkan jangkauan, bukan satu contoh (dampak 90)

Isi:
- **Pengait.** Kertas yang tersedot ke HP memakai 8 jenis berkas: nota, invoice, Excel karyawan, KTP, mutasi bank, surat, slip, CV. Judul menyebut "berkas apa saja".
- **Coba sendiri.** Pilihannya 5 berkas yang mewakili jenis berbeda: nota, Excel absen, mutasi bank, KTP, surat masuk.
- **Pita jenis usaha.** Satu pita yang berganti cepat: warung, toko grosir, bengkel, klinik, salon, kantor, konstruksi, gudang, hotel, laundry. Bentuknya blueprint fixed-anchor-cycle: kata "Nadi untuk" diam, jenis usahanya berganti.
- **Halaman fitur.** Setiap halaman punya baris "Dipakai untuk" berisi 4 sampai 6 kasus nyata dari kode. Contoh Lempar: nota, Excel absen, KTP, mutasi bank, CV, dokumen impor.

Kriteria terima:
- landing menampilkan ≥ 8 jenis berkas dan ≥ 6 jenis usaha;
- gerbang tulisan dan inspect.mjs 0 FAIL;
- e2e produksi lulus.

### W-02 Mata v2: antrean, karyawan, pelanggan, jalur (dampak 85)

Isi:
- **Jenis zona baru.** `kasir` (siapa melayani), `pintu` (masuk/keluar), `lorong` (lalu lintas), dan `kerja` (pos karyawan).
- **Ukuran.**
  - Lama kunjungan dari pintu masuk ke keluar.
  - Waktu tunggu antrean.
  - Waktu layan per kasir.
  - Peta panas lorong: jumlah lintasan per zona per jam.
  - Urutan zona yang dilalui (jalur), dihitung dari jejak orang anonim di perangkat. Tanpa wajah, tanpa identitas, dan video tidak keluar.
- **Usulan dari data.** Contoh: "Pelanggan rata-rata melewati 6 lorong sebelum rak minyak; pindahkan minyak dekat pintu?"
- **Riset dulu.**
  - Pelacak orang di peramban dan agen edge (ByteTrack/OC-SORT, lisensi).
  - Aturan privasi UU PDP 27/2022 untuk kamera di tempat usaha: wajib pemberitahuan dan papan informasi.
  - Batas akurasi korpus sintetis.

Kriteria terima:
- korpus video sintetis toko dengan jalur yang diketahui;
- akurasi jumlah kunjungan ≥ 90%;
- galat lama kunjungan ≤ 15%;
- tes SQL isolasi tenant;
- e2e Peta Usaha menampilkan peta panas;
- docs/research/mata-v2.md dengan pasal UU PDP yang dibaca dari teks resmi.

### W-03 Daftar dengan konteks usaha (dampak 75)

Isi:
- Pertanyaan saat membuat usaha:
  - jenis usaha (10 paket + "lainnya, ceritakan");
  - jumlah orang (1, 2 sampai 5, 6 sampai 15, 16 sampai 50, > 50);
  - jumlah cabang;
  - kota;
  - negara.
- Mata uang dan zona waktu terisi otomatis dari negara.
- Skala menentukan fitur yang dinyalakan dan disarankan. Contoh: usaha 1 orang tidak melihat Jadwal shift dulu.
- **Di luar Indonesia.** Usaha tetap bisa memakai Lempar, Feed, Tagihan, Mata, dan Jadwal tanpa batas jam lokal. Gaji, pajak, dan BPJS diberi label "aturan Indonesia" dan dimatikan sampai ada paket negaranya. Tidak ada angka aturan negara lain sebelum dibaca dari teks resmi.

Kriteria terima:
- kolom baru di perusahaan (skala, cabang, kota, negara, mata uang) dengan tes SQL;
- formulir mulai id/en;
- e2e daftar usaha luar Indonesia: fitur pajak tampil terkunci dengan alasannya.

### W-04 Onboarding "pakai AI milikmu" (dampak 90)

Tiga jalur, ditampilkan sebagai tiga tombol di layar mulai:

1. **Sambungkan AI-mu (MCP).**
   - Tombol membuka halaman petunjuk per aplikasi berisi URL server Nadi yang tinggal disalin dan langkah bergambar.
   - Tombol pasang sekali klik untuk Cursor dan VS Code (tautan resmi).
   - Setelah izin OAuth, AI pengguna memakai alat baru:
     - `nadi_mulai` membaca konteks dan skill;
     - `usul_orang`, `usul_topi`, `usul_aturan_izin`, dan `usul_fitur` membuat usulan onboarding;
     - `lempar_berkas` menitipkan dokumen yang diunggah pengguna ke AI-nya.
   - Semuanya masuk Feed sebagai usulan bertanda "dari AI milikmu". Tidak ada yang tercatat sebelum disetujui (aturan keluaran model = masukan tak tepercaya).
2. **Salin prompt (chat AI apa pun, termasuk yang gratis).**
   - Nadi menyusun prompt yang berisi:
     - konteks Nadi;
     - skema cetak biru onboarding (JSON: orang, topi, aturan, fitur, jadwal);
     - aturan agar AI tidak mengarang angka.
   - Pengguna menempelkannya bersama dokumennya ke chat AI-nya, lalu menempelkan jawabannya ke kotak "Tempel hasil dari AI" di Nadi.
   - Nadi memvalidasi skema, memecahnya menjadi usulan, lalu pengguna menyetujui.
3. **Lempar sendiri ke Nadi.** Jalur yang sudah ada: Lempar Saja + paket industri.

Kriteria terima:
- **MCP:** alat baru dengan tes protokol dan tes SQL (usulan saja, daftar putih aksi);
- **Cetak biru:** skema JSON yang divalidasi, dengan 10 kasus uji (5 baik, 5 buruk: angka dikarang, NIK utuh, aksi terlarang);
- **e2e:** cetak biru contoh menjadi ≥ 10 usulan di Feed;
- **Uji nyata:** prompt diuji sekali di chat AI gratis dengan dokumen sintetis, hasilnya dicatat di docs/quality/onboarding-ai.md;
- **Halaman petunjuk:** tiap aplikasi menyebut paket yang dibutuhkan sesuai sumber resminya.

#### Keputusan Tristan 4 Nov 2026 untuk W-04

- **Semua jalur AI hanya tombol pilihan.** Formulir onboarding biasa tetap ada dan tetap jalan utama. Pengguna bebas mengisinya sendiri, memakai AI, atau mencampur keduanya.
- **Format "Teks Nadi".** Jalur chat AI (tanpa MCP) menghasilkan teks yang dipahami Nadi. AI memberikannya sebagai blok di chat atau sebagai berkas `.txt` untuk diunduh. Pengguna menempelkan blok itu, atau melempar berkasnya, ke Nadi.
- **Ramah dibaca orang.** Mirip SQL dalam ketepatannya, tetapi berbentuk daftar berlabel yang bisa dibaca dan disunting pemilik sebelum ditempel. Contoh:

```
NADI ONBOARDING 1
USAHA: Warung Bu Sari
JENIS: warung makan
KOTA: Denpasar | NEGARA: Indonesia | ORANG: 6 | CABANG: 1
ORANG:
- Sari Dewi | kasir, pelayan | mulai 2024-03-01
- Komang Ayu | koki | mulai 2025-01-15
FITUR: Lempar, Feed, Absen, Gaji, Tagihan
ATURAN IZIN: sakit otomatis 1 hari, wajib surat dokter
```

- **Pemeriksaan sebelum masuk.**
  - Nadi mengurai teks itu dengan aturan tanpa model.
  - Setiap baris ditampilkan sebagai pratinjau: dikenali atau tidak dikenali, beserta alasannya.
  - Baris yang dikenali menjadi usulan di Feed.
  - Format JSON juga diterima untuk AI yang lebih suka JSON.
- **Kriteria tambahan.**
  - Pengurai Teks Nadi punya tes: 10 contoh baik, 10 buruk, termasuk NIK utuh, gaji tanpa sumber, dan baris rusak.
  - Pratinjau menunjukkan baris yang ditolak dengan alasannya.
  - Formulir onboarding manual tetap lulus e2e lama.

### W-05 Skill Nadi untuk AI pengguna (dampak 70)

Isi:
- Paket skill /app/skill diperluas. Isinya:
  - peta fitur;
  - kosakata (topi, usulan, Lempar);
  - alur onboarding;
  - aturan aman (AI mengusulkan, pemilik memutuskan; tanpa NIK utuh; tanpa angka aturan karangan);
  - contoh percakapan per peran.
- Disajikan juga lewat MCP: `server/discover` instructions dan sumber `nadi://skill`. AI yang tersambung langsung mendapat konteks tanpa mengunduh.
- Versi bahasa Inggris untuk AI yang dipakai dalam bahasa Inggris.

Kriteria terima:
- skill lolos validasi format Agent Skills;
- MCP `resources/read nadi://skill` mengembalikan isi yang sama dengan unduhan;
- gerbang tulisan mode ui LOLOS untuk isi skill.

### W-06 Paket industri terbuka (dampak 60)

Isi:
- "Lainnya, ceritakan usahamu": kalimat pemilik dipetakan ke paket terdekat plus topi baru.
  - Lewat aturan dulu.
  - Model hanya bila aturan tidak cocok.
  - Hasilnya usulan yang disetujui.
- Paket bisa disunting pemilik setelah dipasang.

Kriteria terima:
- 20 kalimat uji jenis usaha (penjual kue online, pabrik tahu, sekolah kursus, peternak lele) menghasilkan paket dan topi yang masuk akal;
- tes SQL;
- e2e.

## 4b. Keputusan Tristan 4 Nov 2026: halaman lain dan UI di HP

- **Halaman pendukung (D-26).** Harga, keamanan, privasi, syarat, tentang, dan panduan dibuat konsisten dengan landing: kepala Fitur/Harga/Masuk, kaki yang sama, dan lapangan warna untuk judul. Isinya tetap tata letak baca (mode Read): kolom 60 sampai 70 karakter, teks 17 px tinta penuh, tabel tetap tabel. Keterbacaan menang dari estetika.
- **Aplikasi.** Aplikasi tetap tenang seperti sekarang. Yang diseragamkan hanya detail craft floor (D-27): seleksi teks, caret, cincin fokus, dan garis bawah tautan. Warna poster tidak dibawa ke layar kerja.
- **Landing.** HP di pengait, penggeser, dan pintu Feed menampilkan antarmuka Nadi sungguhan: komponen KartuUsulan, Cap, dan Rupiah dari aplikasi, dengan data sintetis. Bentuk kartu sederhana yang sekarang tidak dipakai lagi. Masuk ke kriteria W-01.

## 4c. Yang masih kurang agar Nadi bisa dipakai hampir semua usaha

Sudah ada:
- inti yang berlaku umum: Lempar 14 jenis berkas, Feed keputusan, absen dan izin, gaji Indonesia, tagihan QRIS, jadwal shift, surat, buku besar, Kompas Pajak, rekrut, Mata zona meja/antrean/rak;
- 10 paket peran.

Belum ada:

| Kebutuhan | Usaha yang membutuhkan | Status di kode |
|---|---|---|
| Stok dan persediaan per barang (masuk dari nota, keluar dari penjualan, sisa, batas pesan ulang) | toko, grosir, warung, apotek, bengkel (suku cadang), pabrik | tidak ada tabel stok/barang |
| Pesanan pelanggan dan penjualan harian (dari Excel kasir/marketplace yang dilempar) | toko online, katering, grosir | invoice ada; pesanan dan rekap penjualan belum |
| Janji temu dan jadwal layanan pelanggan | klinik, salon, bengkel, kursus | belum ada |
| Proyek, tahapan, dan jam kerja per proyek | konstruksi, agensi, konsultan, kantor jasa | belum ada (kerja/topi ada, proyek belum) |
| Sewa berulang (kamar, unit, alat) dan tagihan bulanan otomatis | kos, vila, rental | tagihan satuan ada, berulang belum |
| Produksi sederhana (resep/bahan per produk, biaya per unit) | katering, roti, pabrik tahu, konveksi | belum ada |
| Aset dan peralatan (perawatan, penyusutan sederhana) | bengkel, klinik, logistik | belum ada |
| Aturan negara lain (gaji, pajak, cuti) | usaha di luar Indonesia | hanya paket Indonesia; dikunci sampai ada teks resmi |
| Mata v2 (karyawan, lama kunjungan, jalur, peta panas) | grosir, minimarket, restoran, gudang | W-02 |
| Onboarding lewat AI dan konteks skala/negara | semua | W-03, W-04, W-05 |

Urutan setelah W-01 sampai W-06: W-07 riset peta kebutuhan per jenis usaha. Isinya 10 jenis usaha, satu hari kerja masing-masing, lalu modul mana yang dipakai dan mana yang kosong. Riset ini menentukan urutan modul baru, dengan stok dan persediaan sebagai calon pertama. Setiap modul baru tetap mengikuti pola Nadi: masuk lewat Lempar, menjadi usulan, disetujui pemilik.

## 5. Yang tidak berubah

- Pemilik memutuskan semua hal yang menyangkut uang, orang, dan data pribadi.
- Data sintetis.
- Angka aturan hanya dari teks resmi bertanggal.
- Tanpa jejak asisten di repo.

## Sumber (diakses 4 Nov 2026)

- Pusat bantuan Anthropic, "Get started with custom connectors using remote MCP": artikel bantuan nomor 11175166 di pusat bantuan resmi aplikasi asisten Anthropic (konektor kustom tersedia di paket Free maksimal 1, Pro, Max, Team, Enterprise). Alamatnya tidak ditulis karena memuat nama yang dilarang gerbang jejak repo.
- Panduan pihak ketiga tentang ChatGPT Developer Mode dan direktori aplikasi: coworker.ai/blog/chatgpt-mcp, top-mcps.com/guides/how-to-add-mcp-to-chatgpt (status B, belum dari halaman resmi OpenAI).
- Cursor MCP install links: https://cursor.com/docs/mcp/install-links
- Nielsen 2008, "How Little Do Users Read?": https://www.nngroup.com/articles/how-little-do-users-read/
