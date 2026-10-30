# NADI — Sistem Saraf untuk Usaha

> Nama kerja. "Nadi" = denyut usaha: semua yang terjadi di usaha terasa, tercatat, dan ditanggapi.
> Status: rencana v1 (30 Okt 2026). Belum ada kode. Rancangan lama di repo (`Rangka`) hanya dipakai sebagai sumber data masalah, bukan arah produk.

---

## 0. Inti dalam satu halaman

Aplikasi HR/akuntansi biasa adalah **formulir yang menunggu diisi**. Orang malas mengisi, jadi datanya bolong. Keputusan lalu dibuat dari ingatan dan chat WhatsApp.

Nadi dibalik: **usaha punya indra, ingatan, otak, dan tangan.**

| Lapis | Isi | Contoh |
|---|---|---|
| **Indra** | Semua jalur data masuk tanpa input manual | foto nota, video gudang, voice note WA, PDF, Excel, screenshot transfer, CCTV yang sudah ada, POS, mutasi bank |
| **Ingatan** | *Graf Usaha*: orang, topi (peran), pekerjaan, tempat, aset, uang, dokumen, beserta bukti dan waktu | "Budi pakai topi Kasir 70% + Gudang 30% sejak 1 Sep, bukti: 22 hari absen, 410 transaksi" |
| **Otak** | Aturan pasti → model ML → agen LLM, dalam urutan itu (yang termurah dulu) | aturan gaji, deteksi anomali, prediksi kebutuhan shift, agen yang menyusun surat |
| **Tangan** | Aksi nyata dengan persetujuan manusia | kirim invoice + QRIS, susun shift, cairkan gaji, cabut akses orang yang resign |

**Lima ide besar yang membedakan Nadi:**

1. **Lempar Saja.** Satu kotak masuk untuk semua jenis berkas. AI memilah, mengisi, dan menautkan. Manusia cukup menggeser "benar/salah". Setelah satu jenis berkas dipelajari, berikutnya dibaca **tanpa token AI** (lihat Bank Data, §6.2).
2. **Topi, bukan jabatan.** Orang memakai banyak topi dengan porsi persen. Kerja lintas topi tercatat dan **dibayar**. Ini menjawab masalah "all role", pembagian tugas tidak adil, KPI, dan mentor magang sekaligus.
3. **Gaji berbasis bukti.** Gaji hanya cair untuk orang yang punya *tanda hidup* dari beberapa sumber independen. Pegawai siluman dan titip absen tertutup tanpa mesin fingerprint.
4. **Mata.** CCTV yang sudah terpasang jadi sensor bisnis: meja kosong/kotor, antrean, rak kosong, bay bengkel terpakai. Satu mesin "resep kamera" untuk puluhan jenis usaha. Video tidak keluar dari lokasi; yang dikirim hanya kejadian.
5. **Bawa AI-mu sendiri.** Asisten AI langganan milik perusahaan tersambung lewat MCP dan bisa mengelola seluruh isi Nadi. Biaya AI berat ditanggung langganan mereka, bukan kita.

---

## 1. Diagnosis: 16 masalah, 5 akar

Masalah dari wawancara (bank data P01–P16) bukan 16 masalah terpisah. Akarnya lima:

| Akar | Masalah yang muncul | Kenapa aplikasi biasa gagal |
|---|---|---|
| **A. Data masuk lewat jalur termahal (tangan manusia)** | P04 absensi, P07 surat, P08 invoice, P16 pembukuan | Form satu-satu. Hanya 5,59% UMKM mencatat di aplikasi (R8a) |
| **B. Organisasi dimodelkan sebagai jabatan tetap, padahal kerja nyata mengalir lintas orang** | P02 all role, P11 tugas tidak adil, P12 KPI, P14 magang | Satu orang = satu jabatan di database. Kerja di luar jabatan tidak terlihat dan tidak dihargai |
| **C. Semua berbasis klaim, bukan bukti** | P03 pegawai siluman, P04 titip absen, P06 gaji salah, P12 KPI subjektif | Absen = klik tombol. Gaji = angka di spreadsheet. Tidak ada yang mencocokkan silang |
| **D. Keputusan lambat karena info tersebar** | P01 kandidat diambil orang lain, P05 izin lambat, P10 shift kacau | Info ada di WA, kertas, dan kepala orang. Atasan tidak tahu ada yang menunggu |
| **E. Pengetahuan pergi bersama orangnya** | P09 resign/mutasi, P14 mentor, P15 HR tanpa asesmen | Cara kerja tidak pernah ditulis. Serah terima = ingatan |

P13 (pajak) dan P16 (akuntan lepasan) adalah akar keenam: **aturan berubah cepat dan mahal dipahami**. Ini dijawab dengan aturan sebagai data bertanggal dan bank pengetahuan bersama (§6.2).

Temuan riset yang paling menentukan desain (detail dan sumber: riset repo R2–R8d + riset web 30 Okt 2026):
- Keluhan nomor satu atas aplikasi Indonesia adalah **tidak andal dan update yang merusak** (18–48% ulasan bintang 1–2, R8b). Keandalan adalah fitur.
- Biaya kesalahan jatuh ke staf paling bawah: gaji dipotong karena GPS absen salah (Talenta, R8b). Sistem bukti harus **membela** karyawan, bukan hanya mengawasi.
- PP 20/2026 menutup PPh final 0,5% untuk PT/CV, dan batas Rp4,8 M dihitung **gabungan semua usaha milik orang yang sama** (R8c). Ratusan ribu usaha tiba-tiba butuh pembukuan sungguhan. Ini pintu masuk pasar.
- Pola pegawai siluman yang terdokumentasi (97.000 data PNS fiktif versi BKN 2021; kasus restoran cepat saji Hong Kong 2026) selalu sama: **satu orang memegang rekrutmen, persetujuan absen, dan penggajian sekaligus**. Jadi pemisahan tugas lebih penting daripada alat absen yang canggih.
- Turnover F&B disebut 60–80% per tahun (⚠ sumber sekunder). Untuk usaha seperti ini, rekrutmen cepat adalah kebutuhan rutin, bukan sesekali.
- UU Pelindungan Ketenagakerjaan (disahkan 6 Okt 2026, berlaku setelah transisi 1 tahun) memuat anti-diskriminasi dalam rekrutmen dan dasar hukum **dana cadangan pesangon**. Isinya belum final dibaca (batas PKWT 2 vs 4 tahun masih simpang siur).

