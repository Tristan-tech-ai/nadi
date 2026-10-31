# Urutan Feed dan risiko halaman offset (D-05)

Ditulis 1 Nov 2026. Catatan pemeriksaan untuk hasil D-05 (src/lib/feed.ts, ?lagi=<offset>).

## Urutan bawaan "Mendesak"
Tenggat paling dekat, lalu dampak rupiah terbesar, lalu yang terbaru. Alasannya: pemilik UMKM membuka Feed beberapa menit di sela kerja, jadi yang paling mahal bila terlambat (gaji besok, tagihan jatuh tempo) harus di atas. Kelemahannya: usulan tanpa tenggat dan tanpa dampak (dokumen, rekrut) tenggelam. Itulah alasan ada pil jenis dan urutan "Terbaru"; keduanya jalan keluar, bukan hiasan.

## Risiko: offset bergeser setelah memutuskan
Halaman berbasis offset menghitung ulang daftar setiap kali dibuka. Contoh: ada 25 usulan, pemilik menyetujui 3 di halaman pertama lalu membuka "Lihat 5 berikutnya" (?lagi=20). Daftar kini 22, offset 20 menampilkan nomor 21-22, dan usulan yang tadinya nomor 21-23 bergeser ke 18-20, yang sudah lewat. Hasilnya, 3 usulan terlewat tanpa terlihat. Ini justru masalah yang mau ditutup D-05: usulan tersembunyi.

Pilihan:
1. **Kursor (keyset)**: ?setelah=<kunci urut terakhir> dengan kunci (tenggat, dampak, dibuat_at, id). Tidak bergeser saat usulan di atasnya diputuskan. Lebih rumit karena tenggat/dampak bisa null (perlu urutan NULLS LAST yang sama di kunci).
2. **Kartu yang diputuskan tetap di tempat sampai halaman dimuat ulang**: sudah terjadi sekarang (putusan.tsx tidak memanggil revalidatePath, kartu tetap tampil dengan cap). Pergeseran baru terjadi saat tautan berikut dibuka, karena halaman itu dimuat ulang dari server.
3. **Hitung ulang jujur**: kepala Feed selalu menyebut jumlah menunggu yang sebenarnya, dan halaman kosong karena lewat menyebut "Kembali ke awal". Tidak mencegah lompatan, hanya membuatnya terlihat.

## Keputusan untuk pemeriksaan D-05
- Terima offset untuk v1 bila kepala Feed menyebut jumlah tepat dan ada keadaan `lewat` (sudah ada di tipe Halaman). Uji tangan: setujui 3 kartu di halaman 1, buka halaman 2, hitung apakah ada usulan yang tidak pernah tampil.
- Bila terbukti terlewat, tambah tugas D-05B: kursor keyset, kriteria terima "setelah memutuskan k usulan di halaman 1, membuka halaman 2 menampilkan semua sisa tanpa celah", e2e dengan 25 usulan.
