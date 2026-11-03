# Iterasi D-10: identitas dan logo

3 Nov 2026. Mengikuti docs/design/ITERASI.md.

## 1. Riset
- **Kategori** (dilihat langsung di Chrome, docs/design/riset-landing.md): majoo memakai wordmark berwarna dengan angka 7;
  Talenta segitiga merah; Jurnal bentuk A biru; Gadjian wordmark; Kledo wordmark dengan huruf e berwarna; Deputy tanda bintang;
  Gusto dan Homebase wordmark huruf kecil. Hampir semua: huruf kecil + satu warna merek kuat + satu bentuk kecil. Tidak ada yang
  membawa dunia kertas kerja.
- **Sumber primer**: Apple Human Interface Guidelines, App icons (dibaca 3 Nov 2026): satu gagasan inti dengan sesedikit mungkin
  bentuk; huruf awal boleh sebagai penanda; hindari garis sangat tipis dan sudut tajam karena hilang di ukuran kecil; hindari
  meniru komponen UI; uji di ukuran kecil.
- **Logo lama** (sebelum.svg): nota bertepi sobek dengan garis denyut. Masalah: garis EKG adalah klise aplikasi kesehatan; di 16 px
  hanya kotak gelap dengan coretan; tanda dan huruf tidak berhubungan.

## 2. Teknik yang dipelajari
Uji skala dan uji tukar logo: setiap konsep dirender di 16/24/32/64/180 px terang dan gelap dalam satu lembar
(apps/web/scripts/logo-lembar.mjs), lalu ditanya: bila nama diganti, apakah tanda ini tetap cocok untuk aplikasi lain?

## 3. Konsep dan kritik
| Konsep | Gagasan | Kritik | Putusan |
|---|---|---|---|
| A cap (putaran-1) | huruf n di dalam cap toko miring | terbaca "huruf di kotak bulat", cocok untuk aplikasi apa saja; garis cap memadat di 16 px | ditolak (gagal uji tukar logo) |
| B stabilo (putaran-1) | huruf n di atas sapuan stabilo | di semua ukuran terbaca sebagai **gembok** (kesan aplikasi keamanan) | ditolak |
| C titik (putaran-1, 2) | huruf n + satu titik denyut kunyit | sangat jelas di 16 px, tetapi tanpa ciri kertas; titik mirip titik notifikasi | cadangan |
| D kertas (putaran-2) | n dari secarik kertas nota yang kedua kakinya sobek + titik denyut | 16 px terbaca n + titik; mulai 64 px sobekan nota muncul sehingga makna "kertas kerja yang hidup" terbaca bertahap; risiko mirip siluet hantu dikurangi dengan gerigi lebih dangkal | **dipilih** |
| E kertas + stabilo (putaran-2) | D dengan coretan stabilo sebagai pengganti titik | coretan terbaca sebagai topi/pinggiran, mengganggu bentuk n | ditolak |

## 4. Yang dipasang
- Bentuk di apps/web/src/components/ui/logo-jalur.ts (satu sumber); TandaNadi/LogoNadi memakai token warna sehingga mode gelap
  otomatis; scripts/buat-ikon.mjs membuat ikon PWA 192/512/maskable, apple-touch-icon, src/app/icon.png, src/app/apple-icon.png.
- Tes logo-jalur.test.ts: titik di dalam kotak, jarak titik ke lengkung >= 1 satuan (tes merah dulu: jarak awal 0,8, titik digeser),
  kaki >= 3 satuan, warna svgTanda.
- akhir/sebelum-sesudah.png: banding lama dan baru di 16-180 px terang/gelap.

## 5. Uji 5 detik versi loop
Di 32 px: "n dengan titik kuning" (huruf awal nama terbaca). Di 180 px: "kertas sobek berbentuk n". Tidak terbaca sebagai aplikasi
kesehatan lagi. Uji dengan orang sasaran sungguhan belum dilakukan (butuh Tristan, tidak ditunggu).