### Kenapa bukan pesaing yang sudah menambah AI?
Mekari meluncurkan **Airene** (Agu 2026), lapisan AI di atas Talenta, Jurnal, dan Qontak. HashMicro punya **Hashy** (asisten ERP lewat WhatsApp). Odoo 19 punya AI Agents. Ketiganya **menempelkan AI di atas aplikasi formulir**: datanya tetap harus diketik manusia, jabatan tetap satu kursi, absen tetap klaim, dan AI-nya terkunci di dalam produk mereka.

Nadi mengubah fondasinya:
- data masuk dari bukti dan indra, bukan formulir
- organisasi dimodelkan sebagai topi dan aliran kerja
- kamera yang sudah ada jadi sensor
- AI milik pelanggan sendiri boleh masuk lewat MCP

---

## 2. Satu batu, puluhan burung: 8 primitif universal

Nadi tidak dibangun per modul (HR, akuntansi, POS). Nadi dibangun dari **8 primitif** yang ada di setiap usaha. Jenis usaha hanyalah **paket konfigurasi** di atasnya.

| Primitif | Arti | Contoh lintas usaha |
|---|---|---|
| **Orang** | Siapa pun: karyawan, kandidat, magang, pelanggan, pemasok, akuntan | sama di semua usaha |
| **Topi** | Peran dengan tanggung jawab, keahlian, izin, KPI, komponen gaji | Kasir, Barista, Mekanik, Admin, Mentor, Sales |
| **Kerja** | Unit pekerjaan dengan poin beban, topi yang dibutuhkan, bukti selesai | pesanan, servis, tiket, tugas, proyek |
| **Tempat** | Lokasi dan zona di dalamnya | outlet, meja, rak, bay, ruang rapat, gudang |
| **Aset** | Barang bernilai: stok, alat, kendaraan, akun sistem | stok, kunci, laptop, akun email |
| **Uang** | Setiap pergerakan uang, selalu jadi jurnal | jual, beli, gaji, pajak |
| **Dokumen** | Surat, invoice, kontrak, slip, dengan nomor sah | SK, invoice, PKWT, surat jalan |
| **Kejadian** | Semua yang terjadi, dari sumber mana pun, dengan bukti dan tingkat keyakinan | absen, meja kosong, transfer masuk, tugas selesai |

**Paket industri** (data, bukan kode) = topi bawaan + jenis kerja + resep kamera + KPI + template dokumen + bagan akun.

| Usaha | Topi bawaan | Resep Mata | KPI khas |
|---|---|---|---|
| Restoran / kafe | pelayan, koki, kasir, barista | status meja, antrean, waktu sajian | perputaran meja, waktu tunggu |
| Toko kelontong / grosir | kasir, gudang, sales kanvas | rak kosong, antrean kasir, pengunjung → transaksi | konversi pengunjung, stok habis |
| Kantor / jasa profesional | admin, staf, manajer | okupansi ruang (bukan individu) | tiket selesai, ketepatan tenggat |
| Bengkel | mekanik, SA, gudang part | bay terpakai, mobil menunggu | waktu servis, pendapatan per bay |
| Klinik | dokter, perawat, resepsionis | ruang tunggu | waktu tunggu pasien |
| Konstruksi | mandor, tukang, logistik | APD (helm/rompi), alat berat | progres vs RAB |
| Gudang / distribusi | picker, driver, admin | dok bongkar muat, forklift | akurasi kirim, waktu muat |
| Hotel / vila (Bali) | housekeeping, FO, engineering | area publik, lobi | waktu kamar siap |
| Salon / laundry / bimbel / yayasan | sesuai paket | antrean | utilisasi, retensi |

Tambah satu jenis usaha = tambah satu paket JSON, bukan proyek baru.

---

## 3. Solusi per masalah: cara biasa vs cara Nadi

### P01 + P15 — **Rekrut Kilat** (rekrutmen yang belajar dari kinerja)
Cara biasa: lowongan di grup, CV menumpuk di email, HR dalam menilai pakai firasat, kandidat bagus menunggu seminggu lalu hilang.

Cara Nadi:
- **Lamar lewat WhatsApp atau tautan**, tanpa akun. CV difoto pun bisa; AI menyusun profil.
- **Saring dalam menit, bukan hari.** Rubrik dibuat otomatis dari definisi topi (keahlian, tanggung jawab).
- **Wawancara asinkron lewat suara**: kandidat menjawab di WA kapan saja, ditranskrip dan dinilai dengan rubrik. Penilai manusia melihat ringkasan dan klip.
- **Uji kerja singkat per topi**, bukan tes umum: kasir menghitung kembalian, admin mengolah Excel, barista mengirim video, sales menjawab keberatan pelanggan.
- **Psikometri yang sah**: instrumen domain publik (mis. IPIP Big Five) dan tes situasional. Untuk posisi kunci, satu klik memesan **psikolog/asesor mitra** (marketplace).
- **Kartu keputusan di Feed Pemilik** dengan pengingat tenggat: "Kandidat Ayu skor 86, sudah 2 hari menunggu. Kandidat di atas 80 biasanya hilang dalam 5 hari." Satu klik = tawaran terkirim di WA.
- **Status terbuka untuk kandidat** (tautan pelacak). Kandidat bagus yang tidak lolos masuk **Bank Talenta** dan dihubungi lagi saat ada lowongan cocok.
- **Penjaga bias**: usia, agama, foto, status nikah tidak ikut penilaian. Lowongan diperiksa dari syarat diskriminatif ("maks 25 th, berpenampilan menarik").
- **Lingkaran belajar (yang tidak dimiliki pesaing):** 3–6 bulan setelah diterima, KPI karyawan ditautkan ke sinyal rekrutmennya. Nadi belajar pertanyaan dan uji mana yang **benar-benar memprediksi kinerja di perusahaan ini**, dan membuang yang tidak. HR dalam tanpa latar psikologi dibantu data, bukan firasat.

