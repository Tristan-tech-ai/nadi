# Arah desain Nadi

Ditulis 31 Okt 2026 setelah riset (referensi di akhir). Berlaku untuk landing page dan aplikasi. Setiap layar diperiksa terhadap berkas ini, `ANTI-SLOP.md`, dan `VOICE.md`.

## 1. Gagasan inti: "kertas kerja yang hidup"

Usaha kecil di Indonesia berjalan di atas kertas:
- nota pemasok, kuitansi bermeterai
- buku kas bergaris
- kertas thermal kasir
- stempel toko
- stabilo kuning di daftar utang

Nadi tidak membuang dunia itu. Nadi membuatnya **hidup**: kertas yang mengisi dirinya sendiri, menghitung sendiri, dan memberi tanda kalau ada yang perlu diputuskan.

Dari situ seluruh bahasa visual diturunkan:

| Benda nyata | Menjadi di Nadi |
|---|---|
| Kertas nota yang hangat, bukan putih layar | Latar `kertas` (putih gading hangat), bukan #FFFFFF |
| Tinta pulpen dan cetakan thermal | Teks `tinta` hampir hitam; angka dengan figur tabular |
| Stabilo kuning | Satu-satunya warna sorot: `kunyit`, untuk menandai yang perlu dilihat |
| Stempel toko | Tanda status (DITERIMA, LUNAS, DITOLAK) berbentuk cap: garis tepi, huruf kapital pendek, sedikit miring hanya di landing |
| Garis buku kas | Pemisah baris tabel tipis, ritme baris konsisten |
| Sobekan kertas thermal | Tepi bawah kartu Usulan di Feed (satu-satunya ornamen bentuk) |
| Denyut nadi | Satu indikator "hidup" per layar (titik berdenyut pelan) saat data realtime mengalir; garis tren kecil (sparkline) |

Yang **tidak** diambil: batik sebagai hiasan, wayang, siluet Monas. Itu klise "Indonesia" yang tidak berhubungan dengan pekerjaan sehari-hari.

## 2. Warna

Tidak ada ungu atau indigo di mana pun. Palet diturunkan dari kertas, tinta, kunyit, dan cap. Nilai final dikunci dan diuji kontrasnya (AA) di D-02.

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `kertas` | #F6F2EA | #141311 | latar halaman |
| `kertas-2` | #EFE9DD | #1C1A17 | permukaan kartu, kolom samping |
| `tinta` | #1C1B18 | #ECE7DD | teks utama, tombol utama (tombol hitam pekat, bukan biru) |
| `tinta-2` | #5B574F | #A8A196 | teks pendukung |
| `garis` | #DDD5C6 | #2E2B26 | garis tepi, pemisah |
| `kunyit` | #E9A825 | #F0B53D | sorot (stabilo), "perlu dilihat" (cincin fokus memakai `tinta`: kunyit di atas kertas terang hanya 1,9:1, di bawah 3:1 WCAG 1.4.11) |
| `cap` | #B4372A | #E0654F | bahaya, penolakan, gaji ditahan |
| `daun` | #23704A | #4FB07F | berhasil, lunas, hadir |
| `laut` | #2D5B86 | #78A6D6 | info, tautan |

Aturan:
- Tombol utama berwarna `tinta`, teks `kertas`.
- Warna lain hanya bermakna status.
- `kunyit` dipakai sebagai stabilo, yaitu blok sorot di belakang teks. Tidak dipakai sebagai warna teks di atas kertas, karena kontrasnya kurang.
- Status selalu warna **plus** ikon atau teks, tidak pernah warna saja.
- Mode gelap adalah "kertas di bawah lampu malam" (hangat), bukan biru tua.

## 3. Huruf

| Peran | Font | Alasan |
|---|---|---|
| Antarmuka dan teks | **Plus Jakarta Sans** (OFL) | Dirancang Gumpita Rahayu (Tokotype) untuk identitas +Jakarta City of Collaboration. Huruf buatan Indonesia untuk produk Indonesia. Punya figur tabular (sejak v2.600) untuk angka rupiah yang lurus berkolom. |
| Judul besar landing | **Bricolage Grotesque** (OFL) | Grotesk berkarakter dengan sedikit kekasaran cetak. Kontras dengan kerapian Jakarta Sans. Hanya untuk judul ≥32 px. |
| Nomor dokumen, kode, struk | **IBM Plex Mono** (OFL) | Nomor surat, nomor invoice, kode undangan, isi nota terkompilasi: terasa "dicetak". |

Aturan:
- Angka uang selalu `font-variant-numeric: tabular-nums`.
- Huruf kalimat (sentence case) di semua UI.
- Huruf kapital penuh hanya untuk label cap pendek (≤ 2 kata).

## 4. Tata letak

**Aplikasi** (alat kerja; tenang, padat seperlunya):
- **Pemilik di HP**: Feed Keputusan satu kolom. Kartu Usulan bertepi bawah sobekan thermal. Tombol Setujui dan Tolak di jangkauan ibu jari, ≥ 48 px.
- **Admin/akuntan di desktop**: dua mode kerapatan (nyaman dan padat). Tabel bergaris buku kas. Kolom angka rata kanan.
- **Staf**: layar sangat sederhana, satu tugas per layar (absen, izin, tugas), tombol besar, nol istilah teknis.
- Grid tidak simetris saat perlu: 8+4 atau 7+5. Tidak ada deretan tiga kartu sama besar.

