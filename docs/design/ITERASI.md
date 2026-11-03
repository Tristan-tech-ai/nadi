# Grup iterasi desain

Ditulis 3 Nov 2026 atas perintah Tristan: desain punya jalur iterasi sendiri, dimulai dari riset dan belajar bekerja seperti desainer
profesional yang selalu mencari ide unik, dengan UI/UX sebagai prioritas. Lolos anti-slop bukan tujuan; itu syarat minimum.

## Peran dalam satu iterasi (dikerjakan loop sendiri, berurutan)
1. Peneliti: masalah pengguna nyata untuk layar itu (P01-P16, data pemakaian bila ada), pola dari sumber primer (pedoman resmi
   Material dan Human Interface Guidelines, heuristik Nielsen Norman Group, WCAG 2.2), dan aplikasi yang benar-benar dipakai UMKM
   Indonesia. Sumber dan tanggal dicatat di loop/LEARN.md.
2. Pembelajar: satu teknik desainer profesional per iterasi (mis. pemetaan perjalanan, arsitektur informasi, hierarki tipografi,
   sistem grid, desain gerak bermakna, penulisan UX), ditulis singkat di docs/design/belajar/ dengan contoh dari Nadi.
3. Pencipta ide: minimal 3 konsep yang benar-benar berbeda (bukan variasi warna), satu di antaranya sengaja tidak biasa; setiap konsep
   diturunkan dari "kertas kerja yang hidup" (DIRECTION.md), bukan dari template SaaS.
4. Pengkritik: kritik terstruktur (skill design:design-critique, design:accessibility-review, design:ux-copy) terhadap tiap konsep:
   kejelasan, beban kognitif, jangkauan ibu jari, keterbacaan angka, kesan unik; konsep yang terasa generik dibuang.
5. Pembuat: konsep terpilih dibangun di kode nyata dengan data sintetis yang masuk akal.
6. Penguji: foto 390/1440 terang dan gelap, axe, Lighthouse, waktu tugas (mis. setujui 5 usulan < 30 dtk), uji 5 detik versi loop
   (apa yang diingat dari layar dalam 5 detik), dan sebelum/sesudah. Uji dengan orang sasaran sungguhan hanya bila Tristan bersedia
   (dicatat di UNTUK-TRISTAN.md, tidak ditunggu).
7. Pencatat: keputusan, alasan, dan yang ditolak di loop/DECISIONS.md; foto sebelum/sesudah di docs/design/iterasi/<layar>/.

## Kriteria "unik" yang bisa diperiksa
- Tidak ada pola yang bisa ditukar ke produk lain tanpa terasa aneh (uji tukar logo: bila logo diganti dan layar tetap cocok untuk
  produk SaaS apa saja, layar itu generik).
- Setiap layar punya satu ciri khas yang lahir dari dunia kerja UMKM (nota, cap, buku kas, stabilo), dipakai bermakna, bukan hiasan.
- Tidak ada deretan tiga kartu fitur, pahlawan kiri-teks kanan-gambar standar, atau ilustrasi stok.

## Urutan iterasi pertama
D-10 identitas dan logo baru; D-11 landing baru; D-12 Feed Keputusan di HP; D-13 Lempar Saja; D-14 kartu akhir dan video promo
memakai identitas baru. Setiap iterasi satu tugas antrean dengan kriteria terima di atas.