Ukuran: hari dari lamar ke tawaran, kandidat hilang, kinerja 6 bulan pertama.

### P02 + P11 + P12 — **Topi, Poin Beban, dan KPI dari Jejak**
Cara biasa: jabatan di struktur organisasi; yang rajin ketiban tugas; KPI diisi atasan setahun sekali.

Cara Nadi:
- **Topi** dengan porsi: Budi = Kasir 70% + Gudang 30%. Topi punya tanggung jawab (RACI), izin, KPI, dan komponen gaji.
- **Kerja lintas topi tercatat.** Kalau kasir mengerjakan tugas gudang, itu dicatat sebagai *kontribusi lintas topi*, bukan hilang.
- **Peta Organisasi Nyata**: dari graf siapa mengerjakan apa dan siapa menyerahkan ke siapa, Nadi menggambar organisasi **sebagaimana kerja sebenarnya mengalir**, di samping organisasi di atas kertas. Pemilik langsung melihat "Admin keuangan ternyata mengerjakan 40% urusan HR."
- **Poin Beban** per kerja: diperkirakan AI dari deskripsi dan riwayat durasi, dikalibrasi terus.
- **Pembagi tugas adil**: setiap tugas baru diusulkan ke orang dengan mempertimbangkan kecocokan keahlian, beban saat ini, tenggat, keadilan antar-orang (indeks ketimpangan beban), dan kesempatan belajar bagi yang junior. Pemimpin bisa menimpa, tapi terlihat.
- **Kolam Bonus Beban**: sebagian insentif dibagi menurut poin kontribusi. Yang rajin **dibayar lebih**, bukan hanya dibebani lebih. Ketidakadilan yang sekarang "menguntungkan operasional" berubah jadi adil dan tetap cepat.
- **KPI dari jejak, bukan dari formulir**: dihitung dari kejadian nyata per topi, dinormalisasi oleh beban dan kondisi (shift ramai vs sepi). Setiap skor punya **penjelasan** ("naik karena waktu servis turun 18%"). Karyawan melihat cermin kinerjanya sendiri; atasan memberi tinjauan manusia di atasnya.

### P03 + P04 — **Gaji Berbasis Bukti dan Absen Anti-Titip**
Cara biasa: mesin fingerprint (bisa dititip dengan jari silikon), absen GPS (bisa dipalsukan, atau malah salah dan memotong gaji orang jujur).

Cara Nadi:
- **QR berputar**: tablet/HP bekas di pintu menampilkan QR yang berganti tiap 15 detik. Karyawan memindai dari HP-nya (PWA atau WA), plus selfie dengan **cek keaktifan di perangkat** (kedip/menoleh, MediaPipe yang sudah ada di repo lama). Titip absen dari jauh tidak bisa; GPS palsu tidak berguna.
- **Lapisan opsional**: kamera Mata mengenali kehadiran (dengan persetujuan tertulis, data biometrik disimpan sebagai template terenkripsi, bukan foto).
- **Tanda hidup**: setiap orang yang digaji harus punya bukti dari minimal dua sumber independen bulan itu (absen, kerja selesai, transaksi POS, chat kerja, perangkat).
- **Gerbang Gaji** sebelum pencairan, aturan pasti (bukan AI):
  - digaji tapi tanpa absen N hari
  - kontrak habis tapi masih digaji
  - satu rekening atau satu HP untuk dua orang
  - NIK tidak valid atau tidak konsisten dengan tanggal lahir
  - akun aktif tanpa gaji, atau gaji tanpa akun aktif

  Temuan butuh persetujuan orang kedua.
- **Pemisahan tugas dipaksa sistem**: orang yang merekrut, yang menyetujui absen, dan yang mencairkan gaji tidak boleh orang yang sama untuk karyawan yang sama. Kalau usahanya terlalu kecil untuk itu, pemilik menjadi pemeriksa kedua lewat satu kartu di Feed.
- **Membela karyawan**: koreksi absen tercatat (siapa, kapan, alasan), karyawan bisa banding dengan bukti, dan potongan gaji tidak pernah otomatis dari satu sinyal saja.

### P05 + P10 — **Izin Otopilot dan Shift dari Permintaan**
- **Izin lewat WA atau suara**: "Pak, saya izin sakit hari ini" → AI membuat pengajuan, meminta foto surat dokter bila perlu, mengecek saldo dan dampak ke shift.
- **Kebijakan otopilot**: pemilik menetapkan aturan, mis. "sakit ≤1 hari dengan surat → setujui otomatis; cuti saat 2 orang lain sudah cuti → tanya saya". Keputusan kecil tidak lagi menunggu.
- **Shift dari permintaan**: kebutuhan orang per jam diramal dari POS, Mata (pengunjung), dan kalender (libur, gajian, event). Pemecah jadwal (constraint solver) menyusun shift yang memenuhi aturan kerja, preferensi, dan **keadilan shift malam/akhir pekan**.
- **Tukar shift di WA**: tawarkan → rekan terima → sistem cek aturan → atasan setuju satu klik. Dampak ke absen dan gaji otomatis.

### P07 + P08 — **Nomor Sakti, Surat dari Kalimat, Invoice yang Menagih Sendiri**
- **Nomor Sakti**: penomoran sebagai tata bahasa yang bisa diatur, mis. `{urut:3}/{unit}/{jenis}/{bulan_romawi}/{tahun}`. Dijamin **tanpa ganda dan tanpa loncat** (dikunci di database). Nomor yang dibatalkan tetap tercatat, tidak dipakai ulang.
- **QR verifikasi** di setiap surat/invoice: siapa pun bisa memindai untuk memastikan dokumen asli. Surat palsu ketahuan.
- **Surat dari kalimat**: "Buatkan SK mutasi Budi ke cabang Denpasar mulai 1 Desember" → draf lengkap dengan nomor, template, data dari graf. e-Sign dan e-Meterai lewat penyedia resmi.
- **Surat masuk** dilempar (foto/PDF) → tercatat di agenda surat masuk, ditautkan ke orang/pihak terkait.
- **Invoice yang menagih sendiri**: dibuat dari PO/percakapan, membawa QRIS (MDR 0% untuk transaksi kecil sejak 1 Okt 2026) atau VA, pengingat WA dengan nada bertahap, dan **pembayaran dicocokkan otomatis** dari mutasi bank (CSV/screenshot/API). Faktur pajak diperlakukan terpisah (aturan Coretax).

