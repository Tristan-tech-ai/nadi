# Iterasi D-11: landing

3 Nov 2026. Riset: docs/design/riset-landing.md (8 landing pesaing di desktop lewat Chrome dan di HP 390 px lewat Playwright).

## Masalah landing lama
Isi basi (absen dan topi masih "Sedang dibuat"), 15+ fitur produksi tidak disebut, tanpa navigasi, harga, FAQ, fitur per peran,
dan kaki halaman lengkap; di HP kartu demo baru terlihat setelah lipatan pertama.

## Teknik yang dipelajari
Arsitektur informasi landing: urutan pertanyaan pengunjung (ini untuk siapa, apa yang dikerjakan, bisa dicoba, apakah cocok
untuk peranku, berapa harganya, aman atau tidak, bagaimana mulai) dipetakan ke bagian; setiap bagian menjawab satu pertanyaan.

## Tiga konsep
| Konsep | Gagasan | Kritik | Putusan |
|---|---|---|---|
| 1. Meja pemilik | meja dilihat dari atas, nota/KTP/slip berserakan lalu tertata saat digulir | gerak berat di setiap gulir (melanggar S44 dan satu gerak per layar), berat untuk HP murah, menghias tanpa menjelaskan | ditolak |
| 2. Landing = Feed | seluruh halaman berupa tumpukan kartu usulan yang bisa disetujui (gaji, izin, tagihan, nota) | sangat khas dan produk-pertama di HP, tetapi di desktop terasa tipis, dan harga/keamanan/FAQ tidak cocok sebagai kartu | sebagian diambil: pahlawan tetap kartu nota yang bisa disetujui |
| 3. Buku kas satu hari | tur fitur berupa satu halaman buku kas bergaris dari jam 07.55 sampai tutup buku: setiap baris = jam, siapa (peran), kejadian nyata, dan fitur Nadi yang menanganinya; harga juga ditulis sebagai tabel buku kas | lahir langsung dari "kertas kerja yang hidup", lolos uji tukar logo (tidak cocok untuk produk lain), memuat 15+ fitur tanpa kartu tiga sama besar, terbaca di HP sebagai daftar | **dipilih**, digabung dengan pahlawan konsep 2 |

## Susunan terpilih
1. Kepala: tanda D-10, tautan Satu hari, Siapa memakai, Harga, Keamanan, Panduan, Masuk, tombol Coba usaha contoh.
2. Pahlawan: judul stabilo; di HP kartu nota hidup langsung di bawah judul (produk dulu), paragraf dan ajakan sesudahnya.
3. "Satu hari di warung": buku kas berjam, kolom peran, kejadian, dan yang dikerjakan Nadi.
4. "Siapa memakai apa": empat peran (pemilik, admin, staf, akuntan) sebagai daftar bergaris, bukan kartu.
5. Bukti yang bisa diperiksa: angka uji internal yang nyata (tanpa logo pelanggan dan angka pengguna).
6. Harga sebagai tabel buku kas, jujur: harga rencana, belum ditagih selama masa uji.
7. Keamanan data, FAQ (details/summary, tanpa JS), sedang dibuat, ajakan akhir, kaki halaman lengkap.

## Hasil (produksi 92bec8e, 3 Nov 2026)
- e2e asap landing 3/3 di produksi (demo nota, landing lengkap: navigasi ke 4 bagian, 11 baris satu hari, 4 peran, 4 paket,
  FAQ terbuka, tanpa status basi; usaha contoh). Tes isi "sedang dibuat" dibuat merah sengaja (baris absen lama dimasukkan
  ulang: 1 gagal), lalu hijau.
- axe 0 pelanggaran serius di 390/1440 terang/gelap (produksi/). Lighthouse HP di domain produksi nadi-swart.vercel.app:
  performa 97, aksesibilitas 100, praktik terbaik 100, SEO 100. Alias tim nadi-tristan-tech-ais-projects.vercel.app diberi
  X-Robots-Tag noindex oleh Vercel (SEO 60 di sana), jadi tautan publik memakai nadi-swart.vercel.app.
- Foto halaman penuh: produksi/penuh-390-light.png (9.693 px), produksi/penuh-1440-dark.png.

## Uji 5 detik versi loop
Layar pertama HP: judul "Lempar nota ... Nadi yang merapikan" + kartu nota yang bisa disetujui. Yang diingat: "aplikasi untuk
usaha kecil yang membaca nota dan aku tinggal setujui". Desktop menambah navigasi Satu hari / Siapa memakai / Harga / Keamanan.
