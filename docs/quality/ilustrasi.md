# Hasil uji D-03 Ilustrasi (1 Nov 2026)

| Butir | Hasil |
|---|---|
| 8 ilustrasi apps/web/src/components/ilustrasi | Nota, Lempar, Amplop, Surat, Papan, Kalender, Slip, Kunci; SVG sebaris buatan sendiri, garis tinta currentColor, isian datar token kertas-2 dan kunyit, tanpa gradien dan tanpa teks, dekoratif (aria-hidden) |
| ilustrasi.test.tsx | merah (modul belum ada) lalu 17/17: tiap berkas < 15 KB, tanpa heksadesimal, tanpa gradien, memakai stabilo kunyit, render SVG viewBox 0 0 160 120. Merah sengaja: heksadesimal disuntikkan ke nota.tsx, tes gagal, lalu dipulihkan |
| Tinjauan foto | lembar /dev/komponen terang dan gelap; Kunci digambar ulang karena versi pertama tidak terbaca (kunci kedua menumpuk) |
| e2e ilustrasi.spec (lokal, desktop) | 8 SVG di lembar komponen dan kepala Lempar; axe 390/1440 terang/gelap tanpa pelanggaran serius |
| Dipasang di | keadaan kosong Feed, Kerja, Izin, Gaji, Agenda surat, Surat keluar, Serah terima; kepala Lempar (menggantikan ikon pesawat) |
| docs/ASSETS.md | dicatat sebagai milik proyek |