### P09 — **Serah Terima Otomatis dan Ilmu yang Tidak Ikut Pergi**
- Karena graf tahu semua yang disentuh seseorang (kerja terbuka, klien, berkas, aset, akun), saat resign/mutasi diinput Nadi **langsung menyusun paket serah terima**: daftar kerja yang harus dipindah (dengan usulan penerima dari pembagi tugas adil), akun yang dicabut tepat di tanggal efektif, aset yang harus kembali, klien yang perlu dikabari.
- **Rekam Ilmu**: karyawan menjelaskan cara kerjanya lewat voice note atau rekaman layar; AI menyusun SOP. Ini berjalan **terus-menerus**, bukan hanya saat resign. Pengetahuan tidak pernah hanya di kepala satu orang.
- **Sinyal risiko beban** (bukan pengawasan): orang dengan beban jauh di atas rata-rata berbulan-bulan ditandai sebagai risiko kehilangan, supaya pemilik bertindak sebelum orangnya pamit.
- **Wawancara keluar oleh AI**, anonim, untuk alasan jujur.

### P14 — **Jalur Magang dan Dana Mentor**
- Magang = calon karyawan dengan **rencana tertulis**: tujuan, keahlian per minggu, uji akhir.
- **Mentor adalah topi**. Jam mentoring tercatat dari kerja bersama dan sesi, lalu dibayar dari **Dana Rekrutmen** yang dianggarkan. Mentor tidak lagi menanggung kerja tanpa bayaran.
- Peserta magang yang dipakai di luar rencananya ketahuan (kerja di luar topi magang).
- Nilai magang otomatis masuk ke Rekrut Kilat: magang terbaik = kandidat pertama.
- **Biaya per rekrutmen yang jujur**: jam mentor + jam penilai + iklan, terlihat di laporan.

### P06 + P13 + P16 — **Kompas Pajak dan Ruang Akuntan**
- **Dana Cadangan Pesangon**: UU ketenagakerjaan baru memberi dasar hukum dana cadangan pesangon. Nadi menghitung kewajiban pesangon yang menumpuk per karyawan dan menyarankan cadangan bulanan, supaya resign atau PHK tidak memukul kas mendadak.
- **Gaji**: tarif PPh 21 TER, BPJS, lembur, THR sebagai **data bertanggal dengan sumber**. Tidak ada angka pajak di kode. Yang belum diverifikasi ke teks resmi ditandai ⚠ dan tidak jadi preset.
- **Posisi pajak hidup**: "Kalau tutup buku hari ini, pajakmu Rp X." Setiap transaksi langsung jadi jurnal di belakang layar.
- **Pengecek PP 20/2026**: menghitung batas Rp4,8 M **gabungan seluruh usaha pemilik** (fakta yang luput dari aplikasi satu-entitas).
- **Simulator bentuk usaha**: perbandingan legal konsekuensi pajak dan kewajiban perorangan / PT Perorangan / CV / PT / yayasan / koperasi, dengan dasar hukum yang bisa diperiksa akuntan.
- **Penghematan yang sah**: biaya yang boleh dibiayakan terdeteksi dari nota, PTKP benar, fasilitas Pasal 31E, waktu pengakuan, natura.
- **Batas tegas**: Nadi **tidak** membantu cara abu-abu atau ilegal (faktur fiktif, memecah omzet agar di bawah batas). Pola berisiko justru diberi peringatan. Ini melindungi pemilik dan membuat akuntan mau merekomendasikan Nadi.
- **Ruang Akuntan**: akuntan lepasan membuka banyak klien, menerima "paket tutup buku" yang sudah rapi, dan ekspor siap Coretax (format konverter Excel→XML DJP). Dijual per periode, sesuai kebiasaan "panggil akuntan saat perlu" (P16).

---

## 4. Mata: kamera sebagai sensor bisnis

Satu mesin, banyak resep. **Resep** = zona + objek yang dikenali + mesin status + aturan kejadian.

Contoh resep meja restoran: `kosong → terisi → selesai makan → kotor → bersih`. Dari situ keluar:
- waktu tunggu tamu, durasi makan, dan **waktu meja kotor sebelum dibersihkan**
- perputaran meja per jam, dipadukan dengan shift dan POS

Contoh insight: *"Sabtu 18.00–20.00 meja kotor rata-rata 11 menit. Saat itu hanya 2 pelayan. Tambah 1 pelayan diperkirakan menambah 9 perputaran = Rp1,6 juta."*

Resep lain dengan mesin yang sama:
- rak: penuh → menipis → kosong
- antrean kasir: panjang dan pelanggan yang batal
- pengunjung masuk ÷ transaksi POS = **tingkat konversi toko**
- bay bengkel: kosong / dikerjakan / menunggu part
- ruang rapat: terpakai / kosong
- APD di proyek konstruksi
- dok bongkar muat di gudang

**Prinsip privasi (wajib, bukan tambahan):**
- Video **diproses di lokasi** (kotak edge kecil atau HP/tablet bekas). Yang dikirim ke server hanya kejadian ("meja 4 kosong 12:03").
- Default **tanpa pengenalan wajah**. Orang dilacak anonim sebagai titik, wajah diburamkan di cuplikan.
- Pengenalan wajah untuk absen hanya dengan persetujuan tertulis, sesuai UU PDP (biometrik = data pribadi spesifik).
- Mata menilai **proses dan tempat**, bukan menghukum individu. Insight tentang orang selalu dalam bentuk beban dan kebutuhan staf.

**Mesin dasar (produksi):** detektor objek + pelacak multi-objek (ByteTrack/BoT-SORT) + logika zona. Detektor: **RF-DETR** (lisensi Apache-2.0, aman untuk komersial). YOLO26 lebih cepat di CPU tapi lisensi Ultralytics (AGPL/berbayar) perlu dicek sebelum dipakai komersial.