**Landing:**
- Pahlawan rata kiri, 60/40. Kiri: kalimat masalah yang konkret. Kanan: **demo hidup**, yaitu nota difoto lalu berubah jadi usulan terisi, berjalan di halaman.
- Satu tombol utama.
- Bukti hanya yang nyata: tanpa logo palsu, tanpa angka bulat karangan.

## 5. Gerak

- Transisi rutin 120 sampai 160 ms; perubahan besar 220 sampai 280 ms. Hanya `transform` dan `opacity`. Kurva `cubic-bezier(.2,.7,.2,1)`.
- Satu gerak bermakna per layar:
  - kartu Usulan yang disetujui "dicap" (stempel turun lalu kartu bergeser keluar);
  - nota yang dilempar "tercetak" baris demi baris saat diekstraksi.
- Denyut (titik berdenyut 2 dtk) hanya saat ada data realtime dan hanya satu per layar.
- `prefers-reduced-motion`: semua gerak jadi perubahan seketika.

## 6. Ikon dan ilustrasi

- **Ikon**: satu pustaka garis dengan satu ketebalan (dipilih di D-02, lisensi MIT/ISC), ukuran 20/24 px. Tanpa emoji sebagai ikon.
- **Ilustrasi**: SVG buatan sendiri dengan gaya "cetakan tinta di kertas" (garis tinta, isian kunyit datar, tanpa gradien), untuk keadaan kosong dan onboarding. Tanpa foto stok.
- **Gambar produk**: tangkapan layar Nadi sungguhan dengan data sintetis yang masuk akal (nama Indonesia, rupiah, tanggal WITA), bukan Acme/John Doe.

## 7. Keadaan yang wajib dirancang di setiap layar

- kosong (dengan satu langkah pertama yang jelas)
- memuat (skeleton yang meniru isi)
- galat (apa yang terjadi + apa yang bisa dilakukan)
- sebagian (data belum lengkap)
- luring (offline)
- tanpa izin
- berhasil

## 8. Ukuran keberhasilan desain

- **Uji 5 detik di landing**: orang bisa menyebut untuk siapa Nadi dan apa yang dikerjakannya.
- **Pemilik** menyetujui 5 usulan di HP dengan satu tangan dalam < 30 detik.
- **Staf** absen dari layar kunci HP ke selesai dalam < 10 detik.
- **Gerbang**: Lighthouse mobile performa ≥ 90 dan aksesibilitas 100; axe 0 pelanggaran serius; `scripts/cek-slop.py` bersih.

## Referensi (diakses 31 Okt 2026)

**AI slop dan cara menghindarinya**
1. Why your AI keeps building the same purple gradient website. https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website
2. Anti AI slop ban list (aturan dan ambang). https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
3. How to detect AI slop in your design. https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design
4. AI slop fonts and gradients: the tells. https://www.925studios.co/blog/ai-slop-design-tells
5. AI slop web design guide 2026. https://www.925studios.co/blog/ai-slop-web-design-guide
6. AI design slop: overused UI patterns. https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026
7. Why AI design looks generic. https://www.superdesign.dev/blog/why-ai-design-looks-generic

**Dasbor dan aplikasi kerja**
8. 35 SaaS dashboard examples and patterns 2026 (single-metric focus, progressive disclosure, role-aware). https://925studios.co/blog/saas-dashboard-design-examples-2026
9. Anatomy of high-performance SaaS dashboards 2026. https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns

**Landing page B2B**
10. B2B landing page mistakes. https://directiveconsulting.com/blog/b2b-landing-page-mistakes
11. 15 B2B landing page examples and principles. https://www.sproutworth.com/b2b-landing-page-examples/
12. Components of B2B SaaS landing pages. https://genesysgrowth.com/blog/components-b2b-saas-landing-pages

**Tren 2026**
13. Figma: web design trends. https://www.figma.com/resource-library/web-design-trends/
14. Really Good Designs: web design trends 2026 (tata letak dipimpin huruf). https://reallygooddesigns.com/web-design-trends-2026/

**Huruf**
15. Plus Jakarta Sans (Tokotype, OFL, +Jakarta City of Collaboration). https://github.com/tokotype/PlusJakartaSans

**Bahasa dan ejaan Indonesia** (lihat VOICE.md)
16. Apa itu UX writing (contoh lokal). https://dealls.com/pengembangan-karir/apa-itu-ux-writing
17. Aturan penulisan rupiah (PUEBI II.H.5; ⚠ cek ke teks resmi EYD V). https://penerbitdeepublish.com/aturan-penulisan-rupiah/

Catatan jujur: sebagian besar sumber 1 sampai 14 adalah agensi atau vendor alat dengan kepentingan komersial. Yang diambil hanya pola yang muncul berulang di beberapa sumber, bukan angka konversi mereka.
