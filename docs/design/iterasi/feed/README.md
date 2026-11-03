# Iterasi D-12: Feed Keputusan di HP

3-4 Nov 2026. Mengikuti docs/design/ITERASI.md.

## Riset (dibaca 3 Nov 2026)
- NN/g, "Using Swipe to Trigger Contextual Actions" (nngroup.com/articles/contextual-swipe, dibuka lewat Chrome): aksi utama yang
  disembunyikan di balik geser jarang ditemukan; geser sebaiknya untuk aksi merusak; untuk aksi yang sangat berulang, jangan
  minta konfirmasi tiap kali, sediakan batalkan yang mencolok di layar.
- Microsoft Power Automate, "Approve requests on your mobile device" (learn.microsoft.com, dibuka lewat Chrome): daftar
  permintaan, buka satu, setujui atau tolak; setiap persetujuan butuh beberapa ketukan.
- Ramp Help Center (support.ramp.com, lewat pencarian): kotak "perlu tindakan" dan setujui massal untuk mempercepat.

## Masalah Feed lama (diukur, bukan ditebak)
e2e/feed-hp.spec.ts, HP 390 x 844, jempol menjangkau 60% bawah layar, 5 usulan: pengguna harus **menggulir 661 px**, dan tombol
Setujui berpindah antara y 555 dan 739 px (sebaran 184 px). Kartu yang sudah diputuskan tetap setinggi kartu penuh.

## Teknik yang dipelajari
Zona jempol dan "posisi tetap": aksi yang diulang harus berada di tempat yang sama setiap kali, sehingga tangan tidak berpindah.

## Tiga konsep
| Konsep | Gagasan | Kritik | Putusan |
|---|---|---|---|
| 1. Geser kartu | geser kanan setujui, kiri tolak | NN/g: aksi utama di balik geser sulit ditemukan dan tidak terjangkau pembaca layar; salah geser pada usulan uang berbahaya | ditolak |
| 2. Pilih banyak | centang beberapa kartu, satu tombol "Setujui 5" | cepat, tetapi mendorong menyetujui tanpa membaca, bertentangan dengan "pemilik yang memutuskan" untuk uang dan orang | ditolak (mungkin kelak hanya untuk dokumen) |
| 3. Cap lalu susut | Setujui/Tolak langsung mengecap kartu, kartu menyusut jadi satu baris dengan Batalkan 4 detik, halaman digeser sehingga tombol Setujui kartu berikutnya tepat di tempat jempol, lalu tombol itu mendapat fokus | tetap membaca satu kartu satu keputusan, tanpa dialog, batalkan mencolok (NN/g), satu gerak bermakna (cap turun) | **dipilih** |

## Yang dibangun
- components/app/kartu-feed.tsx: keputusan dikirim setelah jendela Batalkan 4 dtk; dikirim seketika bila halaman ditinggal
  (pagehide) atau layar diganti; Batalkan tidak mengirim apa pun. Tanpa JavaScript tetap formulir biasa yang langsung mengirim.
- Cap turun 220 ms (transform dan opacity saja, prefers-reduced-motion global). data-tersimpan="ya" setelah server mengonfirmasi.

## Hasil
| | Sebelum (produksi 2624b47) | Sesudah |
|---|---|---|
| Gulir pengguna untuk 5 keputusan | 661 px | 0 px |
| Posisi tombol Setujui (y) | 665, 555, 738, 555, 739 | 665, 665, 664, 664, 683 |
| Batalkan | tidak ada | 4 dtk, terbukti usulan tetap menunggu |
Waktu e2e (< 30 dtk, kriteria) terpenuhi di keduanya karena robot tidak membaca; ukuran yang bermakna untuk satu tangan adalah
gulir dan posisi tombol. Foto: sebelum/, sesudah/, banding-setelah-1.png (kiri sebelum, kanan sesudah).