**Lapis eksperimen (V-JEPA 2):** encoder video pralatih yang dibekukan, dengan pengenal kecil di atasnya yang dilatih dari ±20–50 klip berlabel per kejadian baru. Encoder yang sama juga memberi **skor kejutan**: saat kejadian menyimpang dari yang diprediksi model (misal rak biasanya terisi jam segini tapi kosong), Nadi menandainya tanpa aturan yang ditulis manusia.

V-JEPA 2 kuat untuk mengantisipasi aksi (terbaik di Epic-Kitchens, cocok untuk dapur), tapi Meta sendiri menyebut kemampuannya di luar adegan dapur belum diketahui. Jadi ia diuji di F5 sebagai eksperimen, bukan fondasi.

> Catatan: saya mengartikan "jev" di pesanmu sebagai **JEPA** (Joint Embedding Predictive Architecture dari Meta, versi video V-JEPA 2). Kalau maksudmu lain, beri tahu.

---

## 5. Pengalaman pengguna: hampir tanpa menu

| Pengguna | Antarmuka utama | Yang dia lakukan |
|---|---|---|
| **Pemilik** | **Feed Keputusan** di HP + ringkasan pagi di WA ("Sarapan Data") | Menggeser setuju/tolak, kartu diurutkan menurut dampak rupiah dan tenggat |
| **Staf** | **PWA ringan** (tanpa instal) + **WhatsApp** | Absen dan tugas harian di PWA (gratis). Izin, tukar shift, slip, dan lempar nota boleh lewat WA |
| **Admin / HR** | Kotak **Lempar Saja** + tabel yang bisa diubah sendiri | Dump berkas, periksa usulan AI, atur topi dan aturan |
| **Akuntan** | Ruang Akuntan (desktop, padat) | Tutup buku banyak klien, ekspor pajak |
| **Siapa pun** | **Bilah perintah dan suara** ("Siapa yang paling banyak lembur bulan ini?") | Bertanya dan memerintah dalam bahasa sehari-hari |
| **AI milik perusahaan** | **MCP** | Asisten AI mereka membaca dan mengusulkan perubahan |

Pola yang dipakai di semua layar:
- **Usulan, bukan aksi diam-diam.** AI menghasilkan usulan dengan tingkat keyakinan dan bukti. Manusia menyetujui. Aksi di bawah ambang kebijakan bisa otomatis.
- **Semua bisa dibatalkan.** Setiap perubahan adalah *changeset* yang bisa dikembalikan. Ini jawaban atas keluhan nomor satu di pasar: update dan perubahan yang merusak (R8b).
- **Peta Usaha**: denah lokasi yang hidup (meja, rak, bay, siapa sedang bertugas) dari Mata, absen, dan POS.
- Bahasa Indonesia sehari-hari; istilah akuntansi jadi keterangan kedua.

**Biaya WhatsApp menentukan desain.** Sejak 1 Okt 2026, pesan layanan di atas 1.000 gratis per nomor per bulan ikut ditagih, juga pesan utilitas di dalam jendela layanan. Tarif Indonesia sekitar Rp357 per pesan utilitas/layanan dan Rp586 per pesan pemasaran, belum PPN (⚠ dari halaman reseller, cocokkan dengan kartu tarif Meta).

Contoh: 20 staf × 2 absen × 26 hari = 1.040 pesan per bulan, sudah melewati kuota gratis hanya dari absen. Karena itu:
- kegiatan berulang (absen, cek tugas) lewat PWA
- WA untuk hal yang jarang dan bernilai: izin, ringkasan pagi pemilik, lamaran kandidat, penagihan
- slip gaji dikirim sebagai tautan aman, bukan lampiran

---

## 6. AI dan sains data

### 6.1 Tangga kecerdasan (yang termurah dulu)
1. **Aturan pasti** (SQL, bahasa ekspresi tertutup): gaji, nomor surat, gerbang gaji, jurnal. Nol token, nol halusinasi.
2. **Model kecil khusus**: deteksi objek dan pelacak (kamera), deteksi anomali, peramalan deret waktu, pemecah jadwal. Murah dan cepat.
3. **LLM kecil/cepat** untuk klasifikasi dan ekstraksi massal.
4. **LLM besar** hanya untuk penalaran: menyusun surat, menjawab pertanyaan rumit, analisis malam.

### 6.2 Bank Data (hemat token)
Tiga bank, supaya AI membaca ringkasan yang sudah jadi, bukan data mentah:

| Bank | Isi | Hemat karena |
|---|---|---|
| **Bank Publik** (dipakai bersama semua tenant) | regulasi bertanggal, tarif pajak/BPJS/UMP per daerah, template surat, pustaka topi dan kompetensinya, skema dokumen umum (faktur pajak, slip, KTP) | Dihitung sekali untuk ribuan perusahaan |
| **Bank Tenant** | fakta perusahaan ("Pak Kadek = pemilik"), SOP, glosarium, **ekstraktor terkompilasi**, **paket konteks** (ringkasan bergulir per orang/pihak/tempat yang diperbarui bertahap) | AI membaca 300 token ringkasan, bukan 30.000 token riwayat |
| **Bank Jawaban** | cache semantik pertanyaan → jawaban, dibatalkan otomatis saat datanya berubah | Pertanyaan berulang tidak memanggil model |

**Ekstraktor terkompilasi** (inti hemat token di Lempar Saja): pertama kali Nadi membaca nota dari Pemasok X, LLM vision mengekstrak isinya dan sekaligus menulis **aturan ekstraksi** untuk tata letak itu (sidik jari layout + posisi teks). Nota berikutnya dari pemasok yang sama dibaca dengan OCR + aturan itu, **tanpa LLM**. LLM dipanggil lagi hanya bila keyakinan turun.

Teknik lain: prompt caching untuk instruksi tetap, Batch API (diskon 50%) untuk analisis malam, routing model menurut kesulitan, dan MCP agar penalaran berat berjalan di langganan AI milik pelanggan.

Harga model AI saat ini (per juta token, masuk/keluar), dipakai untuk routing:

| Model | Harga | Dipakai untuk |
|---|---|---|
| Model kecil | mulai $0,10 / $0,50 | memilah dan mengekstrak massal |
| Model menengah | $2 / $10 | agen harian, menyusun surat |
| Model besar | $4 / $20 | analisis rumit, menulis ekstraktor baru |

Embedding diperbarui otomatis memakai pola resmi Supabase: trigger → pgmq → pg_cron → Edge Function, disimpan di pgvector `halfvec` dengan indeks HNSW.

### 6.3 Model yang dipakai
| Kebutuhan | Pendekatan |
|---|---|
| Baca dokumen, nota, KTP, CV, surat | LLM vision + OCR, lalu ekstraktor terkompilasi |
| Suara (voice note WA, wawancara) | Whisper large-v3 (WER 7,43 di Common Voice Indonesia), tapi akurasinya anjlok pada percakapan santai, jadi hasil selalu tampil sebagai kartu konfirmasi |
| Kamera | detektor objek + pelacak multi-objek di edge; V-JEPA 2 untuk resep baru dan skor kejutan |
| Ramalan penjualan, pengunjung, kas, kebutuhan staf | model fondasi deret waktu (zero-shot, tanpa latih per tenant) |
| Jadwal shift, pembagian tugas | constraint solver (CP-SAT) dengan tujuan ganda: cepat + adil |
| Gerbang gaji, kecurangan | aturan pasti + deteksi anomali (Isolation Forest) pada graf |
| Rekrutmen yang belajar | model Bayesian kecil per topi, dengan prior bersama antar-tenant (anonim) |
| Proses nyata vs proses di kertas | process mining dari log kejadian (rekrut, invoice→uang, izin) |
| Pembanding usaha sejenis | agregat anonim lintas tenant per industri + daerah, minimal 10 usaha per kelompok |

### 6.4 Analis Malam
Setiap malam (Batch API) Nadi menghitung metrik, mencari anomali, memperbarui ramalan, lalu menulis **maksimal 3 insight** berisi dampak rupiah dan satu aksi usulan. Paginya dikirim ke pemilik lewat WA. Kalau tidak ada yang penting, tidak ada pesan. Tidak ada dasbor yang harus dibuka.

### 6.5 MCP: bawa AI-mu sendiri
Repo lama sudah punya server MCP + OAuth yang berjalan. Server itu dipakai ulang dan **dinaikkan ke spesifikasi MCP 2026-07-28**:
- server tanpa sesi (stateless), cocok untuk Vercel
- Client ID Metadata Documents menggantikan Dynamic Client Registration, yang dipakai repo lama dan kini usang
- validasi `iss` (RFC 9207)

Lalu diperluas:
- **Tools** per primitif, dibatasi peran pengguna dan RLS.
- **Resources**: paket konteks dari Bank Tenant (ringkas, hemat token).
- **Prompts/playbook**: "tutup bulan", "susun shift minggu depan", "seleksi kandidat lowongan X".
- **Kartu UI di dalam chat** (MCP Apps) untuk persetujuan.
- Setiap tulisan dari AI luar menjadi **Usulan** yang harus disetujui di Nadi, kecuali kebijakan mengizinkan otomatis.
- Paket **Skill** per perusahaan ("cara kerja perusahaan ini") yang bisa dipasang di asisten AI mereka.

---

## 7. Arsitektur teknis

```
 Indra                      Ingatan                         Otak                    Tangan
 ─────                      ───────                         ────                    ──────
 Lempar Saja (web/WA) ─┐                                 ┌─ Aturan (SQL/ekspresi)
 WhatsApp Cloud API ───┤    Postgres (Supabase)          ├─ Model ML (Python)      ┌─ WA keluar
 PWA staf (QR, selfie)─┼──▶ • Graf Usaha (8 primitif)  ──┼─ Agen LLM           ──▶ ├─ QRIS / disbursement
 Mata edge (kejadian) ─┤    • Kejadian (append-only)     └─ Solver (CP-SAT)        ├─ e-Sign / e-Meterai
 POS / mutasi bank ────┤    • Ledger (jurnal kaku)                                  ├─ Ekspor Coretax
 MCP (AI pelanggan) ───┘    • Bank Data (pgvector)                                  └─ Usulan → persetujuan
```

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Web | Next.js 16, React 19, Tailwind v4, PWA | Pola sudah dikuasai dari repo lama |
| Data | Supabase Postgres 17: RLS per tenant, pgvector, pg_cron, pgmq, Realtime, Storage | Satu penyimpan; isolasi tenant di database |
| Alur tahan-gagal | antrean outbox + pekerja (pgmq/pg_cron), atau durable workflow Vercel bila diperlukan | Aksi aman diulang |
| Layanan ML | layanan Python terpisah (FastAPI) untuk solver, peramalan, anomali | Ekosistem ML ada di Python |
| Mata edge | detektor + pelacak di kotak kecil (mini PC / Raspberry Pi 5 + akselerator / HP Android bekas), membaca RTSP dari NVR yang ada | Video tidak keluar lokasi; hemat bandwidth |
| AI | LLM (besar untuk penalaran, kecil untuk ekstraksi massal), prompt caching, Batch API; BYOK dan MCP | Biaya terkendali |
| Integrasi | WhatsApp Business Cloud API, payment gateway (QRIS, VA, disbursement), e-Sign/e-Meterai (Privy/VIDA/Peruri), ekspor Coretax | Lewat antarmuka adaptor yang bisa dimatikan |
| Keamanan | tanpa service-role key, rahasia hanya di Vercel/Supabase, audit append-only, enkripsi kolom sensitif (NIK, gaji, biometrik) | Aturan proyek lama tetap |
| Tes | Vitest, Playwright, pgTAP, tes isolasi tenant di CI | Keandalan adalah fitur |

Yang **dibawa** dari repo lama: auth + `getClaims`, server MCP + OAuth, BYOK terenkripsi, undangan, login kode+ID untuk staf tanpa email, MediaPipe face landmarker, pemindai rahasia, pola tes SQL. Yang tidak dibawa: semua isi sekolah.

---

## 8. Batas etika dan hukum (bagian dari produk)

