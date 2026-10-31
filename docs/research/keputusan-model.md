# Tingkat model di gerbang keputusan (F1-06B)

Ditulis 1 Nov 2026, lanjutan docs/research/keputusan.md. Gerbang v1 hanya punya tingkat `aturan`; kasus yang tidak tertangkap aturan dicatat `manusia` (usulan tetap ke pemilik dan admin). F1-06B menambah tingkat `model` agar kasus yang jelas tidak membebani pemilik, tanpa membuat model mengambil keputusan berisiko.

## Lingkup v1 tingkat model
Hanya **rute usulan** (`usulan.rute`): untuk usulan yang tidak tertangkap aturan (mis. `catatan` dari asisten MCP, `berkas.tinjau`), model memilih penerima: `pemilik`, `admin`, atau `keduanya`. Model tidak pernah menyetujui atau menolak usulan, tidak menyentuh uang, dan tidak mengubah data selain `usulan.untuk_peran`. Izin tetap aturan pasti (kebijakan pemilik).

## Alur
1. Trigger `rute_usulan` (sudah ada) mencatat keputusan tingkat `manusia` seperti sekarang, lalu, bila usulan tidak tertangkap aturan dan usaha tidak mematikannya, memanggil pg_net ke Edge Function `putuskan` dengan token internal Vault (pola fungsi push). Usulan sudah tampil di Feed untuk keduanya sejak awal, jadi kegagalan model tidak pernah menyembunyikan usulan.
2. Edge Function memanggil model ringan (ID dari `public.konfigurasi`, kunci `model_ai.ringan`) dengan keluaran terstruktur `{pilihan: pemilik|admin|keduanya, yakin: 0..1, alasan}` dan hanya judul, aksi, dan penjelasan usulan (tanpa payload berisi data pribadi).
3. Ambang (sama dengan v1): yakin >= 0,85 -> `untuk_peran` diubah dan keputusan tercatat tingkat `model`; 0,5 sampai < 0,85 -> tetap keduanya, keputusan tercatat `model` dengan pilihan "keduanya (ragu)"; < 0,5 -> tidak berubah.
4. Pembatalan memakai `batalkan_keputusan` yang sudah ada (rute kembali ke `{pemilik, admin}`).
5. Bila tim Vercel sudah punya kartu (R-02C), Jev dicoba lebih dulu lewat AI Gateway dengan bentuk keluaran yang sama; model ringan jadi cadangan (docs/research/jev.md).

## Biaya dan batas
- Satu panggilan per usulan yang tidak tertangkap aturan; di data sekarang ±16 dari 197 usulan (catatan + berkas.tinjau, kueri 1 Nov 2026), jadi sebagian kecil.
- Batas harian per usaha (konfigurasi `batas_keputusan_model`, bawaan 50) agar usaha yang membanjiri usulan tidak menghabiskan token.
- Token dicatat di `public.pemakaian_ai` seperti baca-berkas.

## Kriteria terima rinci
- Usulan `catatan` uji dirute model dan tercatat di `public.keputusan` tingkat `model` dengan alasan dan latensi; p50 latensi tercatat di docs/quality/keputusan.md.
- Kegagalan Edge Function (timeout, kunci salah) tidak mengubah `untuk_peran` dan tercatat.
- Pembatalan mengembalikan rute; batas harian dihormati (tes SQL).

## Perubahan setelah tinjauan keamanan (1 Nov 2026)
Kebijakan baca usulan memakai `untuk_peran`, sehingga rute `{admin}` menyembunyikan usulan dari pemilik, padahal teks yang dinilai model bisa berasal dari luar (catatan asisten MCP, isi berkas pemasok). Karena itu model hanya boleh **mempersempit ke pemilik**: pilihan `admin` dengan yakin >= 0,85 dicatat sebagai keputusan model `admin (saran)` tanpa mengubah `untuk_peran`, dan tidak ada yang perlu dibatalkan. Pembatalan rute model hanya untuk pilihan `pemilik`, oleh pemilik. Deret angka 8 digit atau lebih (NIK, rekening, HP) disensor menjadi `[angka]` sebelum dikirim ke model. Migrasi `keputusan_model_pemilik`, hasil eval di docs/quality/keputusan.md.
