# Daftar beban saat jam kerja belum diatur (rancangan Q-30)

Ditulis 1 Nov 2026 (tick 199), sebelum kode. Dasar: docs/research/beban-per-jam.md (app.beban_orang.jam = 40 tetap untuk semua orang), foto Q-28 (scratchpad/foto-q28/beban-pemilik-390-light.png), dan components/app/beban.tsx sekarang.

## Masalah
Selama `jam_sama_rata` bernilai true, setiap baris menulis "6 poin · 40 jam · 0,15 per jam" (HP) atau menampilkan kolom "Jam jadwal" dan "Poin per jam" (desktop). Angka 40 dan 0,15 tidak membawa informasi: semua orang 40, dan per jam hanya poin dibagi 40. Keterangan "Jam kerja belum diatur ..." sudah jujur, tetapi tabelnya tetap menampilkan dua angka anggapan di setiap baris. Pemilik bisa membaca "0,15 per jam" sebagai ukuran kinerja.

## Rancangan
Kedua bentuk di bawah ditentukan oleh satu nilai, `const pakaiJam = !data.jam_sama_rata`.

**HP (390 px), setiap baris:**
- jam sama rata: `6 poin` (ditambah "2 poin antre" bila ada), tanpa jam dan tanpa per jam;
- jam dari jadwal (setelah F3-06): tetap `6 poin · 32 jam · 0,19 per jam`.

**Desktop (1440 px), kepala tabel:**
- jam sama rata: tiga kolom, `Orang dan topi | Poin | Perbandingan`, grid `minmax(0,2fr) minmax(0,1fr) minmax(0,3fr)`. Batang perbandingan jadi lebih lebar, dan itu wajar karena batang adalah satu-satunya visual.
- jam dari jadwal: lima kolom seperti sekarang.

**Batang perbandingan:**
- jam sama rata: lebar = poin / poin terbesar.
- jam dari jadwal: lebar = poin per jam / poin per jam terbesar.

Saat jam sama rata, kedua cara memberi urutan dan proporsi yang sama (semua jam 40). Jadi perubahan ini tidak menggeser tampilan, hanya membuat dasarnya jujur.

**Keterangan** di bawah kalimat kepala tetap, tanpa tanda pisah panjang: "Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama (40 jam seminggu)." Ditambah satu kalimat lanjutan: "Perbandingan memakai poin saja sampai jadwal kerja diisi." Ini menjelaskan kenapa kolom jam tidak ada.

## Yang tidak berubah
- Penanda "paling berat" (stabilo), kalimat kepala (Q-28), dan baris "n orang belum memikul kerja minggu ini".
- Data dari database: tidak ada migrasi.

## Tes
- **Vitest:** fungsi murni baru di lib/kerja/adil.ts, `kolomBeban(jamSamaRata)` mengembalikan `{ pakaiJam, lebar(o, terbesar) }`. Diuji untuk dua keadaan: lebar batang dari poin saat sama rata dan dari per jam saat jadwal ada. Komponen tetap tipis.
- **e2e bagi-adil:**
  - saat `jam-sama-rata` tampil, `beban-poin` tidak memuat "jam";
  - testid `beban-per-jam` tidak ada;
  - kepala tabel desktop tidak memuat "Poin per jam".
- **Foto:** 390/1440, terang/gelap, axe bersih.