- **Pajak**: hanya optimasi yang sah. Pola penghindaran ilegal diberi peringatan, tidak dibantu.
- **Pemantauan**: Mata menilai proses dan tempat, bukan menghukum individu. Biometrik hanya dengan persetujuan eksplisit. Karyawan bisa melihat data tentang dirinya.
- **Rekrutmen**: atribut terlindungi tidak ikut penilaian. Keputusan akhir selalu manusia.
- **Gaji**: tidak ada potongan otomatis dari satu sinyal. Ada jalur banding.
- **UU PDP / PP 33/2026** (berlaku 16 Jan 2027):
  - Nadi sebagai pemroses data, dengan DPA bersama pelanggan.
  - **DPIA wajib** untuk pemrosesan yang memakai AI/ML. Mata, KPI, dan Gerbang Gaji perlu template DPIA yang siap diisi pelanggan.
  - Notifikasi kebocoran dan jawaban permintaan subjek data masing-masing 3×24 jam.
  - Catatan aktivitas pemrosesan (ROPA).
  - Data di region Singapura; retensi dokumen pajak 10 tahun.
- **AI**: data nyata tidak lewat kunci AI gratis; penyedia AI berbayar dengan kebijakan tanpa-pelatihan dan tercatat sebagai sub-pemroses.

---

## 9. Peta jalan

Setiap fase berakhir dengan **demo yang bisa dipakai pemilik usaha nyata**, bukan hanya fitur selesai.

| Fase | Isi | Demo akhir fase |
|---|---|---|
| **F0. Fondasi** | tenant + RLS, 8 primitif + log kejadian, auth (email + kode/ID staf), Lempar Saja v1 (foto/PDF/Excel → usulan), server MCP v1, kerangka Bank Publik | "Lempar 20 berkas campur aduk, semuanya tersusun jadi orang, dokumen, dan transaksi dalam 2 menit" |
| **F1. Orang dan Bukti** | Topi, absen QR berputar + selfie keaktifan, izin via WA + otopilot, Gerbang Gaji, slip gaji draf (tarif bertanggal) | "Absen tidak bisa dititip; pegawai siluman tertangkap sebelum gajian" |
| **F2. Rekrut Kilat + Magang** | lamar via WA, wawancara suara asinkron, uji kerja per topi, Feed Keputusan, Bank Talenta, Jalur Magang + Dana Mentor | "Dari lamaran ke tawaran dalam 48 jam" |
| **F3. Kerja dan Keadilan** | kerja + poin beban, pembagi tugas adil, KPI dari jejak, Peta Organisasi Nyata, shift solver + tukar shift, serah terima otomatis + Rekam Ilmu | "Siapa sebenarnya mengerjakan apa, dan bonus yang adil" |
| **F4. Dokumen dan Uang** | Nomor Sakti + QR verifikasi, surat dari kalimat, invoice + QRIS + pengingat, pencocokan mutasi, ledger, Kompas Pajak, Ruang Akuntan | "Invoice yang menagih dan mencatat dirinya sendiri" |
| **F5. Mata** | pilot di 1 restoran + 1 toko: resep meja, antrean, rak; Analis Malam; Peta Usaha | "CCTV lama jadi analis bisnis" |
| **F6. Jaringan** | paket industri tambahan, pembanding anonim, process mining, marketplace psikolog/akuntan, paket skill asisten AI | "Usahamu dibanding 50 usaha sejenis di Bali" |

Urutan bisa digeser: Rekrut Kilat (masalah nomor 1 di daftarmu) sengaja di F2 karena ia butuh Topi dari F1 untuk rubrik dan butuh KPI (F3) untuk lingkaran belajarnya.

---

## 10. Ukuran keberhasilan

| Ukuran | Target awal (hipotesis) |
|---|---|
| Waktu dari "dapat akun" sampai data pertama berguna | < 15 menit (lewat Lempar Saja) |
| Usulan AI yang diterima tanpa koreksi | > 85% setelah 2 minggu per tenant |
| Panggilan LLM per berkas berulang | turun > 80% setelah bulan pertama (ekstraktor terkompilasi) |
| Hari lamar → tawaran | turun 50% |
| Keputusan pemilik yang menunggu > 24 jam | < 10% |
| Selisih gaji vs bukti hadir | 0 kasus tanpa penjelasan |
| Karyawan merasa absen/KPI adil (survei singkat) | naik dibanding sebelum |

---

## 11. Risiko utama

| Risiko | Penanganan |
|---|---|
| Cakupan terlalu lebar untuk satu tim | Primitif dulu, setiap fase hanya satu cerita demo; paket industri pertama: F&B + toko |
| AI salah dan merugikan (gaji, pajak) | Uang dan pajak hanya lewat aturan pasti; AI hanya mengusulkan; semua bisa dibatalkan |
| Dianggap alat pengawasan karyawan | Prinsip privasi §4 dan §8; karyawan melihat datanya sendiri; fitur yang membela karyawan (banding, bonus beban) |
| Biaya AI membengkak | Tangga kecerdasan, Bank Data, MCP/BYOK, batas kuota per tenant |
| Regulasi berubah (UU ketenagakerjaan baru Okt 2026 belum beredar teksnya) | Aturan sebagai data bertanggal, ⚠ sampai terverifikasi |
| Keandalan (keluhan nomor satu pasar) | Tes isolasi + tes SQL di CI, rilis bertahap, rollback konfigurasi |
| Kamera di lokasi gagal (listrik, jaringan) | Edge menyimpan antrean kejadian lokal, kirim saat tersambung |

---

## 12. Yang saya butuhkan dan TIDAK bisa saya ambil sendiri

### Sudah saya cek
| Layanan | Kondisi | Yang bisa saya lakukan sendiri |
|---|---|---|
| GitHub `tristan-tech-web/pkl` | bisa clone; isi produk ada di cabang ide produk | baca, buat cabang, commit, push (setelah kamu setuju arah) |
| Supabase | 2 proyek, **keduanya sedang dijeda (INACTIVE)**: `qxxicvqncftuktblezud` (Mumbai) dan `pkl` / `jvwzxlzhidgsryomnhwv` (Singapura) | mengaktifkan kembali, mengambil URL + publishable key, migrasi, cek ekstensi (pgvector, pgmq, pg_cron) |
| Vercel | proyek `edusmart` ada di tim `well-13fd`, tapi koneksi saya **ditolak (403)** untuk tim itu | setelah kamu menyetujui tautan izin tim: env, deploy, domain |
| Hugging Face | tersambung sebagai `Tristannss` | mencari model (deteksi objek, V-JEPA 2, STT, peramalan) |

### Harus dari kamu
**Wajib sebelum mulai (F0–F1):**
1. **Kunci API model AI** untuk AI sisi server. Masukkan sendiri ke Vercel sebagai env *sensitive* (mis. `ANTHROPIC_API_KEY`); saya tidak perlu melihatnya. Sebutkan juga **batas biaya AI per bulan**.
2. **Persetujuan akses Vercel** ke tim `well-13fd` (saya buatkan tautannya), atau izin membuat proyek Vercel baru.
3. **Keputusan Supabase**: pakai proyek `pkl` (Singapura, cocok untuk UU PDP) untuk produk ini? Lalu saya aktifkan sendiri.
4. **Repo**: lanjut di `pkl` (cabang baru) atau repo baru khusus Nadi?
5. **Contoh berkas nyata yang sudah dianonimkan** dari narasumber: slip gaji, rekap absen, surat dengan format nomornya, invoice, nota pemasok, CV. Ini bahan utama untuk Lempar Saja dan paket industri.
6. **Data narasumber wawancara**: berapa orang, jenis usaha apa, ukuran berapa (bank data mencatat ini belum ada).

**Dibutuhkan saat fasenya tiba:**

| Kebutuhan | Untuk | Catatan |
|---|---|---|
| **WhatsApp Business Cloud API**: akun Meta Business terverifikasi, nomor khusus, WABA ID, Phone Number ID, access token permanen, app secret | F1 (absen/izin via WA), F2 (lamar via WA) | Verifikasi bisnis butuh dokumen usaha; prosesnya bisa berhari-hari, mulai lebih awal |
| **Kunci pengirim email** (mis. Resend) + domain | email masuk/undangan (SMTP bawaan Supabase sangat terbatas) | |
| **Domain** dan **nama produk final** | publik | "Nadi" hanya nama kerja |
| **Payment gateway sandbox** (Xendit / Midtrans / sejenisnya) | F4 QRIS, VA, pencairan gaji | Live butuh dokumen badan usaha |
| **Penyedia e-Sign / e-Meterai** (Privy / VIDA / Peruri) | F4 | Perlu kerja sama bisnis |
| **Akses CCTV mitra** (URL RTSP / rekaman contoh) + **persetujuan tertulis pemilik dan karyawan** | F5 Mata | Minimal 1 restoran + 1 toko; rekaman 1–2 hari untuk melatih resep |
| **Perangkat edge** (mini PC / Raspberry Pi 5 + akselerator / HP Android bekas) | F5 | Bisa mulai dari laptop untuk prototipe |
| **Tempat menjalankan layanan Python ML** (Vercel Python, Cloud Run, Modal, atau VPS) | F3 solver, F5 | Pilih satu |
| Token Hugging Face (opsional) | bila memakai inference endpoint HF | |
| **Psikolog / akuntan mitra** (opsional) | F2, F4 marketplace | |

### Keputusan yang perlu kamu ambil
1. Arah ini (Nadi: 8 primitif + Lempar Saja + Topi + Gaji Berbasis Bukti + Mata + MCP) disetujui?
2. Paket industri pertama: saya usulkan **F&B + toko/grosir** (keduanya bisa memakai Mata dan punya banyak shift).
3. Tenggat PKL dan ukuran tim: menentukan seberapa jauh fase yang realistis.
4. Maksud "jev": JEPA atau hal lain?

---

## 13. Pembaruan 30 Okt 2026 (keputusan setelah diskusi)

**Jev.** "Jev" adalah model dari TypeSafe AI, rilis 15 Sep 2026. Ia model keputusan "System 1", bukan LLM:
- ruang pilihan dideklarasikan dulu (maks 255 opsi), lalu Jev memilih dalam satu jalan dengan tingkat keyakinan;
- latensi 70-500 ms, $0,042 per juta token input;
- akses lewat API TypeSafe, Vercel AI Gateway, atau OpenRouter.

Di Nadi, Jev menjadi **gerbang keputusan cepat**:
- memilah jenis berkas Lempar;
- izin otopilot;
- triase kandidat;
- memutuskan apakah usulan boleh otomatis.

Pola keyakinannya: tinggi langsung jalan, sedang diteruskan ke LLM, rendah ke manusia. Karena Jev belum punya SLA dan pendaftarannya sempat ditutup, selalu ada **fallback model kecil** dengan keluaran terstruktur.

**Pengganti WhatsApp Business API:**
1. PWA dengan Web Push (gratis).
2. Web Share Target: dari WhatsApp, foto, dokumen, atau teks dibagikan langsung ke Nadi.
3. Tautan wa.me berisi pesan siap kirim untuk pesan keluar (pemilik cukup mengetuk kirim).
4. Telegram Bot opsional.

Gateway WA tidak resmi tidak dipakai karena melanggar ketentuan WA dan berisiko nomor diblokir.

**Stack:**
- SQL di Postgres untuk logika data.
- TypeScript (Next.js di Vercel) untuk web.
- Rust ke WASM untuk jalur berat CPU.
- Rust untuk agen edge Mata.
- Python untuk ML.

Beban utama aplikasi ini adalah I/O dan database, jadi efisiensi dicari di desain database:
- klaim JWT di RLS;
- UUIDv7;
- partisi bulanan;
- tolak secara bawaan.

**Kapasitas Supabase Free (perkiraan, diukur di Q-02):** ±50 perusahaan × ±15 orang. Batas yang mentok duluan adalah DB 500 MB dan egress 5 GB. Mode hemat yang dipasang:
- retensi kejadian mentah 90 hari;
- kompresi foto di HP;
- selfie tidak disimpan;
- cache.

**Pengerjaan:** loop otonom dengan jeda 10 menit. Lihat `loop/` dan `loop/README.md`.
